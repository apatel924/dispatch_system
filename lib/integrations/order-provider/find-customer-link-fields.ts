export type CustomerLinkPathClass = "strong" | "weak" | "ignore";

export interface CustomerLinkFieldScanResult {
  possibleCustomerKeyPaths: string[];
  ignoredCustomerLikePaths: string[];
  strongPaths: string[];
  weakPaths: string[];
  hasUserIdCandidate: boolean;
  hasPhoneCandidate: boolean;
  hasUsableCustomerLink: boolean;
}

const CUSTOMER_LOOKING_REGEX = /user|customer|client|phone|email|name|contact|portal/i;

const STRONG_PATHS = new Set([
  "user_id",
  "customer_id",
  "customer.id",
  "user.id",
  "phone",
  "email",
  "customer.phone",
  "customer.email",
]);

const WEAK_PATHS = new Set(["kiosk_customer_status"]);

const USER_ID_PATHS = new Set(["user_id", "customer_id", "customer.id", "user.id"]);
const PHONE_PATHS = new Set(["phone", "customer.phone"]);

function normalizeIndexedPath(path: string): string {
  return path.replace(/\.\d+(?=\.|$)/g, ".*");
}

function pathLeaf(path: string): string {
  const parts = path.split(".");
  return parts[parts.length - 1] ?? path;
}

function isIgnoredPath(path: string): boolean {
  const normalized = normalizeIndexedPath(path);
  const leaf = pathLeaf(path);

  if (/^items\.\*\.displayname$/i.test(normalized)) return true;
  if (/^items\.\*\.productName$/i.test(normalized)) return true;
  if (/^items\.\*\.name$/i.test(normalized)) return true;
  if (leaf === "productName" || leaf === "product_name") return true;

  return false;
}

function isStrongPath(path: string): boolean {
  if (STRONG_PATHS.has(path)) return true;
  return STRONG_PATHS.has(pathLeaf(path));
}

function isWeakPath(path: string): boolean {
  if (WEAK_PATHS.has(path)) return true;
  return WEAK_PATHS.has(pathLeaf(path));
}

export function classifyCustomerLinkPath(path: string): CustomerLinkPathClass | null {
  if (isIgnoredPath(path)) return "ignore";
  if (isStrongPath(path)) return "strong";
  if (isWeakPath(path)) return "weak";
  return null;
}

function looksCustomerRelated(path: string): boolean {
  return CUSTOMER_LOOKING_REGEX.test(path);
}

function walkCustomerLookingPaths(
  value: unknown,
  path = "",
  results: string[] = [],
): string[] {
  if (value === null || value === undefined) return results;

  if (Array.isArray(value)) {
    value.forEach((entry, index) => {
      const nextPath = path ? `${path}.${index}` : String(index);
      walkCustomerLookingPaths(entry, nextPath, results);
    });
    return results;
  }

  if (typeof value !== "object") return results;

  for (const key of Object.keys(value as Record<string, unknown>)) {
    const fullPath = path ? `${path}.${key}` : key;

    if (looksCustomerRelated(fullPath)) {
      results.push(fullPath);
    }

    walkCustomerLookingPaths(
      (value as Record<string, unknown>)[key],
      fullPath,
      results,
    );
  }

  return results;
}

function hasStrongUserIdPath(paths: string[]): boolean {
  return paths.some((path) => USER_ID_PATHS.has(path) || USER_ID_PATHS.has(pathLeaf(path)));
}

function hasStrongPhonePath(paths: string[]): boolean {
  return paths.some((path) => PHONE_PATHS.has(path) || PHONE_PATHS.has(pathLeaf(path)));
}

/**
 * Scans a Barnet order payload for customer-looking key paths and classifies them
 * to reduce false positives from product/item fields.
 */
export function findCustomerLinkFields(payload: unknown): CustomerLinkFieldScanResult {
  const candidates = walkCustomerLookingPaths(payload);
  const uniqueCandidates = [...new Set(candidates)];

  const strongPaths: string[] = [];
  const weakPaths: string[] = [];
  const ignoredCustomerLikePaths: string[] = [];

  for (const path of uniqueCandidates) {
    const classification = classifyCustomerLinkPath(path);
    if (classification === "ignore") {
      ignoredCustomerLikePaths.push(path);
      continue;
    }
    if (classification === "strong") {
      strongPaths.push(path);
      continue;
    }
    if (classification === "weak") {
      weakPaths.push(path);
    }
  }

  const possibleCustomerKeyPaths = [...strongPaths, ...weakPaths].sort();
  const hasUserIdCandidate = hasStrongUserIdPath(strongPaths);
  const hasPhoneCandidate = hasStrongPhonePath(strongPaths);
  const hasUsableCustomerLink = hasUserIdCandidate || hasPhoneCandidate;

  return {
    possibleCustomerKeyPaths,
    ignoredCustomerLikePaths: ignoredCustomerLikePaths.sort(),
    strongPaths: strongPaths.sort(),
    weakPaths: weakPaths.sort(),
    hasUserIdCandidate,
    hasPhoneCandidate,
    hasUsableCustomerLink,
  };
}
