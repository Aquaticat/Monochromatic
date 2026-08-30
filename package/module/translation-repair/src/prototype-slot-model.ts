// PROTOTYPE ONLY: Candidate D immutable-shell data model and envelopes.

export const MAX_SLOT_CHARACTERS = 20_000;
export const MAX_COMPILED_DOCUMENT_CHARACTERS = 200_000;

export type ImmutableSlot = {
  readonly key: string;
  readonly kind: 'text' | 'image-alt';
  readonly parentKind: string;
  readonly source: string;
  readonly startOffset: number;
  readonly endOffset: number;
};

export type ImmutableShell = {
  readonly frontMatter: string;
  readonly body: string;
  readonly slots: readonly ImmutableSlot[];
  readonly controlDocument: string;
  readonly shellDigest: string;
};

export type SlotDocumentResponse = {
  readonly slots: Readonly<Record<string, string>>;
};
