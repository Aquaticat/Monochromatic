export class RootLeaseError extends Error {constructor(
  message,
  options
){super(
  message,
  options
);this.name=this.constructor
  .name;}}
export class RootLeaseOwnershipError extends RootLeaseError {}
export class RootLeaseSuspendedError extends RootLeaseError {}
export class RootLeaseRetiredError extends RootLeaseError {}
export class RootTransitionError extends RootLeaseError {}
