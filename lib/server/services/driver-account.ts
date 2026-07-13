import type { DriverAccountAccess } from "@/lib/types/backend";
import type { AuthUser } from "@/lib/server/auth";
import { ACTIVE_ORDER_STATUSES } from "@/lib/delivery-metrics";
import { forbiddenError, notFoundError, ServiceError } from "@/lib/server/errors";
import { COLLECTIONS } from "@/lib/server/firestore/collections";
import { nowIso, omitUndefined, resolveDriverAuthUid } from "@/lib/server/firestore/helpers";
import { getAdminAuth, getAdminFirestore } from "@/lib/server/firebase-admin";
import { writeAuditLog } from "@/lib/server/services/audit";
import type { UpdateDriverAccountInput } from "@/lib/server/validation/driver-account";

type FirebaseAuthError = { code?: string; message?: string };

function mapFirebaseAuthError(err: unknown): ServiceError {
  const code = (err as FirebaseAuthError)?.code;
  if (code === "auth/email-already-exists") {
    return new ServiceError(
      "That login email is already in use by another account",
      "EMAIL_IN_USE",
      409,
    );
  }
  if (code === "auth/user-not-found") {
    return new ServiceError("Authentication account not found", "AUTH_USER_NOT_FOUND", 404);
  }
  if (code === "auth/invalid-email") {
    return new ServiceError("Invalid email address", "INVALID_EMAIL", 400);
  }
  if (code === "auth/invalid-password" || code === "auth/weak-password") {
    return new ServiceError("Password does not meet security requirements", "WEAK_PASSWORD", 400);
  }
  console.error("[driver-account] Firebase Auth error", code ?? "unknown");
  return new ServiceError(
    "Unable to update the authentication account. Try again or check Firebase Console.",
    "AUTH_UPDATE_FAILED",
    502,
  );
}

async function loadDriverDoc(driverId: string) {
  const db = getAdminFirestore();
  const snap = await db.collection(COLLECTIONS.drivers).doc(driverId).get();
  if (!snap.exists) throw notFoundError("Driver", driverId);
  return { ref: snap.ref, data: snap.data()! };
}

async function assertAuthUserLinkedToDriver(
  authUid: string,
  driverId: string,
): Promise<void> {
  const auth = getAdminAuth();
  let authUser;
  try {
    authUser = await auth.getUser(authUid);
  } catch (err) {
    throw mapFirebaseAuthError(err);
  }

  const claims = authUser.customClaims ?? {};
  const claimDriverId = typeof claims.driverId === "string" ? claims.driverId : undefined;
  if (claimDriverId && claimDriverId !== driverId) {
    throw new ServiceError(
      "The linked authentication account is assigned to a different driver profile",
      "AUTH_LINK_MISMATCH",
      409,
    );
  }

  const claimRole = claims.role;
  if (claimRole && claimRole !== "driver") {
    throw new ServiceError(
      "The linked authentication account is not a driver login",
      "AUTH_ROLE_MISMATCH",
      409,
    );
  }

}

async function countActiveOrders(driverId: string): Promise<number> {
  const db = getAdminFirestore();
  const snap = await db
    .collection(COLLECTIONS.orders)
    .where("assignedDriverId", "==", driverId)
    .where("status", "in", ACTIVE_ORDER_STATUSES)
    .get();
  return snap.size;
}

async function assertAuthUidNotUsedByOtherDriver(
  authUid: string,
  driverId: string,
): Promise<void> {
  const db = getAdminFirestore();
  for (const field of ["authUid", "userId"] as const) {
    const snap = await db
      .collection(COLLECTIONS.drivers)
      .where(field, "==", authUid)
      .limit(2)
      .get();
    for (const doc of snap.docs) {
      if (doc.id !== driverId) {
        throw new ServiceError(
          "That authentication account is already linked to another driver",
          "AUTH_UID_IN_USE",
          409,
        );
      }
    }
  }
}

function assertNotSelfModification(actor: AuthUser, targetAuthUid: string): void {
  if (actor.uid === targetAuthUid) {
    throw forbiddenError(
      "You cannot modify your own authentication account through driver management",
    );
  }
}

export async function getDriverAccountAccess(driverId: string): Promise<DriverAccountAccess> {
  const { data } = await loadDriverDoc(driverId);
  const driverName = String(data.name ?? "");
  const authUid = resolveDriverAuthUid(data);
  const activeOrderCount = await countActiveOrders(driverId);

  if (!authUid) {
    return {
      driverId,
      driverName,
      linked: false,
      activeOrderCount,
    };
  }

  const auth = getAdminAuth();
  try {
    const authUser = await auth.getUser(authUid);
    return {
      driverId,
      driverName,
      linked: true,
      authUid,
      loginEmail: authUser.email ?? undefined,
      displayName: authUser.displayName ?? undefined,
      disabled: authUser.disabled,
      accountUpdatedAt:
        typeof data.accountUpdatedAt === "string" ? data.accountUpdatedAt : undefined,
      activeOrderCount,
    };
  } catch (err) {
    const code = (err as FirebaseAuthError)?.code;
    if (code === "auth/user-not-found") {
      return {
        driverId,
        driverName,
        linked: false,
        activeOrderCount,
      };
    }
    throw mapFirebaseAuthError(err);
  }
}

export async function linkDriverAuthUid(
  driverId: string,
  authUid: string,
  actor: AuthUser,
): Promise<DriverAccountAccess> {
  const { ref, data } = await loadDriverDoc(driverId);
  const existing = resolveDriverAuthUid(data);
  if (existing) {
    throw new ServiceError(
      "This driver already has a linked authentication account",
      "ALREADY_LINKED",
      400,
    );
  }

  assertNotSelfModification(actor, authUid);
  await assertAuthUidNotUsedByOtherDriver(authUid, driverId);

  const driverName = String(data.name ?? "");
  await assertAuthUserLinkedToDriver(authUid, driverId);

  const now = nowIso();
  await ref.update({
    authUid,
    userId: authUid,
    accountUpdatedAt: now,
    accountUpdatedByUid: actor.uid,
    updatedAt: now,
  });

  const auth = getAdminAuth();
  const existingClaims = (await auth.getUser(authUid)).customClaims ?? {};
  await auth.setCustomUserClaims(authUid, {
    ...existingClaims,
    role: "driver",
    driverId,
    active: existingClaims.active !== false,
  });

  await writeAuditLog({
    action: "driver.account.link",
    entityType: "driver",
    entityId: driverId,
    actorId: actor.uid,
    actorRole: actor.role,
    metadata: {
      driverId,
      targetAuthUid: authUid,
      emailChanged: false,
      passwordChanged: false,
      disabledChanged: false,
    },
  });

  return getDriverAccountAccess(driverId);
}

export async function updateDriverAccount(
  driverId: string,
  input: UpdateDriverAccountInput,
  actor: AuthUser,
): Promise<DriverAccountAccess> {
  if (input.linkAuthUid !== undefined) {
    return linkDriverAuthUid(driverId, input.linkAuthUid, actor);
  }

  const { ref, data } = await loadDriverDoc(driverId);
  const authUid = resolveDriverAuthUid(data);
  if (!authUid) {
    throw new ServiceError(
      "Authentication account not linked. Link an existing Firebase user before changing credentials.",
      "AUTH_NOT_LINKED",
      400,
    );
  }

  assertNotSelfModification(actor, authUid);
  await assertAuthUserLinkedToDriver(authUid, driverId);

  const auth = getAdminAuth();
  const currentUser = await auth.getUser(authUid);
  const authPatch: {
    email?: string;
    password?: string;
    displayName?: string;
    disabled?: boolean;
  } = {};

  const emailChanged = input.loginEmail !== undefined && input.loginEmail !== currentUser.email;
  const passwordChanged = input.password !== undefined;
  const disabledChanged =
    input.disabled !== undefined && input.disabled !== (currentUser.disabled ?? false);

  if (input.loginEmail !== undefined) authPatch.email = input.loginEmail;
  if (input.password !== undefined) authPatch.password = input.password;
  if (input.displayName !== undefined) authPatch.displayName = input.displayName;
  if (input.disabled !== undefined) authPatch.disabled = input.disabled;

  if (
    !emailChanged &&
    !passwordChanged &&
    input.displayName === undefined &&
    !disabledChanged
  ) {
    return getDriverAccountAccess(driverId);
  }

  if (disabledChanged && input.disabled === true) {
    const activeOrders = await countActiveOrders(driverId);
    if (activeOrders > 0) {
      throw new ServiceError(
        `This driver has ${activeOrders} active order(s). Complete or reassign them before disabling login.`,
        "ACTIVE_ORDERS",
        409,
      );
    }
  }

  const previousEmail = currentUser.email;

  try {
    if (Object.keys(authPatch).length > 0) {
      await auth.updateUser(authUid, authPatch);
    }
  } catch (err) {
    throw mapFirebaseAuthError(err);
  }

  if (emailChanged || passwordChanged) {
    await auth.revokeRefreshTokens(authUid);
  }

  const now = nowIso();
  const firestorePatch: Record<string, unknown> = omitUndefined({
    accountUpdatedAt: now,
    accountUpdatedByUid: actor.uid,
    updatedAt: now,
  });

  if (emailChanged && input.loginEmail) {
    firestorePatch.email = input.loginEmail;
  }
  if (disabledChanged && input.disabled !== undefined) {
    firestorePatch.accountDisabled = input.disabled;
    if (input.disabled) {
      firestorePatch.status = "Suspended";
    }
  }

  try {
    if (Object.keys(firestorePatch).length > 0) {
      await ref.update(firestorePatch);
    }
  } catch (err) {
    console.error("[driver-account] Firestore sync failed after Auth update", {
      driverId,
      targetAuthUid: authUid,
      emailChanged,
      passwordChanged,
      disabledChanged,
    });

    if (emailChanged && previousEmail && input.loginEmail) {
      try {
        await auth.updateUser(authUid, { email: previousEmail });
        await auth.revokeRefreshTokens(authUid);
      } catch (revertErr) {
        console.error("[driver-account] Auth email revert failed", {
          driverId,
          targetAuthUid: authUid,
        });
        throw new ServiceError(
          "Login email was updated in Firebase but Firestore could not be synchronized, and automatic rollback failed. Check Firebase Console and the driver profile email manually.",
          "SYNC_FAILED",
          500,
        );
      }
      throw new ServiceError(
        "Login email was not saved to the driver profile. The previous email was restored in Firebase Authentication.",
        "SYNC_FAILED",
        500,
      );
    }

    throw new ServiceError(
      "Authentication was updated but the driver profile could not be synchronized. Refresh and verify the profile, or try again.",
      "SYNC_FAILED",
      500,
    );
  }

  await writeAuditLog({
    action: "driver.account.update",
    entityType: "driver",
    entityId: driverId,
    actorId: actor.uid,
    actorRole: actor.role,
    metadata: omitUndefined({
      driverId,
      targetAuthUid: authUid,
      accountUpdatedAt: now,
      accountUpdatedByUid: actor.uid,
      emailChanged: emailChanged || undefined,
      passwordChanged: passwordChanged || undefined,
      disabledChanged: disabledChanged || undefined,
    }),
  });

  return getDriverAccountAccess(driverId);
}
