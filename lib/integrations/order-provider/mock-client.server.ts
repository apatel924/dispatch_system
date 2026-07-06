import type { ExternalProviderOrder } from "@/lib/integrations/order-provider/types";

const MOCK_PROVIDER = "mock-external-provider";

/**
 * Returns realistic fake delivery orders for scaffold testing.
 * No network calls; no real customer or provider data.
 */
export function fetchMockProviderOrders(): ExternalProviderOrder[] {
  const placedAt = new Date().toISOString();

  return [
    {
      id: "ext-ord-1001",
      orderNumber: "MOCK-1001",
      status: "confirmed",
      deliveryStatus: "pending_pickup",
      isDelivery: true,
      total: 4280,
      placedAt,
      customer: { name: "Alex Morgan", phone: "+1-555-0101" },
      pickupAddress: "220 Commerce St, Austin, TX 78701",
      deliveryAddress: "1450 Lakeview Blvd, Austin, TX 78704",
      deliveryInstructions: "Leave at front desk",
      items: [
        { name: "Office Supply Kit", quantity: 1, unitPrice: 2499, notes: null },
        { name: "Thermal Labels (100pk)", quantity: 2, unitPrice: 890, notes: null },
      ],
    },
    {
      id: "ext-ord-1002",
      orderNumber: "MOCK-1002",
      status: "in_progress",
      deliveryStatus: "out_for_delivery",
      isDelivery: true,
      total: 6750,
      placedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      customer: { name: "Jordan Lee", phone: "+1-555-0102" },
      pickupAddress: "88 Warehouse Row, Dallas, TX 75201",
      deliveryAddress: "903 River Oaks Dr, Dallas, TX 75219",
      deliveryInstructions: "Call on arrival",
      items: [
        { name: "Catering Tray - Veggie", quantity: 3, unitPrice: 1850, notes: "No onions" },
        { name: "Beverage Pack", quantity: 1, unitPrice: 1200, notes: null },
      ],
    },
    {
      id: "ext-ord-1003",
      orderNumber: "MOCK-1003",
      status: "completed",
      deliveryStatus: "delivered",
      isDelivery: true,
      total: 3199,
      placedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      customer: { name: "Sam Rivera", phone: "+1-555-0103" },
      pickupAddress: "15 Market Square, Houston, TX 77002",
      deliveryAddress: "612 Oak Meadow Ln, Houston, TX 77019",
      deliveryInstructions: null,
      items: [
        { name: "Pharmacy Pickup", quantity: 1, unitPrice: 3199, notes: "Signature required" },
      ],
    },
    {
      id: "ext-ord-1004",
      orderNumber: "MOCK-1004",
      status: "confirmed",
      deliveryStatus: "scheduled",
      isDelivery: true,
      total: 5425,
      placedAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
      customer: { name: "Taylor Brooks", phone: "+1-555-0104" },
      pickupAddress: "401 Industrial Pkwy, San Antonio, TX 78205",
      deliveryAddress: "77 Sunset Ridge, San Antonio, TX 78209",
      deliveryInstructions: "Gate code 4421",
      items: [
        { name: "Retail Restock Box A", quantity: 2, unitPrice: 1599, notes: null },
        { name: "Retail Restock Box B", quantity: 1, unitPrice: 2227, notes: "Fragile" },
      ],
    },
    {
      id: "ext-ord-1005",
      orderNumber: "MOCK-1005",
      status: "cancelled",
      deliveryStatus: null,
      isDelivery: true,
      total: 1899,
      placedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      customer: { name: "Casey Nguyen", phone: "+1-555-0105" },
      pickupAddress: "12 Depot Way, Fort Worth, TX 76102",
      deliveryAddress: "500 Meadow Creek Ct, Fort Worth, TX 76107",
      deliveryInstructions: null,
      items: [
        { name: "Document Courier Envelope", quantity: 1, unitPrice: 1899, notes: null },
      ],
    },
  ];
}

export function getMockProviderName(): string {
  return MOCK_PROVIDER;
}
