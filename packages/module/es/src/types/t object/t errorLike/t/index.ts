/** Structural type for error-like objects with `name`, `message`, and `cause` properties. */
export type $ = { name: string; message: string;
  /* any here because we frequently wanna directly log */
  cause: any; };
