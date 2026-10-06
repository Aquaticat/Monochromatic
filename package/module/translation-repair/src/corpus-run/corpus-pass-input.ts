import type { ModelTransport, } from '../synthetic-transport.ts';
import type { CommandLineOf, } from './command-lines.ts';
import type { CorpusPinSetting, } from './corpus-pin-override.ts';
import type { settleEntry, } from './pass-entry.ts';
import type { PassOutsideReads, } from './pass-outside-reads.ts';
import type { PassPictureSources, } from './pass-visual-evidence.ts';
import type { RunClient, } from './run-client-contract.ts';

//region Corpus pass input
// What the entry file hands the pass: every value only a process has.

/**
 What a corpus pass needs from the process that runs it.

 @example
 ```ts
 const input: CorpusPassInput = { line, runsDir, graceNote: '', writerNote: '', pinSetting, hardCapMs, spendCeilingUsd, driftAllowed: false, pipelineDir, readTip, env, transport, newClient, settle: settleEntry, outsideReads, pictureSources, now, };
 ```
 */
export type CorpusPassInput = {
  /**
   The pass's command line, read whole by `reportingRefusals`.
   */
  readonly line: CommandLineOf<'corpus-pass'>;

  /**
   Durable, gitignored output root for this run.
   */
  readonly runsDir: string;

  /**
   Note naming the straggler window, empty for the built-in one.
   */
  readonly graceNote: string;

  /**
   Note naming the writer rounds' window, empty for the built-in one.
   */
  readonly writerNote: string;

  /**
   Corpus clone and commit this run reads, beside where each half came from.
   */
  readonly pinSetting: CorpusPinSetting;

  /**
   Ceiling one entry runs under, after any override.
   */
  readonly hardCapMs: number;

  /**
   USD this run may spend on the metered provider, after any override.
   */
  readonly spendCeilingUsd: number;

  /**
   Whether the launch asked to resume across a foreign build.
   */
  readonly driftAllowed: boolean;

  /**
   Directory of the built pipeline, which the digest is taken over.
   */
  readonly pipelineDir: string;

  /**
   Reads the pipeline tip recorded into every artifact.
   */
  readonly readTip: () => Promise<string>;

  /**
   Environment the required providers' keys are read from.
   */
  readonly env: Readonly<NodeJS.ProcessEnv>;

  /**
   HTTP the required providers' meters are read over.
   */
  readonly transport: ModelTransport;

  /**
   Builds the one client the run asks models through, given where its prompt payloads are kept.
   */
  readonly newClient: (input: { readonly promptPayloadDir: string; },) => RunClient;

  /**
   Settles one entry; the pass's whole per-entry procedure.
   */
  readonly settle: typeof settleEntry;

  /**
   Reads the pass takes from outside the corpus.
   */
  readonly outsideReads: PassOutsideReads;

  /**
   Sources of the pictures an entry's pages carry.
   */
  readonly pictureSources: PassPictureSources;

  /**
   Monotonic clock in milliseconds, which setting the system clock does not move.
   */
  readonly now: () => number;
};

//endregion Corpus pass input
