/**
 * Branded string type indicating the value has quoted syntax (single, double, or backtick).
 */
export type $ = string & {
  __brand: {
    hasQuotedSyntax: true;
  };
};
