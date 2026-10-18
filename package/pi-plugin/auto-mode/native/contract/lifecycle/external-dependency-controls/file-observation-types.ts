/**
 Descriptor-bound observations expose completed owned bytes to synchronous consumers.
 @module
 */

//region Input scope and bounded reads remain explicit at the observer boundary.
/**
 Original descriptor and bounded destination supplied to a controlled reader.
 */
export type FileReadInput={
  /**
   Original descriptor opened by the observation owner.
   */
  readonly fd:number;
  /**
   Owner-allocated bounded destination.
   */
  readonly buffer:Buffer;
  /**
   Next destination position.
   */
  readonly offset:number;
  /**
   Remaining destination capacity.
   */
  readonly length:number;
  /**
   Original file position.
   */
  readonly position:number;
};
/**
 Declared file selection retains its original root and exact permission mode.
 */
export type FileObservationInput={
  /**
   Independently owned selection root.
   */
  readonly root:string;
  /**
   Selected path relative to that root.
   */
  readonly relativePath:string;
  /**
   Exact required permission bits.
   */
  readonly requiredMode:number;
  /**
   Maximum admitted bytes before allocation; null preserves complete selected instruction files.
   */
  readonly maxBytes?:number|null;
  /**
   Optional fixture-owned synchronous read interception.
   */
  readonly read?:(input:FileReadInput)=>number;
};
//endregion

//region Observed bytes retain descriptor identity without claiming instruction authority.
/**
 Completed observation consumed before the surrounding freshness operation yields.
 */
export type FileObservation={
  /**
   Original selected relative path.
   */
  readonly relativePath:string;
  /**
   Exact descriptor device identity.
   */
  readonly dev:bigint;
  /**
   Exact descriptor inode identity.
   */
  readonly ino:bigint;
  /**
   Observed permission bits.
   */
  readonly mode:number;
  /**
   Copied completed bytes, owned by this observation.
   */
  readonly bytes:Buffer;
};
//endregion
