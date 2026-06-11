/**
 * Branded type for finite numbers (excludes `Infinity`, `-Infinity`, and `NaN`).
 */
export type $ = number & {
  __brand: {
    finite: true;
  };
};
