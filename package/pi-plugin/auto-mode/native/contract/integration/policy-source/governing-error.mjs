/** Failure shared by source bindings without importing their collectors. */
export class GoverningPolicyBindingError extends Error {
  constructor(message, options) {
    super(message, options);
    this.name = this.constructor.name;
  }
}
