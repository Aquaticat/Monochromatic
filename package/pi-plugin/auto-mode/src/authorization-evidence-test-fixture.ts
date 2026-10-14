/**
 Isolated prerequisite owner and source doubles for built-artifact tests.

 @module
 */
import {
  AuthorizationEvidenceError,
  captureAuthorizationInputs,
} from '../dist/final/node/index.mjs';
import type {
  AuthorizationInputSources,
  AuthorizationSourceView,
} from './authorization-evidence-types.ts';

/** Mutable fixture condition vocabulary intentionally permits invalid test values. */
type FixtureAuthorization = { satisfaction: string; channel: string };

/** Original fixture record remains mutable for reference-substitution controls. */
type FixtureEvidence = {
  judgment: object;
  rule: object;
  source: AuthorizationSourceView;
  request: object;
  authorization: FixtureAuthorization;
};

/** Borrowed methods retain mutable identities for lifecycle tests. */
type FixtureOwner = {
  capture: () => Promise<unknown>;
  assertCurrent: (value: unknown) => void;
};

/** Explicit fixture boundary supports the repository's isolated declaration emitter. */
type AuthorizationEvidenceFixture = {
  readonly rule: object;
  readonly request: object;
  readonly judgment: object;
  readonly source: AuthorizationSourceView;
  readonly controls: { current: boolean; ownerCurrent: boolean; captures: number };
  readonly authorization: FixtureAuthorization;
  readonly evidence: FixtureEvidence;
  readonly inputs: AuthorizationInputSources;
  readonly owner: FixtureOwner;
  readonly options: {
    readonly judgment: object;
    readonly inputs: AuthorizationInputSources;
    readonly ownerFor: () => FixtureOwner;
  };
};

/**
 Construct original reference identities and independently mutable owner controls.

 @returns fresh fixture without shared session or policy state
 */
export function createAuthorizationEvidenceFixture(): AuthorizationEvidenceFixture {
  /** Each candidate and judgment has its own opaque identity. */
  const rule = {}, request = {}, judgment = {};
  /** This source view belongs to this request only. */
  const source = { sourceOccurrence: {}, request, };
  /** Mutable fixture controls distinguish input retirement from fact-owner retirement. */
  const controls = { current: true, ownerCurrent: true, captures: 0, };
  /** Facts remain mutable to verify the maintained boundary copies their primitives. */
  const authorization = { satisfaction: 'unsatisfied', channel: 'incumbent-approval', };
  /** The owner authenticates the original record identity, not equivalent copied fields. */
  const evidence = { judgment, rule, source, request, authorization, };
  /** Native-source double exposes only references and independent eligibility checking. */
  const inputs: AuthorizationInputSources = {
    instructionCandidates: [rule,],
    ruleCandidates: [rule,],
    instructionSources: [source,],
    requestObservation: request,
    readRule(candidate,) {
      if (candidate !== rule)
        throw new AuthorizationEvidenceError('Fixture candidate is not original',);
      return { sourceOccurrence: source.sourceOccurrence, };
    },
    assertCurrent() {
      if (!controls.current)
        throw new AuthorizationEvidenceError('Original inputs changed',);
    },
  };
  /** Borrowed methods can change independently of the retained evidence values. */
  const owner = {
    async capture(): Promise<unknown> {
      controls.captures++;
      return evidence;
    },
    assertCurrent(value: unknown,): void {
      if (value !== evidence)
        throw new AuthorizationEvidenceError('Original owner rejected copied evidence',);
      if (!controls.ownerCurrent)
        throw new AuthorizationEvidenceError('Original owner retired',);
    },
  };
  /** Bootstrap factory remains separate from the original evidence it selects. */
  const options = { judgment, inputs, ownerFor() { return owner; }, };
  return { rule, request, judgment, source, controls, authorization, evidence, inputs, owner, options, };
}

/**
 Preserve rejection occurrences, including falsy native exception values.

 @param options - fixture invocation for the built implementation
 @returns original rejected values, empty when capture succeeds
 */
export async function authorizationCaptureFailures(
  options: Parameters<typeof captureAuthorizationInputs>[0],
): Promise<readonly unknown[]> {
  /** Each test receives its own rejection record. */
  const failures: unknown[] = [];
  try {
    await captureAuthorizationInputs(options,);
  }
  catch (error) {
    failures.push(error,);
  }
  return failures;
}
