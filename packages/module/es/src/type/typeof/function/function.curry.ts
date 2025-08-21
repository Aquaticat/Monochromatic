/** Supported parameter counts for curry function */
const MIN_CURRY_PARAMS = 2;
const MAX_CURRY_PARAMS = 10;
const CURRY_PARAMS_3 = 3;
const CURRY_PARAMS_4 = 4;
const CURRY_PARAMS_5 = 5;
const CURRY_PARAMS_6 = 6;
const CURRY_PARAMS_7 = 7;
const CURRY_PARAMS_8 = 8;
const CURRY_PARAMS_9 = 9;

/**
 * Transforms a multi-parameter function into a curried function that can be called with one argument at a time.
 * Currying allows partial application of function arguments, creating specialized functions by fixing some parameters.
 * Supports functions with 2 to 10 parameters.
 *
 * @param fn - Function to curry
 * @returns Curried function that accepts parameters one at a time
 * @throws {RangeError} If function has unsupported parameter count (not 2-10)
 *
 * @example
 * ```ts
 * // Basic currying with 2 parameters
 * const add = (a: number, b: number): number => a + b;
 * const curriedAdd = curry(add);
 * const add5 = curriedAdd(5);
 * console.log(add5(3)); // 8
 *
 * // Currying with 3 parameters
 * const multiply = (a: number, b: number, c: number): number => a * b * c;
 * const curriedMultiply = curry(multiply);
 * const multiplyBy2 = curriedMultiply(2);
 * const multiplyBy2And3 = multiplyBy2(3);
 * console.log(multiplyBy2And3(4)); // 24
 *
 * // Direct chaining
 * console.log(curriedMultiply(2)(3)(4)); // 24
 * ```
 */
export function curry<Parameter0, Parameter1, Returns,>(
  fn: (parameter0: Parameter0, parameter1: Parameter1,) => Returns,
): (parameter0: Parameter0,) => (parameter1: Parameter1,) => Returns;

export function curry<Parameter0, Parameter1, Parameter2, Returns,>(
  fn: (parameter0: Parameter0, parameter1: Parameter1,
    parameter2: Parameter2,) => Returns,
): (
  parameter0: Parameter0,
) => (parameter1: Parameter1,) => (parameter2: Parameter2,) => Returns;

export function curry<Parameter0, Parameter1, Parameter2, Parameter3, Returns,>(
  fn: (parameter0: Parameter0, parameter1: Parameter1, parameter2: Parameter2,
    parameter3: Parameter3,) => Returns,
): (
  parameter0: Parameter0,
) => (
  parameter1: Parameter1,
) => (parameter2: Parameter2,) => (parameter3: Parameter3,) => Returns;

export function curry<Parameter0, Parameter1, Parameter2, Parameter3, Parameter4,
  Returns,>(
  fn: (parameter0: Parameter0, parameter1: Parameter1, parameter2: Parameter2,
    parameter3: Parameter3, parameter4: Parameter4,) => Returns,
): (
  parameter0: Parameter0,
) => (
  parameter1: Parameter1,
) => (
  parameter2: Parameter2,
) => (parameter3: Parameter3,) => (parameter4: Parameter4,) => Returns;

export function curry<Parameter0, Parameter1, Parameter2, Parameter3, Parameter4,
  Parameter5, Returns,>(
  fn: (parameter0: Parameter0, parameter1: Parameter1, parameter2: Parameter2,
    parameter3: Parameter3, parameter4: Parameter4, parameter5: Parameter5,) => Returns,
): (
  parameter0: Parameter0,
) => (
  parameter1: Parameter1,
) => (
  parameter2: Parameter2,
) => (
  parameter3: Parameter3,
) => (parameter4: Parameter4,) => (parameter5: Parameter5,) => Returns;

export function curry<Parameter0, Parameter1, Parameter2, Parameter3, Parameter4,
  Parameter5, Parameter6, Returns,>(
  fn: (parameter0: Parameter0, parameter1: Parameter1, parameter2: Parameter2,
    parameter3: Parameter3, parameter4: Parameter4, parameter5: Parameter5,
    parameter6: Parameter6,) => Returns,
): (
  parameter0: Parameter0,
) => (
  parameter1: Parameter1,
) => (
  parameter2: Parameter2,
) => (
  parameter3: Parameter3,
) => (
  parameter4: Parameter4,
) => (parameter5: Parameter5,) => (parameter6: Parameter6,) => Returns;

export function curry<Parameter0, Parameter1, Parameter2, Parameter3, Parameter4,
  Parameter5, Parameter6, Parameter7, Returns,>(
  fn: (parameter0: Parameter0, parameter1: Parameter1, parameter2: Parameter2,
    parameter3: Parameter3, parameter4: Parameter4, parameter5: Parameter5,
    parameter6: Parameter6, parameter7: Parameter7,) => Returns,
): (
  parameter0: Parameter0,
) => (
  parameter1: Parameter1,
) => (
  parameter2: Parameter2,
) => (
  parameter3: Parameter3,
) => (
  parameter4: Parameter4,
) => (
  parameter5: Parameter5,
) => (parameter6: Parameter6,) => (parameter7: Parameter7,) => Returns;

export function curry<Parameter0, Parameter1, Parameter2, Parameter3, Parameter4,
  Parameter5, Parameter6, Parameter7, Parameter8, Returns,>(
  fn: (parameter0: Parameter0, parameter1: Parameter1, parameter2: Parameter2,
    parameter3: Parameter3, parameter4: Parameter4, parameter5: Parameter5,
    parameter6: Parameter6, parameter7: Parameter7, parameter8: Parameter8,) => Returns,
): (
  parameter0: Parameter0,
) => (
  parameter1: Parameter1,
) => (
  parameter2: Parameter2,
) => (
  parameter3: Parameter3,
) => (
  parameter4: Parameter4,
) => (
  parameter5: Parameter5,
) => (
  parameter6: Parameter6,
) => (parameter7: Parameter7,) => (parameter8: Parameter8,) => Returns;

export function curry<Parameter0, Parameter1, Parameter2, Parameter3, Parameter4,
  Parameter5, Parameter6, Parameter7, Parameter8, Parameter9, Returns,>(
  fn: (parameter0: Parameter0, parameter1: Parameter1, parameter2: Parameter2,
    parameter3: Parameter3, parameter4: Parameter4, parameter5: Parameter5,
    parameter6: Parameter6, parameter7: Parameter7, parameter8: Parameter8,
    parameter9: Parameter9,) => Returns,
): (
  parameter0: Parameter0,
) => (
  parameter1: Parameter1,
) => (
  parameter2: Parameter2,
) => (
  parameter3: Parameter3,
) => (
  parameter4: Parameter4,
) => (
  parameter5: Parameter5,
) => (
  parameter6: Parameter6,
) => (
  parameter7: Parameter7,
) => (parameter8: Parameter8,) => (parameter9: Parameter9,) => Returns;

export function curry<Parameter0, Parameter1, Parameter2, Parameter3, Parameter4,
  Parameter5, Parameter6, Parameter7, Parameter8, Parameter9, Returns,>(
  fn: (parameter0: Parameter0, parameter1: Parameter1, parameter2?: Parameter2,
    parameter3?: Parameter3, parameter4?: Parameter4, parameter5?: Parameter5,
    parameter6?: Parameter6, parameter7?: Parameter7, parameter8?: Parameter8,
    parameter9?: Parameter9,) => Returns,
): (
  parameter0: Parameter0,
) => (
  parameter1: Parameter1,
) =>
  | Returns
  | ((
    parameter2: Parameter2,
  ) =>
    | Returns
    | ((
      parameter3: Parameter3,
    ) =>
      | Returns
      | ((
        parameter4: Parameter4,
      ) =>
        | Returns
        | ((
          parameter5: Parameter5,
        ) =>
          | Returns
          | ((
            parameter6: Parameter6,
          ) =>
            | Returns
            | ((
              parameter7: Parameter7,
            ) =>
              | Returns
              | ((
                parameter8: Parameter8,
              ) => Returns | ((parameter9: Parameter9,) => Returns))))))))
{
  if (fn.length === 2) {
    return function fn0To(parameter0: Parameter0,): (parameter1: Parameter1,) => Returns {
      return function fn1(parameter1: Parameter1,): Returns {
        return fn(parameter0, parameter1,);
      };
    };
  }

  if (fn.length === CURRY_PARAMS_3) {
    return function fn0To(
      parameter0: Parameter0,
    ): (parameter1: Parameter1,) => (parameter2: Parameter2,) => Returns {
      return function fn1To(
        parameter1: Parameter1,
      ): (parameter2: Parameter2,) => Returns {
        return function fn2(parameter2: Parameter2,): Returns {
          return fn(parameter0, parameter1, parameter2,);
        };
      };
    };
  }

  if (fn.length === CURRY_PARAMS_4) {
    return function fn0To(
      parameter0: Parameter0,
    ): (
      parameter1: Parameter1,
    ) => (parameter2: Parameter2,) => (parameter3: Parameter3,) => Returns {
      return function fn1To(
        parameter1: Parameter1,
      ): (parameter2: Parameter2,) => (parameter3: Parameter3,) => Returns {
        return function fn2To(
          parameter2: Parameter2,
        ): (parameter3: Parameter3,) => Returns {
          return function fn3(parameter3: Parameter3,): Returns {
            return fn(parameter0, parameter1, parameter2, parameter3,);
          };
        };
      };
    };
  }

  if (fn.length === CURRY_PARAMS_5) {
    return function fn0To(
      parameter0: Parameter0,
    ): (
      parameter1: Parameter1,
    ) => (
      parameter2: Parameter2,
    ) => (parameter3: Parameter3,) => (parameter4: Parameter4,) => Returns {
      return function fn1To(
        parameter1: Parameter1,
      ): (
        parameter2: Parameter2,
      ) => (parameter3: Parameter3,) => (parameter4: Parameter4,) => Returns {
        return function fn2To(
          parameter2: Parameter2,
        ): (parameter3: Parameter3,) => (parameter4: Parameter4,) => Returns {
          return function fn3To(
            parameter3: Parameter3,
          ): (parameter4: Parameter4,) => Returns {
            return function fn4(parameter4: Parameter4,): Returns {
              return fn(parameter0, parameter1, parameter2, parameter3, parameter4,);
            };
          };
        };
      };
    };
  }

  if (fn.length === CURRY_PARAMS_6) {
    return function fn0To(
      parameter0: Parameter0,
    ): (
      parameter1: Parameter1,
    ) => (
      parameter2: Parameter2,
    ) => (
      parameter3: Parameter3,
    ) => (parameter4: Parameter4,) => (parameter5: Parameter5,) => Returns {
      return function fn1To(
        parameter1: Parameter1,
      ): (
        parameter2: Parameter2,
      ) => (
        parameter3: Parameter3,
      ) => (parameter4: Parameter4,) => (parameter5: Parameter5,) => Returns {
        return function fn2To(
          parameter2: Parameter2,
        ): (
          parameter3: Parameter3,
        ) => (parameter4: Parameter4,) => (parameter5: Parameter5,) => Returns {
          return function fn3To(
            parameter3: Parameter3,
          ): (parameter4: Parameter4,) => (parameter5: Parameter5,) => Returns {
            return function fn4To(
              parameter4: Parameter4,
            ): (parameter5: Parameter5,) => Returns {
              return function fn5(parameter5: Parameter5,): Returns {
                return fn(parameter0, parameter1, parameter2, parameter3, parameter4,
                  parameter5,);
              };
            };
          };
        };
      };
    };
  }

  if (fn.length === CURRY_PARAMS_7) {
    return function fn0To(
      parameter0: Parameter0,
    ): (
      parameter1: Parameter1,
    ) => (
      parameter2: Parameter2,
    ) => (
      parameter3: Parameter3,
    ) => (
      parameter4: Parameter4,
    ) => (parameter5: Parameter5,) => (parameter6: Parameter6,) => Returns {
      return function fn1To(
        parameter1: Parameter1,
      ): (
        parameter2: Parameter2,
      ) => (
        parameter3: Parameter3,
      ) => (
        parameter4: Parameter4,
      ) => (parameter5: Parameter5,) => (parameter6: Parameter6,) => Returns {
        return function fn2To(
          parameter2: Parameter2,
        ): (
          parameter3: Parameter3,
        ) => (
          parameter4: Parameter4,
        ) => (parameter5: Parameter5,) => (parameter6: Parameter6,) => Returns {
          return function fn3To(
            parameter3: Parameter3,
          ): (
            parameter4: Parameter4,
          ) => (parameter5: Parameter5,) => (parameter6: Parameter6,) => Returns {
            return function fn4To(
              parameter4: Parameter4,
            ): (parameter5: Parameter5,) => (parameter6: Parameter6,) => Returns {
              return function fn5To(
                parameter5: Parameter5,
              ): (parameter6: Parameter6,) => Returns {
                return function fn6(parameter6: Parameter6,): Returns {
                  return fn(parameter0, parameter1, parameter2, parameter3, parameter4,
                    parameter5, parameter6,);
                };
              };
            };
          };
        };
      };
    };
  }

  if (fn.length === CURRY_PARAMS_8) {
    return function fn0To(
      parameter0: Parameter0,
    ): (
      parameter1: Parameter1,
    ) => (
      parameter2: Parameter2,
    ) => (
      parameter3: Parameter3,
    ) => (
      parameter4: Parameter4,
    ) => (
      parameter5: Parameter5,
    ) => (parameter6: Parameter6,) => (parameter7: Parameter7,) => Returns {
      return function fn1To(
        parameter1: Parameter1,
      ): (
        parameter2: Parameter2,
      ) => (
        parameter3: Parameter3,
      ) => (
        parameter4: Parameter4,
      ) => (
        parameter5: Parameter5,
      ) => (parameter6: Parameter6,) => (parameter7: Parameter7,) => Returns {
        return function fn2To(
          parameter2: Parameter2,
        ): (
          parameter3: Parameter3,
        ) => (
          parameter4: Parameter4,
        ) => (
          parameter5: Parameter5,
        ) => (parameter6: Parameter6,) => (parameter7: Parameter7,) => Returns {
          return function fn3To(
            parameter3: Parameter3,
          ): (
            parameter4: Parameter4,
          ) => (
            parameter5: Parameter5,
          ) => (parameter6: Parameter6,) => (parameter7: Parameter7,) => Returns {
            return function fn4To(
              parameter4: Parameter4,
            ): (
              parameter5: Parameter5,
            ) => (parameter6: Parameter6,) => (parameter7: Parameter7,) => Returns {
              return function fn5To(
                parameter5: Parameter5,
              ): (parameter6: Parameter6,) => (parameter7: Parameter7,) => Returns {
                return function fn6To(
                  parameter6: Parameter6,
                ): (parameter7: Parameter7,) => Returns {
                  return function fn7(parameter7: Parameter7,): Returns {
                    return fn(parameter0, parameter1, parameter2, parameter3, parameter4,
                      parameter5, parameter6, parameter7,);
                  };
                };
              };
            };
          };
        };
      };
    };
  }

  if (fn.length === CURRY_PARAMS_9) {
    return function fn0To(
      parameter0: Parameter0,
    ): (
      parameter1: Parameter1,
    ) => (
      parameter2: Parameter2,
    ) => (
      parameter3: Parameter3,
    ) => (
      parameter4: Parameter4,
    ) => (
      parameter5: Parameter5,
    ) => (
      parameter6: Parameter6,
    ) => (parameter7: Parameter7,) => (parameter8: Parameter8,) => Returns {
      return function fn1To(
        parameter1: Parameter1,
      ): (
        parameter2: Parameter2,
      ) => (
        parameter3: Parameter3,
      ) => (
        parameter4: Parameter4,
      ) => (
        parameter5: Parameter5,
      ) => (
        parameter6: Parameter6,
      ) => (parameter7: Parameter7,) => (parameter8: Parameter8,) => Returns {
        return function fn2To(
          parameter2: Parameter2,
        ): (
          parameter3: Parameter3,
        ) => (
          parameter4: Parameter4,
        ) => (
          parameter5: Parameter5,
        ) => (
          parameter6: Parameter6,
        ) => (parameter7: Parameter7,) => (parameter8: Parameter8,) => Returns {
          return function fn3To(
            parameter3: Parameter3,
          ): (
            parameter4: Parameter4,
          ) => (
            parameter5: Parameter5,
          ) => (
            parameter6: Parameter6,
          ) => (parameter7: Parameter7,) => (parameter8: Parameter8,) => Returns {
            return function fn4To(
              parameter4: Parameter4,
            ): (
              parameter5: Parameter5,
            ) => (
              parameter6: Parameter6,
            ) => (parameter7: Parameter7,) => (parameter8: Parameter8,) => Returns {
              return function fn5To(
                parameter5: Parameter5,
              ): (
                parameter6: Parameter6,
              ) => (parameter7: Parameter7,) => (parameter8: Parameter8,) => Returns {
                return function fn6To(
                  parameter6: Parameter6,
                ): (parameter7: Parameter7,) => (parameter8: Parameter8,) => Returns {
                  return function fn7To(
                    parameter7: Parameter7,
                  ): (parameter8: Parameter8,) => Returns {
                    return function fn8(parameter8: Parameter8,): Returns {
                      return fn(parameter0, parameter1, parameter2, parameter3,
                        parameter4, parameter5, parameter6, parameter7, parameter8,);
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
  }

  if (fn.length === 10) {
    return function fn0To(
      parameter0: Parameter0,
    ): (
      parameter1: Parameter1,
    ) => (
      parameter2: Parameter2,
    ) => (
      parameter3: Parameter3,
    ) => (
      parameter4: Parameter4,
    ) => (
      parameter5: Parameter5,
    ) => (
      parameter6: Parameter6,
    ) => (
      parameter7: Parameter7,
    ) => (parameter8: Parameter8,) => (parameter9: Parameter9,) => Returns {
      return function fn1To(
        parameter1: Parameter1,
      ): (
        parameter2: Parameter2,
      ) => (
        parameter3: Parameter3,
      ) => (
        parameter4: Parameter4,
      ) => (
        parameter5: Parameter5,
      ) => (
        parameter6: Parameter6,
      ) => (
        parameter7: Parameter7,
      ) => (parameter8: Parameter8,) => (parameter9: Parameter9,) => Returns {
        return function fn2To(
          parameter2: Parameter2,
        ): (
          parameter3: Parameter3,
        ) => (
          parameter4: Parameter4,
        ) => (
          parameter5: Parameter5,
        ) => (
          parameter6: Parameter6,
        ) => (
          parameter7: Parameter7,
        ) => (parameter8: Parameter8,) => (parameter9: Parameter9,) => Returns {
          return function fn3To(
            parameter3: Parameter3,
          ): (
            parameter4: Parameter4,
          ) => (
            parameter5: Parameter5,
          ) => (
            parameter6: Parameter6,
          ) => (
            parameter7: Parameter7,
          ) => (parameter8: Parameter8,) => (parameter9: Parameter9,) => Returns {
            return function fn4To(
              parameter4: Parameter4,
            ): (
              parameter5: Parameter5,
            ) => (
              parameter6: Parameter6,
            ) => (
              parameter7: Parameter7,
            ) => (parameter8: Parameter8,) => (parameter9: Parameter9,) => Returns {
              return function fn5To(
                parameter5: Parameter5,
              ): (
                parameter6: Parameter6,
              ) => (
                parameter7: Parameter7,
              ) => (parameter8: Parameter8,) => (parameter9: Parameter9,) => Returns {
                return function fn6To(
                  parameter6: Parameter6,
                ): (
                  parameter7: Parameter7,
                ) => (parameter8: Parameter8,) => (parameter9: Parameter9,) => Returns {
                  return function fn7To(
                    parameter7: Parameter7,
                  ): (parameter8: Parameter8,) => (parameter9: Parameter9,) => Returns {
                    return function fn8To(
                      parameter8: Parameter8,
                    ): (parameter9: Parameter9,) => Returns {
                      return function fn9(parameter9: Parameter9,): Returns {
                        return fn(parameter0, parameter1, parameter2, parameter3,
                          parameter4, parameter5, parameter6, parameter7, parameter8,
                          parameter9,);
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    };
  }

  throw new RangeError(`unsupported fn length ${fn.length}`,);
}
