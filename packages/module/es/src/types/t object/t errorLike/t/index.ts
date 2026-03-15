/** Structural type for error-like objects with `name`, `message`, and `cause` properties. */
export type $ = { name: string; message: string;
  // oxlint-disable-next-line typescript/no-explicit-any -- cause must be any for direct logging compatibility
  cause: any; };
