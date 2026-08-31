// PROTOTYPE ONLY: Candidate G durable one-dispatch prompt claims.

import { mkdir, readFile, writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import type {
  ChatJsonOutcome,
  SyntheticClient,
} from './chat-contract.ts';
import { isJsonRecord, } from './json-guard.ts';
import { modelPromptDigest, } from './prompt-uniqueness-client.ts';
import { writeFileAtomic, } from './corpus-run/atomic-write.ts';

/** Durable prompt state before or after single provider exchange. */
type RealizationPromptClaim = {
  readonly state: 'dispatched' | 'spent-unusable';
  readonly promptDigest: string;
};

/** Whether filesystem error reports existing exclusive claim. */
function isExistingClaim(error: unknown,): boolean {
  return isJsonRecord(error,) && (error.code === 'EEXIST');
}

/** Reads and validates one durable prompt claim. */
async function readPromptClaim({ path, promptDigest, }: {
  readonly path: string;
  readonly promptDigest: string;
}): Promise<RealizationPromptClaim> {
  const value: unknown = JSON.parse(await readFile(path, 'utf8',),);
  if (!isJsonRecord(value,) || (value.promptDigest !== promptDigest)
    || ((value.state !== 'dispatched') && (value.state !== 'spent-unusable')))
    throw new Error('realization durable prompt claim differs');
  return { state: value.state, promptDigest, };
}

/** Writes permanent spent claim before exposing any provider outcome. */
async function writeSpentClaim({ path, promptDigest, }: {
  readonly path: string;
  readonly promptDigest: string;
}): Promise<void> {
  await writeFileAtomic({
    path,
    text: `${JSON.stringify({ state: 'spent-unusable', promptDigest, }, null, 2,)}\n`,
  },);
}

/** Revalidates first provider outcome through exact caller guard. */
function validatePromptOutcome<ValueT,>({ outcome, validate, }: {
  readonly outcome: ChatJsonOutcome<unknown>;
  readonly validate: (value: unknown) => value is ValueT;
}): ChatJsonOutcome<ValueT> {
  if (outcome.kind !== 'ok')
    return outcome;
  if (validate(outcome.value,))
    return { ...outcome, value: outcome.value, };
  return {
    kind: 'schema-mismatch',
    rawText: outcome.rawText,
    reason: 'caller-guard-rejected',
    detail: 'realization provider payload differs from caller guard',
  };
}

/** Converts prior durable dispatch into no-effect outcome without provider call. */
function spentOutcome(): ChatJsonOutcome<never> {
  return {
    kind: 'schema-mismatch',
    rawText: '',
    reason: 'other-schema-mismatch',
    detail: 'realization prompt was already dispatched without node restart reuse',
  };
}

/** Claims prompt path exclusively or observes prior durable dispatch. */
async function claimOrRead({ claimsDir, promptDigest, }: {
  readonly claimsDir: string;
  readonly promptDigest: string;
}): Promise<{ readonly kind: 'owner'; readonly path: string; } | {
  readonly kind: 'existing';
  readonly claim: RealizationPromptClaim;
}> {
  await mkdir(claimsDir, { recursive: true, });
  const path = join(claimsDir, `${promptDigest}.json`,);
  try {
    await writeFile(path, `${JSON.stringify({ state: 'dispatched', promptDigest, }, null, 2,)}\n`, { flag: 'wx', });
    return { kind: 'owner', path, };
  }
  catch (error) {
    if (!isExistingClaim(error,))
      throw error;
    return { kind: 'existing', claim: await readPromptClaim({ path, promptDigest, }), };
  }
}

/** Allows one provider dispatch and permanently quarantines claim before return. */
export function realizationPromptUniqueClient({ inner, claimsDir, }: {
  readonly inner: SyntheticClient;
  readonly claimsDir: string;
}): SyntheticClient {
  const claimed = new Map<string, Promise<ChatJsonOutcome<unknown>>>();
  return {
    chatText: async function text(request,) {
      return await inner.chatText(request,);
    },
    chatJson: async function json(request,) {
      const promptDigest = modelPromptDigest({ request, },);
      const existing = claimed.get(promptDigest,);
      if (existing !== undefined)
        return spentOutcome();
      const pending = (async function dispatchOnce(): Promise<ChatJsonOutcome<unknown>> {
        const claimedPath = await claimOrRead({ claimsDir, promptDigest, });
        if (claimedPath.kind === 'existing')
          return spentOutcome();
        try {
          const outcome = await inner.chatJson(request,);
          await writeSpentClaim({ path: claimedPath.path, promptDigest, });
          if (request.signal.aborted)
            throw request.signal.reason;
          return outcome;
        }
        catch (error) {
          await writeSpentClaim({ path: claimedPath.path, promptDigest, });
          throw error;
        }
      })();
      claimed.set(promptDigest, pending,);
      try {
        const outcome = await pending;
        claimed.set(promptDigest, Promise.resolve(spentOutcome(),),);
        return validatePromptOutcome({ outcome, validate: request.validate, });
      }
      catch (error) {
        claimed.set(promptDigest, Promise.resolve(spentOutcome(),),);
        throw error;
      }
    },
    quotas: async function quotas(request,) {
      return await inner.quotas(request,);
    },
  };
}
