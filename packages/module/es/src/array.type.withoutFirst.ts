/* @__NO_SIDE_EFFECTS__ */
export type WithoutFirst<T extends any[]> = T extends [any, ...infer Rest]
  ? Rest
  : T extends readonly [any, ...infer Rest]
    ? Rest
    : T extends Array<infer U>
      ? U[]
      : never;

/* @__NO_SIDE_EFFECTS__ */
export type WithoutFirst2<T extends any[]> = T extends [any, any, ...infer Rest]
  ? Rest
  : T extends readonly [any, any, ...infer Rest]
    ? Rest
    : T extends [any, ...infer Rest]
      ? WithoutFirst<Rest>
      : T extends Array<infer U>
        ? U[]
        : never;

/* @__NO_SIDE_EFFECTS__ */
export type WithoutFirst3<T extends any[]> = T extends [any, any, any, ...infer Rest]
  ? Rest
  : T extends readonly [any, any, any, ...infer Rest]
    ? Rest
    : T extends [any, any, ...infer Rest]
      ? WithoutFirst<Rest>
      : T extends [any, ...infer Rest]
        ? WithoutFirst2<Rest>
        : T extends Array<infer U>
          ? U[]
          : never;

/* @__NO_SIDE_EFFECTS__ */
export type WithoutFirst4<T extends any[]> = T extends [any, any, any, any, ...infer Rest]
  ? Rest
  : T extends readonly [any, any, any, any, ...infer Rest]
    ? Rest
    : T extends [any, any, any, ...infer Rest]
      ? WithoutFirst<Rest>
      : T extends [any, any, ...infer Rest]
        ? WithoutFirst2<Rest>
        : T extends [any, ...infer Rest]
          ? WithoutFirst3<Rest>
          : T extends Array<infer U>
            ? U[]
            : never;

/* @__NO_SIDE_EFFECTS__ */
export type WithoutFirst5<T extends any[]> = T extends [any, any, any, any, any, ...infer Rest]
  ? Rest
  : T extends readonly [any, any, any, any, any, ...infer Rest]
    ? Rest
    : T extends [any, any, any, any, ...infer Rest]
      ? WithoutFirst<Rest>
      : T extends [any, any, any, ...infer Rest]
        ? WithoutFirst2<Rest>
        : T extends [any, any, ...infer Rest]
          ? WithoutFirst3<Rest>
          : T extends [any, ...infer Rest]
            ? WithoutFirst4<Rest>
            : T extends Array<infer U>
              ? U[]
              : never;

/* @__NO_SIDE_EFFECTS__ */
export type WithoutFirst6<T extends any[]> = T extends [any, any, any, any, any, any, ...infer Rest]
  ? Rest
  : T extends readonly [any, any, any, any, any, any, ...infer Rest]
    ? Rest
    : T extends [any, any, any, any, any, ...infer Rest]
      ? WithoutFirst<Rest>
      : T extends [any, any, any, any, ...infer Rest]
        ? WithoutFirst2<Rest>
        : T extends [any, any, any, ...infer Rest]
          ? WithoutFirst3<Rest>
          : T extends [any, any, ...infer Rest]
            ? WithoutFirst4<Rest>
            : T extends [any, ...infer Rest]
              ? WithoutFirst5<Rest>
              : T extends Array<infer U>
                ? U[]
                : never;

/* @__NO_SIDE_EFFECTS__ */
export type WithoutFirst7<T extends any[]> = T extends [any, any, any, any, any, any, any, ...infer Rest]
  ? Rest
  : T extends readonly [any, any, any, any, any, any, any, ...infer Rest]
    ? Rest
    : T extends [any, any, any, any, any, any, ...infer Rest]
      ? WithoutFirst<Rest>
      : T extends [any, any, any, any, any, ...infer Rest]
        ? WithoutFirst2<Rest>
        : T extends [any, any, any, any, ...infer Rest]
          ? WithoutFirst3<Rest>
          : T extends [any, any, any, ...infer Rest]
            ? WithoutFirst4<Rest>
            : T extends [any, any, ...infer Rest]
              ? WithoutFirst5<Rest>
              : T extends [any, ...infer Rest]
                ? WithoutFirst6<Rest>
                : T extends Array<infer U>
                  ? U[]
                  : never;

/* @__NO_SIDE_EFFECTS__ */
export type WithoutFirst8<T extends any[]> = T extends [any, any, any, any, any, any, any, any, ...infer Rest]
  ? Rest
  : T extends readonly [any, any, any, any, any, any, any, any, ...infer Rest]
    ? Rest
    : T extends [any, any, any, any, any, any, any, ...infer Rest]
      ? WithoutFirst<Rest>
      : T extends [any, any, any, any, any, any, ...infer Rest]
        ? WithoutFirst2<Rest>
        : T extends [any, any, any, any, any, ...infer Rest]
          ? WithoutFirst3<Rest>
          : T extends [any, any, any, any, ...infer Rest]
            ? WithoutFirst4<Rest>
            : T extends [any, any, any, ...infer Rest]
              ? WithoutFirst5<Rest>
              : T extends [any, any, ...infer Rest]
                ? WithoutFirst6<Rest>
                : T extends [any, ...infer Rest]
                  ? WithoutFirst7<Rest>
                  : T extends Array<infer U>
                    ? U[]
                    : never;

/* @__NO_SIDE_EFFECTS__ */
export type WithoutFirst9<T extends any[]> = T extends [any, any, any, any, any, any, any, any, any, ...infer Rest]
  ? Rest
  : T extends readonly [any, any, any, any, any, any, any, any, any, ...infer Rest]
    ? Rest
    : T extends [any, any, any, any, any, any, any, any, ...infer Rest]
      ? WithoutFirst<Rest>
      : T extends [any, any, any, any, any, any, any, ...infer Rest]
        ? WithoutFirst2<Rest>
        : T extends [any, any, any, any, any, any, ...infer Rest]
          ? WithoutFirst3<Rest>
          : T extends [any, any, any, any, any, ...infer Rest]
            ? WithoutFirst4<Rest>
            : T extends [any, any, any, any, ...infer Rest]
              ? WithoutFirst5<Rest>
              : T extends [any, any, any, ...infer Rest]
                ? WithoutFirst6<Rest>
                : T extends [any, any, ...infer Rest]
                  ? WithoutFirst7<Rest>
                  : T extends [any, ...infer Rest]
                    ? WithoutFirst8<Rest>
                    : T extends Array<infer U>
                      ? U[]
                      : never;

/* @__NO_SIDE_EFFECTS__ */
export type WithoutFirst10<T extends any[]> = T extends [any, any, any, any, any, any, any, any, any, any, ...infer Rest]
  ? Rest
  : T extends readonly [any, any, any, any, any, any, any, any, any, any, ...infer Rest]
    ? Rest
    : T extends [any, any, any, any, any, any, any, any, any, ...infer Rest]
      ? WithoutFirst<Rest>
      : T extends [any, any, any, any, any, any, any, any, ...infer Rest]
        ? WithoutFirst2<Rest>
        : T extends [any, any, any, any, any, any, any, ...infer Rest]
          ? WithoutFirst3<Rest>
          : T extends [any, any, any, any, any, any, ...infer Rest]
            ? WithoutFirst4<Rest>
            : T extends [any, any, any, any, any, ...infer Rest]
              ? WithoutFirst5<Rest>
              : T extends [any, any, any, any, ...infer Rest]
                ? WithoutFirst6<Rest>
                : T extends [any, any, any, ...infer Rest]
                  ? WithoutFirst7<Rest>
                  : T extends [any, any, ...infer Rest]
                    ? WithoutFirst8<Rest>
                    : T extends [any, ...infer Rest]
                      ? WithoutFirst9<Rest>
                      : T extends Array<infer U>
                        ? U[]
                        : never;
