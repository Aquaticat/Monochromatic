import type {PolicySourceSpan} from '../../policy-index-types.ts';

/** Retain source spans and selected material without replacing source ownership. */
export function captureDecisionMaterial(input:Readonly<{
  sources:unknown;
  input:unknown;
}>):Readonly<{
  excluded?:readonly PolicySourceSpan[];
  material?:unknown;
  failure?:unknown;
}>;
