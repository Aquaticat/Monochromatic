/**
 Native JavaScript exception producers for query observation tests.

 @module
 */

/**
 Suspend a native execution context whose throw method accepts unrestricted JavaScript values.

 @returns iterator that is never normally advanced by the failure fixture
 */
function* nativeExceptionTarget(): Generator<string> {
  yield 'Unentered native execution context';
}

/**
 Inject a foreign exception through the native generator API, rather than constructing an owned error.
 Falsy values and proxies are valid inputs to Generator.prototype.throw.

 @param value - exact simulated native exception

 @example
 ```ts
 const failures = thrownValues(() => { throwNativeValue(false); });
 // failures contains the original false exception.
 ```
 */
export function throwNativeValue(value: unknown,): void {
  /**
   Fresh suspended-start iterator throws its input without entering the body.
   */
  const target = nativeExceptionTarget();
  target.throw(value,);
}

/**
 Record thrown occurrences without confusing undefined with a normal return.

 @param run - tested operation

 @returns original thrown-value occurrences, empty on normal return

 @example
 ```ts
 const failures = thrownValues(() => { throwNativeValue(undefined); });
 // failures has an occurrence even though its value is undefined.
 ```
 */
export function thrownValues(run: () => void,): readonly unknown[] {
  /**
   Test-local list retains exact values without formatting them.
   */
  const values: unknown[] = [];
  try {
    run();
  }
  catch (error) {
    values.push(error,);
  }
  return values;
}
