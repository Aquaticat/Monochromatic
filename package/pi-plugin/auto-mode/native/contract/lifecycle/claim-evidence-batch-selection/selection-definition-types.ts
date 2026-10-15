/** Pinned definition contracts retain predicate text and per-definition claim identities. @module */

/** Complete fixed predicate with immutable criteria after catalog admission. */
export type QuestionDefinition = Readonly<{
  type: 'noul' | 'choice';
  instructions: string;
  criteria: Readonly<Record<string, string>>;
}>;

/** Untrusted catalog boundary and its caller-owned binding capability. */
export type QuestionCatalogInput = Readonly<{
  catalogText: unknown;
  catalogSHA256: unknown;
  resolveBinding: unknown;
  envelope: unknown;
}>;

/** Owner-local definitions and canonical handles indexed by original binding identity. */
export type QuestionCatalog = Readonly<{
  digest: string;
  definitions: ReadonlyMap<string, QuestionDefinition>;
  byDefinition: ReadonlyMap<string, WeakMap<object, Readonly<object>>>;
}>;
