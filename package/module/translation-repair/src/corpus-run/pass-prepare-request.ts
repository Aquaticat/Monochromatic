import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import type { BenchSeating, } from '../bench-seating.ts';
import type { SyntheticClient, } from '../chat-contract.ts';
import type { StageSettings, } from '../stage-settings.ts';
import type { RosterModelId, } from '../synthetic-catalog.ts';
import type { PassOutsideReads, } from './pass-outside-reads.ts';
import type { PassVisualEvidenceReader, } from './pass-visual-evidence.ts';
import type { PipelineDigest, } from './pipeline-digest.ts';

//region Pass preparation request
// What one pass entry's preparation takes, named apart from `pass-prepare.ts`,
// whose procedure fills that module's code-line budget; `preparePassEntry`
// documents each field where it reads it.

/**
 Everything one pass entry's preparation reads.

 @example
 ```ts
 const request: PassPrepareRequest = { client, entryId, entryCacheDir, pipelineDigest, modelIds, sourceText, targetText, signal, exchangeTimeoutMs, l, outsideReads, stageSettings, };
 ```
 */
export type PassPrepareRequest = {
  readonly client: SyntheticClient;
  readonly entryId: string;
  readonly entryCacheDir: string;
  readonly pipelineDigest: PipelineDigest;
  readonly modelIds: readonly RosterModelId[];
  readonly sourceText: string;
  readonly targetText: string;
  readonly signal: AbortSignal;
  readonly exchangeTimeoutMs: number;
  readonly l: Logger;
  readonly readPictures?: PassVisualEvidenceReader;
  readonly beforeItem?: () => Promise<BenchSeating>;
  readonly outsideReads: PassOutsideReads;
  readonly stageSettings: StageSettings;
};

//endregion Pass preparation request
