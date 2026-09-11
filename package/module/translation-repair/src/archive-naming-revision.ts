import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import {
  archiveBlameOrigins,
  isArchiveGitObjectId,
} from './archive-blame.ts';
import { ArchiveNamingEvidenceError, } from './archive-naming-error.ts';
import { archiveGitOutput, } from './archive-naming-git.ts';
import { readArchiveNamingHistories, } from './archive-naming-history.ts';
import type {
  ArchiveNamingRevisionResult,
  InitialArchiveUse,
} from './archive-naming-model.ts';
import { qualifyArchiveNamingScopes, } from './archive-naming-qualify.ts';
import { archiveNamingScopes, } from './archive-naming-scope.ts';
import { corroboratedArchiveReferences, } from './archive-use-corroborate.ts';
import {
  type CorpusPin,
  readCorpusFile,
} from './corpus-source.ts';
import { passArchiveText, } from './corpus-run/pass-archive.ts';

//region Qualified archive naming revisions
// Owns acquisition, parsing and qualification behind one pinned-input interface.

/**
 * Default module logger for library consumers without an entry logger.
 */
const defaultLogger = tagged({ tag: 'archive-naming-revision', },);

/**
 * Acquires only exact historical naming choices for corroborated initial references.
 * No caller-selected origin revision, alias map or generated text can supply authority.
 * Missing history is explicit withholding; malformed anchors and failed reads throw.
 *
 * @param pin - immutable corpus commit and local clone
 *
 * @param relPath - literal repository-relative English archive path
 *
 * @param uses - observations anchored before archive review or candidate generation
 *
 * @param signal - preparation cancellation
 *
 * @param l - entry logger, or module default for library calls
 *
 * @returns Qualified occurrence revisions with their complete provenance and findings
 *
 * @throws {@link ArchiveNamingEvidenceError} for inconsistent scope or failed history acquisition
 *
 * @throws {@link CorpusReadError} when the pinned archive cannot be read
 *
 * @example
 * ```ts
 * const evidence = await readQualifiedArchiveNamingRevisions({ pin, relPath, uses });
 * ```
 */
export async function readQualifiedArchiveNamingRevisions({
  pin,
  relPath,
  uses,
  signal,
  l = defaultLogger,
}: {
  readonly pin: CorpusPin;
  readonly relPath: string;
  readonly uses: readonly InitialArchiveUse[];
  readonly signal?: AbortSignal;
  readonly l?: Logger;
},): Promise<ArchiveNamingRevisionResult> {
  /**
   * Function-tagged logger records qualification decisions without history authors.
   */
  const rl = tagged({
    tag: readQualifiedArchiveNamingRevisions.name,
    l,
  },);
  signal?.throwIfAborted();
  if (uses.length === 0) {
    rl.debug('no initial occurrence observations; no history read',);
    return {
      revisions: [],
      findings: [],
    };
  }
  /**
   * Owned snapshot prevents caller mutation across awaited repository reads.
   */
  const initialUses = structuredClone(uses,);
  /**
   * Independent use facts, before any naming-specific interpretation of history.
   */
  const corroborated = corroboratedArchiveReferences({ uses: initialUses, },);
  if (corroborated.references
    .length
    === 0)
    return {
      revisions: [],
      findings: corroborated.findings,
    };
  if ((!isArchiveGitObjectId(pin.commitSha,))
    || relPath.startsWith('/',)
    || relPath.includes('\0',)
    || relPath.split('/',)
    .some(function nonLiteralSegment(segment,): boolean {
      return (segment === '') || (segment === '.')
        || (segment === '..');
    },)) {
    throw new ArchiveNamingEvidenceError({
      kind: 'archive-mismatch',
      relPath,
    },);
  }
  /**
   * Pin fields are also owned across async boundaries.
   */
  const fixedPin = { ...pin, };
  /**
   * Canonical pinned read, preserving shared CRLF semantics.
   */
  const rawArchive = await readCorpusFile({
    pin: fixedPin,
    relPath,
  },);
  /**
   * Exact initial normalization, not a later revised archive candidate.
   */
  const archiveText = passArchiveText({
    text: rawArchive,
    l: rl,
  },);
  /**
   * Repository-wide shallow state is deliberately unsupported for naming authority.
   */
  const shallow = (await archiveGitOutput({
    pin: fixedPin,
    relPath,
    args: [
      'rev-parse',
      '--is-shallow-repository'
    ],
    ...(signal === undefined ? {} : { signal, }),
  },)).trim();
  if (shallow === 'true') {
    rl.debug('withholding naming history from a shallow repository',);
    return {
      revisions: [],
      findings: [
        ...corroborated.findings,
        'archive-revision-withheld (shallow history)',
      ],
    };
  }
  if (shallow !== 'false')
    throw new ArchiveNamingEvidenceError({
      kind: 'history-shape',
      relPath,
    },);
  /**
   * Full pinned line origins, never working-tree blame or a semantic-diff guess.
   */
  const porcelain = await archiveGitOutput({
    pin: fixedPin,
    relPath,
    args: [
      'blame',
      '--line-porcelain',
      '--no-textconv',
      '--no-progress',
      '--ignore-revs-file',
      '',
      fixedPin.commitSha,
      '--',
      relPath,
    ],
    ...(signal === undefined ? {} : { signal, }),
  },);
  /**
   * Every current line is checked against the pinned read before scope mapping.
   */
  const origins = archiveBlameOrigins({
    porcelain,
    archiveText: rawArchive,
    relPath,
  },);
  /**
   * Exact initial observations joined to unique normalized pinned lines.
   */
  const scoped = archiveNamingScopes({
    archiveText,
    uses: initialUses,
    references: corroborated.references,
    origins,
    relPath,
  },);
  /**
   * Each required origin is read once; root and merge histories remain withheld.
   */
  const history = await readArchiveNamingHistories({
    scopes: scoped.scopes,
    pin: fixedPin,
    relPath,
    ...(signal === undefined ? {} : { signal, }),
  },);
  /**
   * Final whole-occurrence qualification, still distinct from translation policy.
   */
  const qualified = qualifyArchiveNamingScopes({
    scopes: scoped.scopes,
    histories: history.histories,
    pin: fixedPin,
    relPath,
  },);
  rl.info(`qualified ${String(qualified.revisions
    .length,)} naming revisions for ${relPath}`,);
  return {
    revisions: qualified.revisions,
    findings: [
      ...corroborated.findings,
      ...scoped.findings,
      ...history.findings,
      ...qualified.findings
    ],
  };
}

//endregion Qualified archive naming revisions
