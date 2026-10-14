/**
 Native manager observation failures remain separate from policy authorization.

 @module
 */

//region Native manager errors preserve their original diagnostic categories
/**
 Originally retained native manager observations no longer describe this case.
 */
export class NativeManagerSnapshotStaleError extends Error {
  /**
   Original native snapshot category remains stable across construction.
   */
  override readonly name = 'NativeManagerSnapshotStaleError';

  /**
   Retain the existing diagnostic for a changed original manager observation.
   */
  constructor() {
    super('Originally observed native manager epoch, leaf, session-file path, or selected branch changed');
  }
}
/**
 Declared planned identity must survive preparation and finalization.
 */
export class NativeManagerSessionIdentityError extends Error {
  /**
   Original planned-root mismatch remains distinguishable from stale observations.
   */
  override readonly name = 'NativeManagerSessionIdentityError';

  /**
   Preserve the existing planned native session diagnostic.
   */
  constructor() {
    super('Native manager session identity differs from declared planned root');
  }
}
/**
 Only the issuing adapter can accept its original opaque snapshot.
 */
export class NativeManagerSnapshotOwnershipError extends Error {
  /**
   Foreign snapshots retain their original ownership category.
   */
  override readonly name = 'NativeManagerSnapshotOwnershipError';

  /**
   Name the original adapter boundary that rejected snapshot membership.
   */
  constructor() {
    super('Native manager snapshot is not owned by this adapter');
  }
}
/**
 Unexpected SDK observation is a fatal qualification failure, never a declared rejection.
 */
export class NativeManagerObservationShapeError extends Error {
  /**
   Unexpected observations remain distinct from declared rejections.
   */
  override readonly name: string;

  /**
   Preserve the original failed native observation diagnostic.

   @param message - affected native observation and unsupported shape
   */
  constructor(message: string) {
    super(message);
    this.name = 'NativeManagerObservationShapeError';
  }
}
/**
 Expiry stops this qualification rather than becoming an expected row result.
 */
export class NativeManagerQualificationDeadlineError extends Error {
  /**
   Qualification expiry remains separate from ordinary native mismatch.
   */
  override readonly name = 'NativeManagerQualificationDeadlineError';

  /**
   Preserve the original deadline diagnostic without extending its budget.
   */
  constructor() {
    super('Original native manager qualification deadline expired');
  }
}
/**
 Original cancellation remains a fatal qualification condition.
 */
export class NativeManagerQualificationCancellationError extends Error {
  /**
   Original cancellation remains distinguishable from expiry or observation failures.
   */
  override readonly name = 'NativeManagerQualificationCancellationError';

  /**
   Retain the original cancellation reason without normalizing its value.

   @param cause - original cancellation reason, including primitive or nullish values
   */
  constructor(cause: unknown) {
    super(
      'Original native manager qualification was cancelled',
      { cause }
    );
  }
}
//endregion Native manager errors preserve their original diagnostic categories
