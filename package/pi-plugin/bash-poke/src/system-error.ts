/**
 System error narrowing shared by settings loading and output spooling.

 @module
 */

//region Types

/**
 Error carrying a Node system code, which is how missing files are distinguished
 from permission or device faults without matching message text.
 
 @example
 ```ts
 const error: ErrorWithCode = Object.assign(new Error('gone'), { code: 'ENOENT', },);
 ```
 */
type ErrorWithCode = Error & {
  /**
   Node system code such as `ENOENT`.
   */
  readonly code: unknown;
};

//endregion Types

//region Guards

/**
 Narrows a caught value to an error carrying a system code.
 
 @param error - caught value from a filesystem call
 
 @returns whether a system code is readable
 
 @example
 ```ts
 isErrorWithCode(new Error('plain'));
 ```
 */
function isErrorWithCode(error: unknown, ): error is ErrorWithCode {
  return (Error.isError(error,))
    && ('code' in error);
}

/**
 Reports whether a caught value means the file simply is not there.
 
 @param error - caught value from a filesystem call
 
 @returns whether absence explains the failure
 
 @example
 ```ts
 isMissingFileCode(error, 'ENOENT');
 ```
 */
function isMissingFileCode(
  {
    error,
    code,
  }: {
    readonly error: unknown;
    readonly code: string;
  },
): boolean {
  return isErrorWithCode(error, )
    && (error.code === code);
}

//endregion Guards

export {
  isErrorWithCode,
  isMissingFileCode,
};

export type { ErrorWithCode, };
