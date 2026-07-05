import type { MockProviderPayload } from "@/lib/server/validation/import";

/** Shared mock payloads — not live provider APIs */
export const MOCK_IMPORT_FIXTURES = {
  "mock-uber": {
    externalId: "UBER-9F23K",
    customer: "Acme Manufacturing",
    phone: "(555) 123-4567",
    address: "1200 Industrial Blvd, Dallas, TX 75201",
    pickupName: "Northside Pharmacy",
    pickupAddress: "4821 Main St, Dallas, TX 75206",
    totalCents: 12850,
    notes: "Deliver to receiving dock",
  },
  "mock-doordash": {
    externalId: "DOORDASH-7721",
    customer: "Northside Pharmacy",
    phone: "(555) 234-5678",
    address: "4821 Main St, Dallas, TX 75206",
    pickupName: "Quick-Run Express Hub",
    pickupAddress: "11823 170 St NW, Edmonton, AB",
    totalCents: 4520,
  },
  "mock-amazon": {
    externalId: "AMZ-19KD2",
    customer: "Global Office Supplies",
    phone: "(555) 345-6789",
    address: "3100 McKinney Ave, Dallas, TX 75204",
    pickupName: "Amazon Locker",
    pickupAddress: "3100 McKinney Ave, Dallas, TX 75204",
    totalCents: 8999,
  },
} as const satisfies Record<string, MockProviderPayload>;

export type MockImportSource = keyof typeof MOCK_IMPORT_FIXTURES;
