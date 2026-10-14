//region Private native-manager mechanical errors confer no permission.
/** Originally retained native manager observations no longer describe this case. */
export class NativeManagerSnapshotStaleError extends Error {
  constructor() { super('Originally observed native manager epoch, leaf, session-file path, or selected branch changed'); this.name = NativeManagerSnapshotStaleError.name; }
}
/** Declared planned identity must survive preparation and finalization. */
export class NativeManagerSessionIdentityError extends Error {
  constructor() { super('Native manager session identity differs from declared planned root'); this.name = NativeManagerSessionIdentityError.name; }
}
/** Only the issuing adapter can accept its original opaque snapshot. */
export class NativeManagerSnapshotOwnershipError extends Error {
  constructor() { super('Native manager snapshot is not owned by this adapter'); this.name = NativeManagerSnapshotOwnershipError.name; }
}
/** Unexpected SDK observation is a fatal qualification failure, never a declared rejection. */
export class NativeManagerObservationShapeError extends Error {
  constructor(message) { super(message); this.name = NativeManagerObservationShapeError.name; }
}
/** Expiry stops this qualification rather than becoming an expected row result. */
export class NativeManagerQualificationDeadlineError extends Error {
  constructor() { super('Original native manager qualification deadline expired'); this.name = NativeManagerQualificationDeadlineError.name; }
}
/** Original cancellation remains a fatal qualification condition. */
export class NativeManagerQualificationCancellationError extends Error {
  constructor(cause) { super('Original native manager qualification was cancelled', { cause }); this.name = NativeManagerQualificationCancellationError.name; }
}
//endregion
