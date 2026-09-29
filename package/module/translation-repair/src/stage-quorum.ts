import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ChatMessage, } from '@monochromatic-dev/module-llm-type/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type {
  JsonSchemaResponseFormat,
  SyntheticClient,
} from './chat-contract.ts';
import {
  askingWindow,
  type FanOutMode,
  rotatedBench,
} from './stage-fanout-window.ts';
import {
  reachableQuorum,
  shortBenchStageFinding,
} from './stage-reachable-quorum.ts';
import {
  RECOVERY_NUDGES,
  UNREADABLE_CAUSES,
  type UnreadableCause,
} from './recovery-nudge.ts';
import type { StageDecision, } from './stage-decision-call.ts';
import { runGatherRound, } from './stage-round.ts';
import { stageQuorumUnmetFinding, } from './stage-silence.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';

//region Stage quorum
// A stage that loses voices retries exactly the lost ones on fresh
// deadlines (user directive: quota regenerates faster than runs spend, so
// forfeiting voices cheaply leaves capacity unused). Retries stop at
// QUORUM, at least half the roster rounded up, for every stage. A roster
// still short after every round proceeds with what it has and records the
// degradation as findings.
//
// WAITING FOR THE WHOLE ROSTER IS NOT AN OPTION HERE, and used to be. The
// editor and refiner stages passed `retryTarget: 'full-roster'` from
// 2026-08-12 until the user removed the option outright on 2026-08-14:
// waiting on every voice makes one provider-side model degrading for a day
// block every stage that seats it, spending four deadlines per gather on a
// voice that will not come. The property full-roster was chosen to protect,
// no stage decided by a single model, is what the quorum aims at: at least
// two voices (`MIN_STAGE_VOICES`), and editors, refiners and checkers sit at
// three. It is a retry target, not a floor: a gather still short after every
// round proceeds on what it heard and records the shortfall, so one voice can
// still decide a stage then (XingZ6014 slice 87 resolved an issue on one
// usable ballot before ledger L8 stopped an empty report counting as heard).
//
// Critics never used it either, by a separate user decision on 2026-07-23,
// for the same reason stated locally: waiting on a complete roster stalls a
// run when a voice wedges.

/**
 Retry rounds after the initial fan-out;
 the milestone-one benchmark showed one fresh attempt recovers most
 forfeits, and three rounds bound the worst stage wall time at four
 deadlines.
 */
export const STAGE_RETRY_ROUNDS = 3;

/**
 One heard voice with its speaker.
 
 @example
 ```ts
 const voice: HeardVoice<CriticReportWire> = { modelId, value: report, };
 ```
 */
export type HeardVoice<ValueT,> = {
  /**
   Model that answered.
   */
  readonly modelId: RosterModelId;

  /**
   Validated reply value.
   */
  readonly value: ValueT;
};

/**
 Everything a quorum gather produced.
 
 @example
 ```ts
 const { voices, quorumMet, } = await gatherStageVoices({ ... },);
 ```
 */
export type StageGather<ValueT,> = {
  /**
   Heard voices in arrival-round then roster order.
   */
  readonly voices: readonly HeardVoice<ValueT>[];

  /**
   Whether at least half the roster, rounded up, was heard; on a bench
   short of that for want of wet providers, at least half the reachable
   seats and never fewer than two (`reachableQuorum`, 2026-09-09).
   */
  readonly quorumMet: boolean;

  /**
   Degradation findings in scorecard-stable wording;
   empty when quorum was met.
   */
  readonly findings: readonly string[];

  /**
   Seats some round asked, so a caller taking its majority over "everyone
   asked" counts the window, not the bench: a seat the window spared was
   never silent.
   */
  readonly asked: ReadonlySet<RosterModelId>;

  /**
   Seats the router refused because no wet provider serves them, so a
   caller sizing its minimum by the reachable bench (the select stage since
   the owner's decision of 2026-09-09) counts the bench that could answer
   rather than the bench that was seated.
   */
  readonly unreachable: ReadonlySet<RosterModelId>;

  /**
   Seats that answered but nothing could read, still unread after the
   recovery round: a reply the completion cap cut before its content, or a
   shape the guard refused. They were reached and they answered, so a
   caller telling an outage from a bench it could not read counts them as
   answering. On 2026-09-16 Mio13 was interrupted `provider-unavailable`
   at 4 of 12 heard with every provider wet, seven seats having spent
   their whole completion cap reasoning about one chat translation and
   sent no content (class thirty-one).
   */
  readonly unreadable: ReadonlySet<RosterModelId>;
};

/**
 What the rounds produced: the voices heard, which seats were asked at
 all, so the findings can tell a seat the window spared from one that was
 asked and stayed quiet, which seats no provider served, and which
 answered in a shape nothing could read.
 */
type RoundsOutcome<ValueT,> = {
  /**
   Voices heard across every round.
   */
  readonly collected: readonly HeardVoice<ValueT>[];

  /**
   Seats some round asked.
   */
  readonly asked: ReadonlySet<RosterModelId>;

  /**
   Seats the router refused for want of a wet provider.
   */
  readonly unreachable: ReadonlySet<RosterModelId>;

  /**
   Seats whose answers stayed unreadable after the recovery round.
   */
  readonly unreadable: ReadonlySet<RosterModelId>;
};

/**
 Fans one prompt out to a roster and retries lost voices to quorum.
 Since 2026-09-09 the first round asks a window of quorum plus one spare
 from the bench rotated by the prompt (`stage-fanout-window.ts`), and
 each later round asks the seats not yet asked before the ones it lost,
 on fresh deadlines; the loop stops as soon as half the roster, rounded
 up, is heard, and otherwise ends when the retry rounds are spent.
 
 @param client - injected model client
 
 @param modelIds - stage roster
 
 @param messages - prompt shared by every voice
 
 @param signal - caller abort honored by every exchange
 
 @param exchangeTimeoutMs - deadline per exchange
 
 @param maxAnswerChars - bound on one answer, when the caller knows how
 large its own input was
 
 @param responseFormat - structured-output constraint
 
 @param validate - client-side schema guard
 
 @param stage - stage label for logging and findings
 
 @param l - logger of the calling stage
 
 @param maxRetryRounds - rounds after the initial fan-out;
 defaults to {@link STAGE_RETRY_ROUNDS}
 
 @param graceMs - window a straggler gets after quorum before the round
 abandons it; defaults to `STRAGGLER_GRACE_MS` and exists so a test can bound
 its own wall time
 
 @param fanOut - whether a round asks the window of quorum plus one, the
 production default, or the whole bench a fixture scripting every seat asks for
 
 @returns Heard voices plus quorum verdict and degradation findings
 
 @example
 ```ts
 const gather = await gatherStageVoices({ ..., stage: 'critic', l, },);
 ```
 */
export async function gatherStageVoices<ValueT,>(
  {
    client,
    modelIds,
    messages,
    signal,
    exchangeTimeoutMs,
    maxAnswerChars,
    responseFormat,
    validate,
    stage,
    l,
    maxRetryRounds = STAGE_RETRY_ROUNDS,
    graceMs,
    fanOut = 'window',
    decision,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly modelIds: readonly RosterModelId[];
    readonly messages: readonly ChatMessage[];
    readonly signal: AbortSignal;
    readonly exchangeTimeoutMs: number;
    readonly maxAnswerChars?: number;
    readonly responseFormat: JsonSchemaResponseFormat;
    readonly validate: (value: unknown,) => value is ValueT;
    readonly stage: string;
    readonly l: Logger;
    readonly maxRetryRounds?: number;
    readonly graceMs?: number;
    readonly fanOut?: FanOutMode;
    readonly decision?: StageDecision;
  }>,
): Promise<StageGather<ValueT>> {
  /**
   Voices a quorum needs: at least half the roster, rounded up, sized on
   the seats a wet provider serves once the router has named the rest.
   
   Was "strictly more than half", which differs only on EVEN rosters and was
   costing a round there. At six models the old rule demanded 4 while this
   demands 3; at seven both demand 4, so odd rosters are unaffected. User
   decision 2026-08-05, taken when the roster shrank to six: exactly half of
   an even panel is a quorum.
   
   SIZED ON THE REACHABLE BENCH SINCE 2026-09-09 (`reachableQuorum`): a
   seat the router refuses for want of a wet provider is not a voice the
   gather can wait for, and counting it cost `hulicaijia` its entry that
   evening.
   
   @param unreachable - seats the router has refused so far
   
   @returns Heard voices the gather needs to close
   */
  function quorumNeededWith(unreachable: number,): number {
    /**
     Quorum on the bench as read so far.
     */
    const quorumNow = reachableQuorum({
      benchSize: modelIds.length,
      unreachable,
    },);
    return quorumNow.needed;
  }

  /**
   Heard voices accumulated across rounds;
   the round cursor lives inside the named IIFE so its mutation never
   leaks into the surrounding scope.
   */
  const rounds: RoundsOutcome<ValueT> = await (async function collectRounds(): Promise<RoundsOutcome<ValueT>> {
    /**
     Voices collected so far.
     */
    const collected: HeardVoice<ValueT>[] = [];

    /**
     Seats some round asked, so a seat the window spared is never reported
     as lost.
     */
    const asked = new Set<RosterModelId>();

    /**
     Seats the router refused because no wet provider serves them.
     */
    const unreachableSeats = new Set<RosterModelId>();

    /**
     Seats whose latest answer nothing could read, across every round, each
     with why, which picks its recovery wording (ledger P10): a seat leaves the
     moment some round hears it.
     */
    const unreadableSeats = new Map<RosterModelId, UnreadableCause>();

    /**
     Everything a round needs except who to ask and how many to wait for.
     
     Hoisted so the recovery round below cannot drift from the quorum rounds
     above: they differ in exactly two fields, and writing the other ten twice
     is how the two would eventually disagree about a deadline or a guard.
     */
    const roundRequest = {
      client,
      messages,
      signal,
      exchangeTimeoutMs,
      ...((maxAnswerChars === undefined) ? {} : { maxAnswerChars, }),
      responseFormat,
      validate,
      stage,
      l,
      ...((graceMs === undefined) ? {} : { graceMs, }),
      // Conditional spread keeps the question absent instead of undefined.
      ...((decision === undefined) ? {} : { decision, }),
    };

    /**
     Models still owing a reply: not yet asked first, then lost, so a fresh
     seat is tried before a seat that just failed.
     */
    let pending: readonly RosterModelId[] = rotatedBench({
      modelIds,
      messages,
    },);

    for (let round = 0; round <= maxRetryRounds; round += 1) {
      if (pending.length === 0)
        break;
      /**
       Voices this round still needs to close, on the bench as the router
       has read it so far.
       */
      const quorumNeeded = quorumNeededWith(unreachableSeats.size,);
      if ((round > 0) && (collected.length >= quorumNeeded))
        break;
      /**
       Seats this round asks: what quorum still needs plus the spare, from
       the front of the pending order.
       */
      const asking = (fanOut === 'whole-bench')
        ? pending
        : askingWindow({
          pending,
          needed: quorumNeeded - collected.length,
        },);
      if (round > 0) {
        l.warn(
          `${stage}: retry round ${String(round,)} asking ${String(asking.length,)} of ${
            String(pending.length,)
          } pending voices`,
        );
      }

      /* oxlint-disable no-await-in-loop -- rounds are sequential by design: each round asks the seats the previous round left unasked or lost */
      /**
       This round's outcomes, one per asked model, with anything still in
       flight a grace period after quorum abandoned rather than waited on.
       */
      const outcomes = await runGatherRound<ValueT>({
        ...roundRequest,
        modelIds: asking,
        // A REFUSED SEAT HANDS ITS PLACE TO THE NEXT PENDING ONE in this
        // round (`stage-round.ts`), so the seats past the window are its
        // reserve and the ones it took leave `pending` below.
        reserve: pending.slice(asking.length,),
        heardNeeded: quorumNeeded - collected.length,
      },);
      /* oxlint-enable no-await-in-loop */
      for (const { modelId, } of outcomes)
        asked.add(modelId,);

      /**
       Models this round still lost.
       */
      const stillLost: RosterModelId[] = [];

      /**
       Models this round lost to an answer nothing could read.
       */
      const answeredBadly: RosterModelId[] = [];
      for (const outcome of outcomes) {
        if (outcome.voice
          .heard) {
          collected.push({
            modelId: outcome.modelId,
            value: outcome.voice
              .value,
          },);
          unreadableSeats.delete(outcome.modelId,);
          continue;
        }
        stillLost.push(outcome.modelId,);
        if (outcome.voice
          .unreachable)
          unreachableSeats.add(outcome.modelId,);
        if (outcome.voice
          .answered) {
          answeredBadly.push(outcome.modelId,);
          unreadableSeats.set(
            outcome.modelId,
            outcome.voice
              .unreadable,
          );
        }
      }
      // A SEAT THE ROUTER REFUSED IS NOT RE-ASKED. Nothing changes between
      // rounds for a seat no wet provider serves, and re-queuing it spent
      // `hulicaijia`'s retry rounds on Qwen3.8-27B, Kimi-K3 and glm-5.3
      // (2026-09-09) while the seats that could answer waited.
      //
      // NOR IS A SEAT THAT ANSWERED UNREADABLY, until the recovery round
      // (ledger P2). A retry round sends the same prompt, which the
      // prompt-uniqueness cache answers with the same bytes, and the loop
      // once overwrote its list of such seats every round, so a seat that
      // answered badly and was then silent on the re-ask fell off it
      // (TianqiChen66620 slice 15 settled 2 to 2 with one lost).
      pending = [
        ...pending.slice(outcomes.length,),
        ...stillLost.filter(function stillOwed(modelId,): boolean {
          return (!unreachableSeats.has(modelId,)) && (!answeredBadly.includes(modelId,));
        },),
      ];
    }

    /**
     Seats still unreadable after every quorum round, in roster order: every
     seat whose latest answer nothing could read, whichever round it came in.
     SEPARATE FROM `pending`, because the two are re-asked for opposite
     reasons. A pending model is one quorum still NEEDS. One of these is a
     model whose voice is recoverable, since an answer arrived: whole with
     only the shape defeating the guard, or cut at the length limit.
     */
    const unreadable = modelIds.filter(function stillUnreadable(modelId,): boolean {
      return unreadableSeats.has(modelId,);
    },);

    // ONE RECOVERY ROUND, OUTSIDE THE QUORUM LOOP AND AFTER IT.
    //
    // The loop above stops the moment quorum stands, which is correct for what
    // it is for and is why nothing it re-asks has ever been re-asked: measured
    // over 109 rounds of a ten-model roster on 2026-08-25, the first fan-out
    // met quorum every time, 1054 voices of 1090 were heard, 31 rounds lost at
    // least one, and zero retry rounds ran.
    //
    // Thirteen of those 36 losses were the model ANSWERING in a shape nothing
    // could read, spread over 7 distinct slices of 15 with at most 2 on any
    // one, so no input reliably breaks a model. The other 23 were silence,
    // which `doc/audit/where-a-round-spends-its-wall-clock.md` measures to be a
    // model still thinking. Re-asking both would spend the expensive half to
    // recover the cheap half, so only the answered half is re-asked here.
    //
    // ONE ROUND, NEVER A LADDER. A model that formats badly twice is telling us
    // something about itself rather than about the weather, and the calibration
    // is what answers that.
    if (unreadable.length > 0) {
      /**
       The unreadable seats grouped by what happened to them, in
       `UNREADABLE_CAUSES` order; a cause no seat has asks nobody.
       */
      const byCause = UNREADABLE_CAUSES
        .map(function seatsWith(cause,): {
          readonly cause: UnreadableCause;
          readonly modelIds: readonly RosterModelId[];
        } {
          return {
            cause,
            modelIds: unreadable.filter(function hasCause(modelId,): boolean {
              return unreadableSeats.get(modelId,) === cause;
            },),
          };
        },)
        .filter(function asksSomeone(group,): boolean {
          return group.modelIds
            .length
            > 0;
        },);
      l.warn(
        `${stage}: recovery round for ${String(unreadable.length,)} unreadable answers (${
          byCause
            .map(function describe(group,): string {
              return `${String(group.modelIds
                .length,)} ${group.cause}`;
            },)
            .join(', ',)
        })`,
      );

      /**
       Second reading of the voices that finished but could not be read.

       NEEDING NONE OF THEM IS THE BOUND. Quorum usually stands by now, and
       where the quorum rounds ran out short the recovered voices still count
       toward it; either way this round is entitled to no more than a
       straggler window: `heardNeeded: 0` leaves
       `runGatherRound` with nothing to wait for, which opens the grace window
       at once and abandons whatever has not arrived when it closes. Asking
       for all of them instead would let one re-ask that hangs hold the whole
       gather for a full exchange deadline, which is six minutes in a run and
       the opposite of what a recovery is for.

       ONE ROUND PER WORDING, RUN TOGETHER (ledger P10): a round carries one
       prompt, and each group's prompt names what happened to it; both open
       their windows at once, so the pair costs one window, not two.

       A voice that comes back promptly is still collected: the window
       resolves as soon as every ask settles.
       */
      const recovered = (await Promise.all(byCause.map(async function recoverGroup(group,) {
        return await runGatherRound<ValueT>({
          ...roundRequest,
          // A DIFFERENT PROMPT, OR THE ROUND BUYS NOTHING. `promptUniqueClient`
          // serves a second call for the same model and prompt from its cache,
          // schema mismatch included, so re-sending the same bytes came back
          // with the same unreadable answer in 0 to 1 ms every time it was
          // measured (five recovery rounds over two passes on
          // 2026-09-02). The nudge tells the model what happened and makes the
          // digest new.
          messages: [
            ...messages,
            RECOVERY_NUDGES[group.cause],
          ],
          modelIds: group.modelIds,
          heardNeeded: 0,
        },);
      },),))
        .flat();

      for (const outcome of recovered) {
        if (outcome.voice
          .heard) {
          collected.push({
            modelId: outcome.modelId,
            value: outcome.voice
              .value,
          },);
          unreadableSeats.delete(outcome.modelId,);
        }
      }

      /**
       Re-asked voices that came back readable, counted on their own line so
       the round's value can be read off a run log without pairing gather
       lines by hand (the owner kept the round on 2026-09-03, and
       this is what says whether it earns its call).
       */
      const recoveredHeard = recovered.filter(function heard(outcome,): boolean {
        return outcome.voice
          .heard;
      },);
      l.info(
        `${stage}: recovery round heard ${String(recoveredHeard.length,)} of `
          + `${String(unreadable.length,)} re-asked voices`,
      );
    }
    return {
      collected,
      asked,
      unreachable: unreachableSeats,
      unreadable: new Set(unreadableSeats.keys(),),
    };
  })();

  /**
   Voices heard across every round.
   */
  const {
    collected: voices,
    asked,
    unreachable,
    unreadable,
  } = rounds;

  /**
   Quorum the gather closes on, sized on the seats the router could serve.
   */
  const quorum = reachableQuorum({
    benchSize: modelIds.length,
    unreachable: unreachable.size,
  },);

  /**
   Whether at least half the roster, rounded up, ended up heard, or half
   the reachable bench where that is fewer.
   */
  const quorumMet = voices.length >= quorum.needed;

  /**
   Finding a short bench carries whatever the verdict, so a page decided on
   one is told apart in its artifact.
   */
  const shortFindings: readonly string[] = quorum.short
    ? [
      shortBenchStageFinding({
        stage,
        quorum,
        benchSize: modelIds.length,
      },),
    ]
    : [];
  if (quorum.short) {
    l.warn(
      `${stage}: bench short of quorum, reachable ${String(quorum.reachable,)} of ${
        String(modelIds.length,)
      }; closing on ${String(quorum.needed,)} voices`,
    );
  }

  /**
   Shortfall wording shared by both degradation findings: heard against
   asked, since a seat the window spared was never owed an answer.
   */
  const shortfall = `${stage} ${String(voices.length,)}/${String(asked.size,)}`;

  /**
   Models that were asked and never answered, in roster order.
   */
  const unheard = modelIds.filter(function askedAndNeverHeard(modelId,): boolean {
    if (!asked.has(modelId,))
      return false;
    return !voices.some(function isVoice(voice,): boolean {
      return voice.modelId === modelId;
    },);
  },);

  /**
   Naming of every model that went quiet, which the ARTIFACT carries and a
   log line does not.
   
   Voice loss reached only `l.warn` before this. That made every question
   about it, which model, which stage, how often, answerable solely from a
   captured run log, and on 2026-08-13 a run spent twenty minutes writing its
   log into a pipe whose reader had exited: the losses happened and nothing
   recorded them. Findings travel into the per-entry artifact, which is
   written durably and survives whatever spawned the pass.
   
   Emitted even when quorum was MET, which is the case the old findings
   dropped entirely and the one that hides a model degrading quietly while
   the stage still looks healthy.
   
   ONE FINDING PER MODEL rather than one naming a list, so counting the
   findings counts voices lost. A list-valued finding counts GATHERS that
   lost at least one voice, which is a different number, and reading the
   first as the second is the mistake that made the earlier per-model tally
   unusable: it summed to 113 mentions over 97 lines and was reported as
   though it were events.
   */
  const lostFindings: readonly string[] = unheard.map(function toFinding(modelId,): string {
    return `stage-voice-lost (${stage} ${modelId})`;
  },);

  if (!quorumMet) {
    return {
      voices,
      quorumMet,
      findings: [
        ...shortFindings,
        ...lostFindings,
        stageQuorumUnmetFinding({ shortfall, },),
      ],
      asked,
      unreachable,
      unreadable,
    };
  }
  // Emitted whenever the roster ended short, not only when retries were still
  // chasing it. The ratio is the part per-model loss findings cannot carry, and
  // a stage that met quorum with a voice missing is exactly the case that reads
  // as healthy everywhere else.
  if (voices.length < asked.size) {
    return {
      voices,
      quorumMet,
      findings: [
        ...shortFindings,
        ...lostFindings,
        `stage-roster-incomplete (${shortfall})`,
      ],
      asked,
      unreachable,
      unreadable,
    };
  }
  return {
    voices,
    quorumMet,
    findings: [
      ...shortFindings,
      ...lostFindings,
    ],
    asked,
    unreachable,
    unreadable,
  };
}

//endregion Stage quorum
