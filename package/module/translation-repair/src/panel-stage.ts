import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type {
  AdjudicatedIssue,
  AdjudicationConfig,
  PanelBallot,
} from './adjudicate-model.ts';
import {
  type AdjudicationPromptPlan,
  buildAdjudicationMessages,
} from './adjudicate-prompt.ts';
import {
  ADJUDICATION_RESPONSE_FORMAT,
  isPanelBallotWire,
  resolvePanelBallot,
} from './adjudicate-wire.ts';
import type { ClaimCluster, } from './aggregate-claims.ts';
import type { SyntheticClient, } from './chat-contract.ts';
import {
  mapOverlapped,
  type OverlappedRow,
} from './overlapped-map.ts';
import { gatherStageVoices, } from './stage-quorum.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';
import { tallyVotes, } from './tally-votes.ts';

//region Cluster-local panel

/**
 * Everything the panel produced for one chunk.
 *
 * @example
 * ```ts
 * const { issues } = await runPanelStage(input);
 * ```
 */
export type PanelStageResult = {
  /**
   * Adjudicated issues in cluster document order.
   */
  readonly issues: readonly AdjudicatedIssue[];

  /**
   * Distinct panelists heard in at least one packet, for reporting only.
   * Each claim's reading retains its own ballots and configured electorate.
   */
  readonly heardPanelists: number;

  /**
   * Packet-located ballot irregularities in scorecard-stable wording.
   */
  readonly findings: readonly string[];
};

/**
 * Immutable review unit materialized before the panel makes any provider call.
 *
 * @example
 * ```ts
 * const packet: PanelPacket = { cluster, plan };
 * ```
 */
type PanelPacket = {
  /**
   * Original merge proposal with every member retained.
   */
  readonly cluster: ClaimCluster;

  /**
   * Prompt and local wire-number maps for this exact cluster.
   */
  readonly plan: AdjudicationPromptPlan;
};

/**
 * Independent tally and provenance from one packet.
 *
 * @example
 * ```ts
 * const ids = packetResult.heardIds;
 * ```
 */
type PanelPacketResult = {
  /**
   * Decisions using only this packet's ballots.
   */
  readonly issues: readonly AdjudicatedIssue[];

  /**
   * Actual responding identities, never a substituted quorum basis.
   */
  readonly heardIds: readonly RosterModelId[];

  /**
   * Packet-specific participation and wire findings.
   */
  readonly findings: readonly string[];
};

/**
 * Reviews precomputed clusters independently within one fixed panel stage.
 * Ballots cannot create another packet or change its membership. Sequential
 * packet execution bounds provider fan-out; the existing model window and
 * recovery policy remain inside each packet.
 *
 * @param client - injected provider client
 *
 * @param panelModelIds - unchanged configured electorate for every packet
 *
 * @param sourceText - current source slice defining coverage
 *
 * @param targetText - current translation being reviewed
 *
 * @param clusters - original merge proposals, fixed before any panel call
 *
 * @param adjudicationConfig - existing tally thresholds and weights
 *
 * @param neighbouringSourceText - nearby factual evidence for current claims
 *
 * @param neighbouringIncumbentText - nearby archive placement context
 *
 * @param documentSourceText - optional complete same-entry source evidence, not extra coverage
 *
 * @param signal - caller cancellation
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - parent logger
 *
 * @returns Ordered issue decisions with independent per-claim readings
 *
 * @example
 * ```ts
 * const panel = await runPanelStage(input);
 * ```
 */
export async function runPanelStage(
  {
    client,
    panelModelIds,
    sourceText,
    targetText,
    clusters,
    adjudicationConfig,
    neighbouringIncumbentText,
    neighbouringSourceText,
    documentSourceText,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly panelModelIds: readonly RosterModelId[];
    readonly sourceText: string;
    readonly targetText: string;
    readonly clusters: readonly ClaimCluster[];
    readonly adjudicationConfig?: AdjudicationConfig;
    readonly neighbouringIncumbentText?: string;
    readonly neighbouringSourceText?: string;
    readonly documentSourceText?: string;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<PanelStageResult> {
  signal.throwIfAborted();
  /**
   * Stage boundary for packet diagnostics.
   */
  const pl = tagged({
    l,
    tag: runPanelStage.name,
  });
  /**
   * All work units exist before the first asynchronous review starts.
   */
  const packets = clusters.map(function planPacket(cluster,): PanelPacket {
    return {
      cluster,
      plan: buildAdjudicationMessages({
        sourceText,
        targetText,
        clusters: [cluster,],
        ...((neighbouringSourceText === undefined) ? {} : { neighbouringSourceText, }),
        ...((neighbouringIncumbentText === undefined) ? {} : { neighbouringIncumbentText, }),
        ...((documentSourceText === undefined) ? {} : { documentSourceText, }),
      },),
    };
  },);
  pl.info(`panel stage: ${String(packets.length,)} preplanned cluster packets`);
  /**
   * Each tally observes its own packet, never the union of responding seats.
   */
  const outcomes = await mapOverlapped({
    items: packets,
    overlap: 1,
    oneItem: async function reviewPacket(
      { item: packet, }: OverlappedRow<PanelPacket>,
    ): Promise<PanelPacketResult> {
      /**
       * Function and cluster tags keep repeated panel diagnostics locatable.
       */
      const functionLogger = tagged({
        l: pl,
        tag: reviewPacket.name,
      });
      /**
       * Stable cluster identity reveals no proposer identity.
       */
      const packetLogger = tagged({
        l: functionLogger,
        tag: packet.cluster
          .clusterId,
      });
      /**
       * Original packet and its local numeric wire mapping.
       */
      const {
        cluster,
        plan,
      } = packet;
      /**
       * Existing window and recovery operate within this one preplanned packet.
       */
      const gather = await gatherStageVoices({
        client,
        modelIds: panelModelIds,
        messages: plan.messages,
        signal,
        exchangeTimeoutMs: perCallTimeoutMs,
        responseFormat: ADJUDICATION_RESPONSE_FORMAT,
        validate: isPanelBallotWire,
        stage: 'panel',
        l: packetLogger,
      },);
      /**
       * Wire indices resolve only against this packet's actual members.
       */
      const ballots: Record<string, PanelBallot> = Object.fromEntries(
        gather.voices
          .map(function ballot(voice,): readonly [
            string,
            PanelBallot
          ] {
          return [
            voice.modelId,
            resolvePanelBallot({
            wire: voice.value,
            claimIds: plan.claimIds,
            clusterIds: plan.clusterIds,
          },),
          ];
        },),
      );
      /**
       * Configured electorate remains unchanged even if another packet hears different seats.
       */
      const { issues, } = tallyVotes({
        clusters: [cluster,],
        ballots,
        configuredPanelists: panelModelIds.length,
        ...(adjudicationConfig === undefined ? {} : { config: adjudicationConfig, }),
      },);
      return {
        issues,
        heardIds: gather.voices
          .map(function identity(voice,): RosterModelId {
          return voice.modelId;
        },),
        findings: [
          ...gather.findings,
          ...Object.values(ballots,)
            .flatMap(function irregularities(ballot,): readonly string[] {
            return ballot.findings;
          },),
        ].map(function locate(finding,): string {
          return `panel-packet (${cluster.clusterId}): ${finding}`;
        },),
      };
    },
  },);
  /**
   * Distinct reporting identities do not participate in any claim's tally.
   */
  const heard = new Set(outcomes.flatMap(function identities(outcome,): readonly RosterModelId[] {
    return outcome.heardIds;
  },),);
  return {
    issues: outcomes.flatMap(function decisions(outcome,): readonly AdjudicatedIssue[] {
      return outcome.issues;
    },),
    heardPanelists: heard.size,
    findings: outcomes.flatMap(function diagnostics(outcome,): readonly string[] {
      return outcome.findings;
    },),
  };
}

//endregion Cluster-local panel
