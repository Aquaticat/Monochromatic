export type $ = RegExp & {
  global: true;
};

const _a: $ = /a/g as $;

// @ts-expect-error -- Isn't global
const _b: $ = /b/;
