/** Incumbent runtime failure identity remains shared with replacement operations. */
export class RuntimeOperationError extends Error {
  /** Retain native failure text and optional cause. */
  constructor(
    message: string,
    options?: ErrorOptions
  );
}
