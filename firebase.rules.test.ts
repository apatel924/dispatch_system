import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const RULES_DIR = path.resolve(__dirname);

function ruleFile(name: string): string {
  return readFileSync(path.join(RULES_DIR, name), "utf8");
}

function compactRules(rules: string): string {
  return rules.replace(/\s+/g, " ").trim();
}

describe("Firebase security rules", () => {
  describe("Firebase Storage (deny-all)", () => {
    const storageRules = compactRules(ruleFile("storage.rules"));

    it("targets Firebase Storage rules v2", () => {
      expect(storageRules).toContain("rules_version = '2';");
      expect(storageRules).toContain("service firebase.storage");
    });

    it("matches all storage object paths", () => {
      expect(storageRules).toContain("match /b/{bucket}/o");
      expect(storageRules).toContain("match /{allPaths=**}");
    });

    it("denies all direct client SDK reads and writes", () => {
      expect(storageRules).toContain("allow read, write: if false;");
      expect(storageRules).not.toMatch(/allow\s+(read|write|read,\s*write):\s*if\s+true/);
    });
  });

  describe("Cloud Firestore (deny-all)", () => {
    const firestoreRules = compactRules(ruleFile("firestore.rules"));

    it("targets Cloud Firestore rules v2", () => {
      expect(firestoreRules).toContain("rules_version = '2';");
      expect(firestoreRules).toContain("service cloud.firestore");
    });

    it("matches every document path", () => {
      expect(firestoreRules).toContain("match /databases/{database}/documents");
      expect(firestoreRules).toContain("match /{document=**}");
    });

    it("denies direct client SDK reads and writes for all collections", () => {
      expect(firestoreRules).toContain("allow read, write: if false;");
      expect(firestoreRules).not.toMatch(/allow\s+(read|write|read,\s*write):\s*if\s+true/);
    });
  });
});
