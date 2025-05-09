export function curry<Parameter0, Parameter1, Returns,>(
  fn: (parameter0: Parameter0, parameter1: Parameter1) => Returns,
): (parameter0: Parameter0) => (parameter1: Parameter1) => Returns;
/*   return function fn0To(parameter0: Parameter0): (parameter1: Parameter1) => Returns {
    return function fn1(parameter1: Parameter1): Returns {
      return fn(parameter0, parameter1);
    };
  };
} */

export function curry<Parameter0, Parameter1, Parameter2, Returns,>(
  fn: (parameter0: Parameter0, parameter1: Parameter1, parameter2: Parameter2) => Returns,
): (
  parameter0: Parameter0,
) => (parameter1: Parameter1) => (parameter2: Parameter2) => Returns;

export function curry<Parameter0, Parameter1, Parameter2, Parameter3, Returns,>(
  fn: (parameter0: Parameter0, parameter1: Parameter1, parameter2: Parameter2,
    parameter3: Parameter3) => Returns,
): (
  parameter0: Parameter0,
) => (
  parameter1: Parameter1,
) => (parameter2: Parameter2) => (parameter3: Parameter3) => Returns;

export function curry<Parameter0, Parameter1, Parameter2, Parameter3, Parameter4,
  Returns,>(
  fn: (parameter0: Parameter0, parameter1: Parameter1, parameter2: Parameter2,
    parameter3: Parameter3, parameter4: Parameter4) => Returns,
): (
  parameter0: Parameter0,
) => (
  parameter1: Parameter1,
) => (
  parameter2: Parameter2,
) => (parameter3: Parameter3) => (parameter4: Parameter4) => Returns;

export function curry<Parameter0, Parameter1, Parameter2, Parameter3, Parameter4,
  Parameter5, Returns,>(
  fn: (parameter0: Parameter0, parameter1: Parameter1, parameter2: Parameter2,
    parameter3: Parameter3, parameter4: Parameter4, parameter5: Parameter5) => Returns,
): (
  parameter0: Parameter0,
) => (
  parameter1: Parameter1,
) => (
  parameter2: Parameter2,
) => (
  parameter3: Parameter3,
) => (parameter4: Parameter4) => (parameter5: Parameter5) => Returns;

export function curry<Parameter0, Parameter1, Parameter2, Parameter3, Parameter4,
  Parameter5, Parameter6, Returns,>(
  fn: (parameter0: Parameter0, parameter1: Parameter1, parameter2: Parameter2,
    parameter3: Parameter3, parameter4: Parameter4, parameter5: Parameter5,
    parameter6: Parameter6) => Returns,
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
) => (parameter5: Parameter5) => (parameter6: Parameter6) => Returns;

export function curry<Parameter0, Parameter1, Parameter2, Parameter3, Parameter4,
  Parameter5, Parameter6, Parameter7, Returns,>(
  fn: (parameter0: Parameter0, parameter1: Parameter1, parameter2: Parameter2,
    parameter3: Parameter3, parameter4: Parameter4, parameter5: Parameter5,
    parameter6: Parameter6, parameter7: Parameter7) => Returns,
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
) => (parameter6: Parameter6) => (parameter7: Parameter7) => Returns;

export function curry<Parameter0, Parameter1, Parameter2, Parameter3, Parameter4,
  Parameter5, Parameter6, Parameter7, Parameter8, Returns,>(
  fn: (parameter0: Parameter0, parameter1: Parameter1, parameter2: Parameter2,
    parameter3: Parameter3, parameter4: Parameter4, parameter5: Parameter5,
    parameter6: Parameter6, parameter7: Parameter7, parameter8: Parameter8) => Returns,
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
) => (parameter7: Parameter7) => (parameter8: Parameter8) => Returns;

export function curry<Parameter0, Parameter1, Parameter2, Parameter3, Parameter4,
  Parameter5, Parameter6, Parameter7, Parameter8, Parameter9, Returns,>(
  fn: (parameter0: Parameter0, parameter1: Parameter1, parameter2: Parameter2,
    parameter3: Parameter3, parameter4: Parameter4, parameter5: Parameter5,
    parameter6: Parameter6, parameter7: Parameter7, parameter8: Parameter8,
    parameter9: Parameter9) => Returns,
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
) => (parameter8: Parameter8) => (parameter9: Parameter9) => Returns;

export function curry<Parameter0, Parameter1, Parameter2, Parameter3, Parameter4,
  Parameter5, Parameter6, Parameter7, Parameter8, Parameter9, Returns,>(
  fn: (parameter0: Parameter0, parameter1: Parameter1, parameter2?: Parameter2,
    parameter3?: Parameter3, parameter4?: Parameter4, parameter5?: Parameter5,
    parameter6?: Parameter6, parameter7?: Parameter7, parameter8?: Parameter8,
    parameter9?: Parameter9) => Returns,
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
              ) => Returns | ((parameter9: Parameter9) => Returns))))))))
{
  if (fn.length === 2) {
    return function fn0To(parameter0: Parameter0): (parameter1: Parameter1) => Returns {
      return function fn1(parameter1: Parameter1): Returns {
        return fn(parameter0, parameter1);
      };
    };
  }

  if (fn.length === 3) {
    return function fn0To(
      parameter0: Parameter0,
    ): (parameter1: Parameter1) => (parameter2: Parameter2) => Returns {
      return function fn1To(parameter1: Parameter1): (parameter2: Parameter2) => Returns {
        return function fn2(parameter2: Parameter2): Returns {
          return fn(parameter0, parameter1, parameter2);
        };
      };
    };
  }

  if (fn.length === 4) {
    return function fn0To(
      parameter0: Parameter0,
    ): (
      parameter1: Parameter1,
    ) => (parameter2: Parameter2) => (parameter3: Parameter3) => Returns {
      return function fn1To(
        parameter1: Parameter1,
      ): (parameter2: Parameter2) => (parameter3: Parameter3) => Returns {
        return function fn2To(
          parameter2: Parameter2,
        ): (parameter3: Parameter3) => Returns {
          return function fn3(parameter3: Parameter3): Returns {
            return fn(parameter0, parameter1, parameter2, parameter3);
          };
        };
      };
    };
  }

  if (fn.length === 5) {
    return function fn0To(
      parameter0: Parameter0,
    ): (
      parameter1: Parameter1,
    ) => (
      parameter2: Parameter2,
    ) => (parameter3: Parameter3) => (parameter4: Parameter4) => Returns {
      return function fn1To(
        parameter1: Parameter1,
      ): (
        parameter2: Parameter2,
      ) => (parameter3: Parameter3) => (parameter4: Parameter4) => Returns {
        return function fn2To(
          parameter2: Parameter2,
        ): (parameter3: Parameter3) => (parameter4: Parameter4) => Returns {
          return function fn3To(
            parameter3: Parameter3,
          ): (parameter4: Parameter4) => Returns {
            return function fn4(parameter4: Parameter4): Returns {
              return fn(parameter0, parameter1, parameter2, parameter3, parameter4);
            };
          };
        };
      };
    };
  }

  if (fn.length === 6) {
    return function fn0To(
      parameter0: Parameter0,
    ): (
      parameter1: Parameter1,
    ) => (
      parameter2: Parameter2,
    ) => (
      parameter3: Parameter3,
    ) => (parameter4: Parameter4) => (parameter5: Parameter5) => Returns {
      return function fn1To(
        parameter1: Parameter1,
      ): (
        parameter2: Parameter2,
      ) => (
        parameter3: Parameter3,
      ) => (parameter4: Parameter4) => (parameter5: Parameter5) => Returns {
        return function fn2To(
          parameter2: Parameter2,
        ): (
          parameter3: Parameter3,
        ) => (parameter4: Parameter4) => (parameter5: Parameter5) => Returns {
          return function fn3To(
            parameter3: Parameter3,
          ): (parameter4: Parameter4) => (parameter5: Parameter5) => Returns {
            return function fn4To(
              parameter4: Parameter4,
            ): (parameter5: Parameter5) => Returns {
              return function fn5(parameter5: Parameter5): Returns {
                return fn(parameter0, parameter1, parameter2, parameter3, parameter4,
                  parameter5);
              };
            };
          };
        };
      };
    };
  }

  if (fn.length === 7) {
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
    ) => (parameter5: Parameter5) => (parameter6: Parameter6) => Returns {
      return function fn1To(
        parameter1: Parameter1,
      ): (
        parameter2: Parameter2,
      ) => (
        parameter3: Parameter3,
      ) => (
        parameter4: Parameter4,
      ) => (parameter5: Parameter5) => (parameter6: Parameter6) => Returns {
        return function fn2To(
          parameter2: Parameter2,
        ): (
          parameter3: Parameter3,
        ) => (
          parameter4: Parameter4,
        ) => (parameter5: Parameter5) => (parameter6: Parameter6) => Returns {
          return function fn3To(
            parameter3: Parameter3,
          ): (
            parameter4: Parameter4,
          ) => (parameter5: Parameter5) => (parameter6: Parameter6) => Returns {
            return function fn4To(
              parameter4: Parameter4,
            ): (parameter5: Parameter5) => (parameter6: Parameter6) => Returns {
              return function fn5To(
                parameter5: Parameter5,
              ): (parameter6: Parameter6) => Returns {
                return function fn6(parameter6: Parameter6): Returns {
                  return fn(parameter0, parameter1, parameter2, parameter3, parameter4,
                    parameter5, parameter6);
                };
              };
            };
          };
        };
      };
    };
  }

  if (fn.length === 8) {
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
    ) => (parameter6: Parameter6) => (parameter7: Parameter7) => Returns {
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
      ) => (parameter6: Parameter6) => (parameter7: Parameter7) => Returns {
        return function fn2To(
          parameter2: Parameter2,
        ): (
          parameter3: Parameter3,
        ) => (
          parameter4: Parameter4,
        ) => (
          parameter5: Parameter5,
        ) => (parameter6: Parameter6) => (parameter7: Parameter7) => Returns {
          return function fn3To(
            parameter3: Parameter3,
          ): (
            parameter4: Parameter4,
          ) => (
            parameter5: Parameter5,
          ) => (parameter6: Parameter6) => (parameter7: Parameter7) => Returns {
            return function fn4To(
              parameter4: Parameter4,
            ): (
              parameter5: Parameter5,
            ) => (parameter6: Parameter6) => (parameter7: Parameter7) => Returns {
              return function fn5To(
                parameter5: Parameter5,
              ): (parameter6: Parameter6) => (parameter7: Parameter7) => Returns {
                return function fn6To(
                  parameter6: Parameter6,
                ): (parameter7: Parameter7) => Returns {
                  return function fn7(parameter7: Parameter7): Returns {
                    return fn(parameter0, parameter1, parameter2, parameter3, parameter4,
                      parameter5, parameter6, parameter7);
                  };
                };
              };
            };
          };
        };
      };
    };
  }

  if (fn.length === 9) {
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
    ) => (parameter7: Parameter7) => (parameter8: Parameter8) => Returns {
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
      ) => (parameter7: Parameter7) => (parameter8: Parameter8) => Returns {
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
        ) => (parameter7: Parameter7) => (parameter8: Parameter8) => Returns {
          return function fn3To(
            parameter3: Parameter3,
          ): (
            parameter4: Parameter4,
          ) => (
            parameter5: Parameter5,
          ) => (
            parameter6: Parameter6,
          ) => (parameter7: Parameter7) => (parameter8: Parameter8) => Returns {
            return function fn4To(
              parameter4: Parameter4,
            ): (
              parameter5: Parameter5,
            ) => (
              parameter6: Parameter6,
            ) => (parameter7: Parameter7) => (parameter8: Parameter8) => Returns {
              return function fn5To(
                parameter5: Parameter5,
              ): (
                parameter6: Parameter6,
              ) => (parameter7: Parameter7) => (parameter8: Parameter8) => Returns {
                return function fn6To(
                  parameter6: Parameter6,
                ): (parameter7: Parameter7) => (parameter8: Parameter8) => Returns {
                  return function fn7To(
                    parameter7: Parameter7,
                  ): (parameter8: Parameter8) => Returns {
                    return function fn8(parameter8: Parameter8): Returns {
                      return fn(parameter0, parameter1, parameter2, parameter3,
                        parameter4, parameter5, parameter6, parameter7, parameter8);
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
    ) => (parameter8: Parameter8) => (parameter9: Parameter9) => Returns {
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
      ) => (parameter8: Parameter8) => (parameter9: Parameter9) => Returns {
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
        ) => (parameter8: Parameter8) => (parameter9: Parameter9) => Returns {
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
          ) => (parameter8: Parameter8) => (parameter9: Parameter9) => Returns {
            return function fn4To(
              parameter4: Parameter4,
            ): (
              parameter5: Parameter5,
            ) => (
              parameter6: Parameter6,
            ) => (
              parameter7: Parameter7,
            ) => (parameter8: Parameter8) => (parameter9: Parameter9) => Returns {
              return function fn5To(
                parameter5: Parameter5,
              ): (
                parameter6: Parameter6,
              ) => (
                parameter7: Parameter7,
              ) => (parameter8: Parameter8) => (parameter9: Parameter9) => Returns {
                return function fn6To(
                  parameter6: Parameter6,
                ): (
                  parameter7: Parameter7,
                ) => (parameter8: Parameter8) => (parameter9: Parameter9) => Returns {
                  return function fn7To(
                    parameter7: Parameter7,
                  ): (parameter8: Parameter8) => (parameter9: Parameter9) => Returns {
                    return function fn8To(
                      parameter8: Parameter8,
                    ): (parameter9: Parameter9) => Returns {
                      return function fn9(parameter9: Parameter9): Returns {
                        return fn(parameter0, parameter1, parameter2, parameter3,
                          parameter4, parameter5, parameter6, parameter7, parameter8,
                          parameter9);
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

  throw new RangeError(`unsupported fn length ${fn.length}`);
}
