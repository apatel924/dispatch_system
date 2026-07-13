import { readFileSync } from "node:fs";
import path from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { addDoc, collection, doc, getDoc } from "firebase/firestore";
import { getBytes, ref, uploadBytes } from "firebase/storage";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";

const PROJECT_ID = "quick-run-express-rules-test";
const RULES_DIR = path.resolve(__dirname);

let testEnv: RulesTestEnvironment;

function firestoreRules(): string {
  return readFileSync(path.join(RULES_DIR, "firestore.rules"), "utf8");
}

function storageRules(): string {
  return readFileSync(path.join(RULES_DIR, "storage.rules"), "utf8");
}

describe("Firebase security rules", () => {
  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { rules: firestoreRules() },
      storage: { rules: storageRules() },
    });
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.clearStorage();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  describe("Firebase Storage (deny-all)", () => {
    const proofPath = "orders/order-1/proofs/signature-123.png";

    it("denies anonymous read of proof objects", async () => {
      const storage = testEnv.unauthenticatedContext().storage();
      await assertFails(getBytes(ref(storage, proofPath)));
    });

    it("denies anonymous write of proof objects", async () => {
      const storage = testEnv.unauthenticatedContext().storage();
      await assertFails(
        uploadBytes(ref(storage, proofPath), new Uint8Array([1, 2, 3]), {
          contentType: "image/png",
        }),
      );
    });

    it("denies authenticated driver direct read of proof paths", async () => {
      const storage = testEnv
        .authenticatedContext("driver-auth-uid", {
          token: { role: "driver", driverId: "DRV-1" },
        })
        .storage();
      await assertFails(getBytes(ref(storage, proofPath)));
    });

    it("denies authenticated driver direct write to arbitrary proof paths", async () => {
      const storage = testEnv
        .authenticatedContext("driver-auth-uid", {
          token: { role: "driver", driverId: "DRV-1" },
        })
        .storage();
      await assertFails(
        uploadBytes(
          ref(storage, "orders/other-order/proofs/idVerification-999.png"),
          new Uint8Array([9, 9, 9]),
          { contentType: "image/png" },
        ),
      );
    });

    it("denies admin client SDK storage access (rules apply to all client SDK users)", async () => {
      const storage = testEnv
        .authenticatedContext("admin-auth-uid", {
          token: { role: "admin" },
        })
        .storage();
      await assertFails(getBytes(ref(storage, proofPath)));
    });
  });

  describe("Cloud Firestore (deny-all)", () => {
    it("denies anonymous read of orders", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(db, "orders", "order-1")));
    });

    it("denies anonymous read of trackingLinks", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(db, "trackingLinks", "a".repeat(64))));
    });

    it("denies anonymous write of consumerNotes subcollection", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(
        addDoc(collection(db, "orders", "order-1", "consumerNotes"), {
          orderId: "order-1",
          source: "consumer",
          text: "Leave at side door",
          createdAt: new Date().toISOString(),
          trackingLinkVersion: 1,
        }),
      );
    });

    it("denies authenticated driver direct Firestore reads", async () => {
      const db = testEnv
        .authenticatedContext("driver-auth-uid", {
          token: { role: "driver", driverId: "DRV-1" },
        })
        .firestore();
      await assertFails(getDoc(doc(db, "orders", "order-1")));
    });

    it("allows seeding test fixtures through rules-test admin context", async () => {
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await assertSucceeds(
          context.firestore().collection("orders").doc("order-1").set({
            trackingId: "QRX-TEST",
            status: "Assigned",
          }),
        );
      });
    });
  });
});
