#!/usr/bin/env node
/**
 * Idempotent Firebase seed for Quick-Run Express dispatch system.
 * Requires users to exist in Firebase Auth (created manually — no passwords here).
 * Loads env from .env.local in the project root.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ── Env loading ──────────────────────────────────────────────────────────────

function loadEnvLocal() {
  const envPath = path.join(projectRoot, ".env.local");
  if (!fs.existsSync(envPath)) {
    console.error("\n❌ Missing .env.local — copy .env.example and fill in values.\n");
    process.exit(1);
  }

  const content = fs.readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

function requireEnv(name) {
  const val = process.env[name]?.trim();
  if (!val) {
    console.error(`\n❌ Missing required env var: ${name} (set in .env.local)\n`);
    process.exit(1);
  }
  return val;
}

function optionalEnv(name) {
  const val = process.env[name]?.trim();
  return val || undefined;
}

function getPrivateKey() {
  const raw = requireEnv("FIREBASE_PRIVATE_KEY");
  return raw.replace(/\\n/g, "\n");
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function nowIso() {
  return new Date().toISOString();
}

function formatCents(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function initialsFromName(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function displayNameFromUser(user, fallbackEmail) {
  return user.displayName?.trim() || fallbackEmail.split("@")[0] || "User";
}

const SYSTEM_ACTOR = { actorId: "system", actorRole: "system" };

// ── Firebase init ────────────────────────────────────────────────────────────

function initFirebase() {
  const projectId = requireEnv("FIREBASE_PROJECT_ID");
  const clientEmail = requireEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = getPrivateKey();

  if (!getApps().length) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  }

  return {
    auth: getAuth(),
    db: getFirestore(),
  };
}

// ── Auth + users ─────────────────────────────────────────────────────────────

async function findUserByEmail(auth, email) {
  try {
    return await auth.getUserByEmail(email);
  } catch (err) {
    if (err?.code === "auth/user-not-found") return null;
    throw err;
  }
}

async function seedAuthUser(auth, db, { email, role, driverId }) {
  const user = await findUserByEmail(auth, email);
  if (!user) {
    console.error(`\n❌ Firebase Auth user not found: ${email}`);
    console.error("   Create this user manually in Firebase Console → Authentication.\n");
    process.exit(1);
  }

  const claims = { role, active: true };
  if (driverId) claims.driverId = driverId;

  await auth.setCustomUserClaims(user.uid, claims);

  const displayName = displayNameFromUser(user, email);
  const ref = db.collection("users").doc(user.uid);
  const existing = await ref.get();
  const now = nowIso();

  const profile = {
    uid: user.uid,
    email: user.email ?? email,
    displayName,
    role,
    isActive: true,
    lastLoginAt: null,
    updatedAt: now,
    createdAt: existing.exists ? existing.data().createdAt : now,
  };
  if (driverId) profile.driverId = driverId;

  await ref.set(profile, { merge: true });

  console.log(`  ✓ ${role.padEnd(11)} ${email} (${user.uid})`);
  return { uid: user.uid, email, displayName, role, driverId };
}

// ── Drivers ──────────────────────────────────────────────────────────────────

async function upsertDriver(db, driverId, { userId, name, email, status, metrics }) {
  const ref = db.collection("drivers").doc(driverId);
  const existing = await ref.get();
  const now = nowIso();

  const driver = {
    id: driverId,
    userId,
    name,
    phone: "(555) 234-9876",
    email,
    status,
    vehicle: "Van — White Ford Transit",
    avatarColor: "bg-info-soft text-info",
    initials: initialsFromName(name),
    activeDeliveries: metrics.activeDeliveries,
    completedToday: metrics.completedToday,
    failedToday: 0,
    averageDeliveryTimeMs: 24 * 60 * 1000,
    rating: 4.9,
    successRate: 95.8,
    totalDeliveries: metrics.totalDeliveries,
    lastActiveAt: now,
    updatedAt: now,
    createdAt: existing.exists ? existing.data().createdAt : now,
  };

  await ref.set(driver, { merge: true });
  console.log(`  ✓ driver      ${driverId} — ${name}`);
  return driver;
}

// ── Orders + events ──────────────────────────────────────────────────────────

/**
 * Upsert a status event using a fixed doc id for idempotency.
 * Matches OrderStatusEvent shape from lib/types/backend.ts and addStatusEvent().
 */
async function upsertStatusEvent(db, orderId, eventId, event) {
  const ref = db.collection("orders").doc(orderId).collection("events").doc(eventId);
  await ref.set({
    orderId,
    status: event.status,
    stepKey: event.stepKey ?? null,
    note: event.note ?? null,
    actorId: event.actorId,
    actorRole: event.actorRole,
    createdAt: event.createdAt,
  });
}

async function upsertOrder(db, order, events) {
  const ref = db.collection("orders").doc(order.id);
  const existing = await ref.get();
  const now = nowIso();

  const doc = {
    ...order,
    updatedAt: now,
    createdAt: existing.exists ? existing.data().createdAt : order.createdAt ?? now,
  };

  await ref.set(doc, { merge: true });
  console.log(`  ✓ order       ${order.id} — ${order.status}`);

  for (const evt of events) {
    await upsertStatusEvent(db, order.id, evt.id, evt);
  }
}

function buildSeedOrders(driver1Name) {
  const base = {
    pickupName: "Quick-Run Express Hub",
    pickupAddress: "100 Logistics Way, Dallas, TX 75201",
    paymentStatus: "Paid",
    paymentMethod: "Card",
    subtotalCents: 4500,
    deliveryFeeCents: 999,
    taxCents: 451,
    totalCents: 5950,
    totalDisplay: formatCents(5950),
    completedSteps: [],
    source: "manual",
    createdBy: "system",
  };

  const t0 = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
  const t1 = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  const t2 = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const t3 = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
  const t4 = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  return [
    {
      order: {
        ...base,
        id: "QRX-SEED-1001",
        trackingId: "QRX-SEED-1001",
        customerName: "City Hospital Supply",
        customerPhone: "(555) 456-7890",
        customerEmail: "supply@cityhospital.test",
        deliveryAddress: "3500 Gaston Ave, Dallas, TX 75246",
        deliveryUnit: "Loading Dock B",
        assignedDriverId: null,
        assignedDriverName: null,
        status: "New",
        createdAt: t0,
      },
      events: [
        {
          id: "seed-new",
          status: "New",
          note: "Order created",
          ...SYSTEM_ACTOR,
          createdAt: t0,
        },
      ],
    },
    {
      order: {
        ...base,
        id: "QRX-SEED-1002",
        trackingId: "QRX-SEED-1002",
        customerName: "Global Office Supplies",
        customerPhone: "(555) 345-6789",
        deliveryAddress: "3100 McKinney Ave, Dallas, TX 75204",
        assignedDriverId: "DRV-10012",
        assignedDriverName: driver1Name,
        status: "Assigned",
        eta: "12:30 PM",
        createdAt: t1,
      },
      events: [
        { id: "seed-new", status: "New", note: "Order created", ...SYSTEM_ACTOR, createdAt: t1 },
        {
          id: "seed-assigned",
          status: "Assigned",
          note: `Assigned to ${driver1Name}`,
          ...SYSTEM_ACTOR,
          createdAt: t1,
        },
      ],
    },
    {
      order: {
        ...base,
        id: "QRX-SEED-1003",
        trackingId: "QRX-SEED-1003",
        customerName: "Acme Manufacturing",
        customerPhone: "(555) 123-4567",
        deliveryAddress: "1200 Industrial Blvd, Dallas, TX 75201",
        assignedDriverId: "DRV-10012",
        assignedDriverName: driver1Name,
        status: "Out for Delivery",
        eta: "12:15 PM",
        completedSteps: ["pickedUp", "outForDelivery"],
        createdAt: t2,
      },
      events: [
        { id: "seed-new", status: "New", note: "Order created", ...SYSTEM_ACTOR, createdAt: t2 },
        {
          id: "seed-assigned",
          status: "Assigned",
          note: `Assigned to ${driver1Name}`,
          ...SYSTEM_ACTOR,
          createdAt: t2,
        },
        {
          id: "seed-out-for-delivery",
          status: "Out for Delivery",
          stepKey: "outForDelivery",
          note: "Out for delivery",
          actorId: "DRV-10012",
          actorRole: "driver",
          createdAt: t3,
        },
      ],
    },
    {
      order: {
        ...base,
        id: "QRX-SEED-1004",
        trackingId: "QRX-SEED-1004",
        customerName: "Tech Solutions Inc.",
        customerPhone: "(555) 678-9012",
        deliveryAddress: "1750 N Central Expy, Dallas, TX 75201",
        assignedDriverId: "DRV-10012",
        assignedDriverName: driver1Name,
        status: "Delivered",
        completedSteps: ["pickedUp", "outForDelivery", "signature"],
        deliveredAt: t4,
        createdAt: t2,
      },
      events: [
        { id: "seed-new", status: "New", note: "Order created", ...SYSTEM_ACTOR, createdAt: t2 },
        {
          id: "seed-assigned",
          status: "Assigned",
          note: `Assigned to ${driver1Name}`,
          ...SYSTEM_ACTOR,
          createdAt: t2,
        },
        {
          id: "seed-out-for-delivery",
          status: "Out for Delivery",
          stepKey: "outForDelivery",
          note: "Out for delivery",
          actorId: "DRV-10012",
          actorRole: "driver",
          createdAt: t3,
        },
        {
          id: "seed-delivered",
          status: "Delivered",
          stepKey: "signature",
          note: "Delivery completed",
          actorId: "DRV-10012",
          actorRole: "driver",
          createdAt: t4,
        },
      ],
    },
  ];
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  loadEnvLocal();

  const adminEmail = requireEnv("SEED_ADMIN_EMAIL");
  const driver1Email = requireEnv("SEED_DRIVER_1_EMAIL");
  const dispatcherEmail = optionalEnv("SEED_DISPATCHER_EMAIL");
  const driver2Email = optionalEnv("SEED_DRIVER_2_EMAIL");

  console.log("\n🌱 Quick-Run Express — Firebase seed\n");

  const { auth, db } = initFirebase();

  console.log("Auth users + custom claims:");
  await seedAuthUser(auth, db, { email: adminEmail, role: "admin" });

  if (dispatcherEmail) {
    await seedAuthUser(auth, db, { email: dispatcherEmail, role: "dispatcher" });
  }

  const driver1 = await seedAuthUser(auth, db, {
    email: driver1Email,
    role: "driver",
    driverId: "DRV-10012",
  });

  let driver2;
  if (driver2Email) {
    driver2 = await seedAuthUser(auth, db, {
      email: driver2Email,
      role: "driver",
      driverId: "DRV-10013",
    });
  }

  console.log("\nDriver profiles:");
  await upsertDriver(db, "DRV-10012", {
    userId: driver1.uid,
    name: driver1.displayName,
    email: driver1.email,
    status: "Available",
    metrics: { activeDeliveries: 2, completedToday: 1, totalDeliveries: 48 },
  });

  if (driver2) {
    await upsertDriver(db, "DRV-10013", {
      userId: driver2.uid,
      name: driver2.displayName,
      email: driver2.email,
      status: "Available",
      metrics: { activeDeliveries: 0, completedToday: 0, totalDeliveries: 42 },
    });
  }

  console.log("\nOrders + status events:");
  const seedOrders = buildSeedOrders(driver1.displayName);
  for (const { order, events } of seedOrders) {
    await upsertOrder(db, order, events);
  }

  console.log("\n✅ Seed complete (idempotent — safe to re-run).\n");
  console.log("Reminder: sign out and sign back in so ID tokens pick up new custom claims.\n");
}

function printSeedError(err) {
  const msg = err?.message || String(err);
  console.error("\n❌ Seed failed:", msg);

  if (msg.includes("PERMISSION_DENIED") && msg.includes("Firestore")) {
    console.error(`
Fix: Enable Firestore for project ${process.env.FIREBASE_PROJECT_ID ?? "(unknown)"}:

  1. Firebase Console → Build → Firestore Database → Create database
     https://console.firebase.google.com/project/${process.env.FIREBASE_PROJECT_ID}/firestore

  Or enable the API directly:
     https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=${process.env.FIREBASE_PROJECT_ID}

  2. Wait 1–2 minutes, then re-run: npm run seed:firebase
`);
  }
}

main().catch((err) => {
  printSeedError(err);
  process.exit(1);
});
