// PROTOTYPE ONLY: Candidate K and L concurrent author wave.

import type { SyntheticClient, } from './chat-contract.ts';
import { runLeanRealizationAuthorNode, } from './prototype-lean-realization-author-node.ts';
import { leanRealizationAuthorMessages, } from './prototype-lean-realization-prompt.ts';
import { runReviewUnitAuthorNode, } from './prototype-review-unit-author-node.ts';
import type { ReviewUnitManifest, } from './prototype-review-unit-model.ts';
import { reviewUnitAuthorMessages, } from './prototype-review-unit-prompt.ts';
import { awaitReviewUnitWave, } from './prototype-review-unit-runtime-support.ts';
import type { ReviewUnitAuthorState, } from './prototype-review-unit-settlement.ts';
import type { PrototypeMedia, } from './prototype-brief-editor-input.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';
import type { RealizationObligationLedger, } from './prototype-realization-model.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';

/**
 * Executes every manifest-authorized author concurrently.
 *
 * @returns Complete sibling terminal states in manifest order
 *
 * @example
 * ```ts
 * const states = await runReviewUnitAuthorWave({ outputDir, client, manifest, expectedManifestDigest, shell, ledger, reviewPlan, sourceText, archiveText, media, sourcePictures, restart, signal, });
 * ```
 */
export async function runReviewUnitAuthorWave({
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
  readonly manifest: ReviewUnitManifest;
  readonly expectedManifestDigest: string;
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
  readonly reviewPlan: ReviewUnitPlan;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly media: readonly PrototypeMedia[];
  readonly sourcePictures: readonly { readonly assetName: string }[];
  readonly restart: boolean;
  readonly signal: AbortSignal;
}): Promise<readonly ReviewUnitAuthorState[]> {
  return await awaitReviewUnitWave({
    nodes: manifest.candidatePlan
      .map(async function author(plan,) {
      /**
       * Candidate L lean or Candidate K audit-bearing author messages.
       */
      const messages = manifest.authorMode === 'lean-realization'
        ? leanRealizationAuthorMessages({
          plan,
          manifest,
          shell,
          reviewPlan,
          sourceText,
          archiveText,
          media,
        })
        : reviewUnitAuthorMessages({
          plan,
          manifest,
          shell,
          reviewPlan,
          sourceText,
          archiveText,
          media,
        });
      /**
       * Shared author-node inputs after protocol selection.
       */
      const input = {
        outputDir,
        client,
        plan,
        manifest,
        expectedManifestDigest,
        messages,
        shell,
        ledger,
        reviewPlan,
        sourceText,
        archiveText,
        sourcePictures,
        restart,
        signal,
      };
      return manifest.authorMode === 'lean-realization'
        ? await runLeanRealizationAuthorNode(input,)
        : await runReviewUnitAuthorNode(input,);
    },),
    signal,
  });
}
