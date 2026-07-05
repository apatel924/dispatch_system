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
