/** Branded RegExp type that requires the global (`g`) flag. */
export type $ = RegExp & {
  global: true;
};

/** Compile-time test: global regex passes the brand check. */
const _a: $ = /a/g as $;

/** Compile-time test: non-global regex fails the brand check. */
// @ts-expect-error -- Isn't global
const _b: $ = /b/;
