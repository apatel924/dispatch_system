/** Safe normalized customer fields — no raw Barnet user payload. */
export interface NormalizedBarnetCustomer {
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  /** Parsed shipping address fallback only; dispatch prefers order address fields. */
  customerAddress: string | null;
}

function coerceString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function resolveCustomerName(record: Record<string, unknown>): string | null {
  const displayName = coerceString(record.display_name);
  if (displayName) return displayName;

  const fullName = coerceString(record.full_name);
  if (fullName) return fullName;

  const firstName = coerceString(record.first_name);
  const lastName = coerceString(record.last_name);
  if (firstName || lastName) {
    return [firstName, lastName].filter(Boolean).join(" ").trim() || null;
  }

  return null;
}

function resolveCustomerPhone(record: Record<string, unknown>): string | null {
  return coerceString(record.phone) ?? coerceString(record.ap_phone);
}

function resolveCustomerEmail(record: Record<string, unknown>): string | null {
  return coerceString(record.email) ?? coerceString(record.ap_email);
}

function buildShippingAddress(record: Record<string, unknown>): string | null {
  const shipping = record.shipping_address ?? record.shipping;
  if (shipping && typeof shipping === "object" && !Array.isArray(shipping)) {
    const addr = shipping as Record<string, unknown>;
    const parts = [
      coerceString(addr.address ?? addr.street ?? addr.line1),
      coerceString(addr.city),
      coerceString(addr.state),
      coerceString(addr.zip ?? addr.postal_code),
    ].filter((part): part is string => part !== null);
    if (parts.length > 0) return parts.join(", ");
  }

  const parts = [
    coerceString(record.shipping_address),
    coerceString(record.shipping_city),
    coerceString(record.shipping_state),
    coerceString(record.shipping_zip),
  ].filter((part): part is string => part !== null);

  return parts.length > 0 ? parts.join(", ") : null;
}

/**
 * Maps a Barnet GET /user response into safe normalized customer fields.
 * Never returns the raw payload.
 */
export function normalizeBarnetCustomer(raw: unknown): NormalizedBarnetCustomer {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      customerName: null,
      customerPhone: null,
      customerEmail: null,
      customerAddress: null,
    };
  }

  const record = raw as Record<string, unknown>;

  return {
    customerName: resolveCustomerName(record),
    customerPhone: resolveCustomerPhone(record),
    customerEmail: resolveCustomerEmail(record),
    customerAddress: buildShippingAddress(record),
  };
}
