/**
 Shared message-alias entries retain source publications without another source inventory. @module
 */

/**
 Native copy boundary supplies its actual input and output.
 */
export type SystemToolCopy = {
  readonly before: object;
  readonly after: object
};

/**
 Existing alias readers dispatch to the original publication owner.
 */
export type SystemToolOwner = {
  readonly view: object;
  readonly current: (value: object) => boolean;
  readonly copy: (input: SystemToolCopy) => void;
  readonly entry: (input: SystemToolCopy) => void;
  readonly project: (input: SystemToolCopy) => void;
  readonly convert: (input: SystemToolCopy) => void;
};

/**
 Aliases keep borrowed identities, while captured source data remains with its existing owner.
 */
export type SystemToolAlias = {
  readonly owner: SystemToolOwner;
  readonly kind: string;
  readonly message?: object;
  readonly tools?: readonly object[];
  readonly ordinal?: number;
};
