//region Original request observation failure identities.
export class RequestObservationError extends Error {
  constructor(
    message,
    options
  ){super(
    message,
    options
  );this.name=this.constructor
    .name;}
}
export class RequestObservationOwnershipError extends RequestObservationError {}
export class RequestObservationUnavailableError extends RequestObservationError {}
export class RequestObservationStaleError extends RequestObservationError {}
export class RequestObservationProfileError extends RequestObservationError {}
//endregion
