// PROTOTYPE ONLY: Candidate M concurrent risk-attested author wave.

import type { SyntheticClient, } from './chat-contract.ts';
import { riskAttestedAuthorMessages, } from './prototype-risk-challenger-author-prompt.ts';
import { runRiskAttestedAuthorNode, } from './prototype-risk-challenger-author-node.ts';
import type { CandidateMManifest, } from './prototype-risk-challenger-manifest-model.ts';
import type { CandidateMAuthorState, } from './prototype-risk-challenger-model.ts';
import { awaitReviewUnitWave, } from './prototype-review-unit-runtime-support.ts';
import type { PrototypeMedia, } from './prototype-brief-editor-input.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';
import type { RealizationObligationLedger, } from './prototype-realization-model.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';

/**
 * Executes both Candidate M authors concurrently.
 *
 * @returns Complete sibling terminal states in manifest order
 *
 * @example
 * ```ts
 * const states = await runRiskAttestedAuthorWave({ outputDir, client, manifest, expectedManifestDigest, shell, ledger, reviewPlan, sourceText, archiveText, media, sourcePictures, restart, signal, });
 * ```
 */
export async function runRiskAttestedAuthorWave({
  outputDir,
  client,
  manifest,
  expectedManifestDigest,
  shell,
  ledger,
  reviewPlan,
  sourceText,
  archiveText,
  media,
  sourcePictures,
  restart,
  signal,
}: {
  readonly outputDir: string;
  readonly client: SyntheticClient;
  readonly manifest: CandidateMManifest;
  readonly expectedManifestDigest: string;
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
  readonly reviewPlan: ReviewUnitPlan;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly media: readonly PrototypeMedia[];
  readonly sourcePictures: readonly { readonly assetName: string; }[];
  readonly restart: boolean;
  readonly signal: AbortSignal;
}): Promise<readonly CandidateMAuthorState[]> {
  return await awaitReviewUnitWave({
    nodes: manifest.candidatePlan
      .map(async function author(plan,) {
      return await runRiskAttestedAuthorNode({
        outputDir,
        client,
        plan,
        manifest,
        expectedManifestDigest,
        messages: riskAttestedAuthorMessages({
          plan,
          manifest,
          shell,
          reviewPlan,
          sourceText,
          archiveText,
          media,
        },),
        shell,
        ledger,
        reviewPlan,
        sourceText,
        archiveText,
        sourcePictures,
        restart,
        signal,
      },);
    },),
    signal,
  },);
}
