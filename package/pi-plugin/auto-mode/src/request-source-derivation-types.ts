/** Original request field derivations retain source occurrences without assigning authority. @module */
import type { SourceContribution } from './source-contribution-types.ts';

/** One complete serialized field refers to its existing original contribution occurrences. */
export type RequestDerivationField = {
  readonly field: 'messages' | 'tools';
  readonly ordinal: number;
  readonly contributions: readonly object[];
};

/** Native serialization accounts for every supported prose field at its existing JSON parse boundary. */
export type RequestDerivationFields = {
  readonly profile: 'native-text-messages-and-tool-declarations';
  readonly messageCount: number;
  readonly toolCount: number;
  readonly fields: readonly RequestDerivationField[];
};

/** The original request owner binds its field proof to its exact contribution list. */
export type RequestSourceDerivation = RequestDerivationFields & {
  readonly request: object;
  readonly contributions: readonly SourceContribution[];
};

/** Represented instructions still require their own admitted meanings, authority and scope. */
export type RequestGoverningUse = {
  readonly request: object;
  readonly state: 'represented-by-original-inputs' | 'unresolved';
  readonly permission: false;
};
