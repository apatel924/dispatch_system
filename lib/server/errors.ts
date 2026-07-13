export class ServiceError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status = 400) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.status = status;
  }
}

export function notFoundError(entity: string, id: string): ServiceError {
  return new ServiceError(`${entity} not found: ${id}`, "NOT_FOUND", 404);
}

export function forbiddenError(message = "Forbidden"): ServiceError {
  return new ServiceError(message, "FORBIDDEN", 403);
}

export function trackingInvalidError(message = "This tracking link is not valid."): ServiceError {
  return new ServiceError(message, "TRACKING_INVALID", 404);
}

export function trackingExpiredError(
  message = "This tracking link has expired.",
): ServiceError {
  return new ServiceError(message, "TRACKING_EXPIRED", 410);
}

export function trackingRevokedError(
  message = "This tracking link is no longer active.",
): ServiceError {
  return new ServiceError(message, "TRACKING_REVOKED", 403);
}

export function rateLimitedError(
  message = "Too many requests. Please try again later.",
): ServiceError {
  return new ServiceError(message, "RATE_LIMITED", 429);
}

export function payloadTooLargeError(
  message = "Uploaded file is too large.",
): ServiceError {
  return new ServiceError(message, "PAYLOAD_TOO_LARGE", 413);
}

export function conflictError(message = "Conflict"): ServiceError {
  return new ServiceError(message, "CONFLICT", 409);
}
