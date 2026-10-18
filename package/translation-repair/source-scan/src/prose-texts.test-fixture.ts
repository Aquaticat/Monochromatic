/**
 The texts the package's reference guards read, shared so each guard reads the
 same set: the package's TypeScript under `src`, its docs, its README and its
 task file, and the living repository-level docs.

 MOVED OUT OF `task-list-numbers.unit.test.ts` when a second guard needed the
 same set (ledger D33), since two copies of one reader drift apart.

 @module
 */

import {
  readdir,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  readLivingRepositoryDocs,
  REPOSITORY_ROOT,
} from './living-docs.test-fixture.ts';
import { readPackageSource, } from './source-scan.test-fixture.ts';

/**
 One file a guard reads, named from the package root, or from the repository
 root for a living repository-level doc.

 @example
 ```ts
 const file: PackageText = { path: 'doc/cat.md', text: 'Naps.', };
 ```
 */
export type PackageText = {
  /**
   Path from the package root, which names locations.
   */
  readonly path: string;

  /**
   File text.
   */
  readonly text: string;
};

/**
 Every file the guard reads: the package's TypeScript under `src`, its docs,
 its README and its task file.

 @returns Files with their text

 @example
 ```ts
 const files = await readPackageTexts();
 ```
 */
export async function readPackageTexts(): Promise<readonly PackageText[]> {
  /**
   Package root, which holds `src`.
   */
  const root = join(
    import.meta.dirname,
    '..',
  );
  /**
   Markdown files under `doc`.
   */
  const docs = (await readdir(join(
    root,
    'doc',
  ),))
    .filter(function isMarkdown(name,): boolean {
      return name.endsWith('.md',);
    },)
    .map(function underDoc(name,): string {
      return join(
        'doc',
        name,
      );
    },);
  /**
   Non-source files, read from the package root.
   */
  const others = await Promise.all([
    ...docs,
    'README.md',
    'mise.toml',
  ].map(async function read(
    path,
  ): Promise<PackageText> {
    return {
      path,
      text: await readFile(
        join(
          root,
          path,
        ),
        'utf8',
      ),
    };
  },),);
  /**
   Source and test files, named from the package root.
   */
  const source = (await readPackageSource()).map(function fromRoot(file,): PackageText {
    return {
      path: join(
        'src',
        file.path,
      ),
      text: file.text,
    };
  },);
  return [
    ...source,
    ...others,
  ];
}

/**
 Every living repository-level doc: the translation-repair decision records,
 the canonical handover and its snapshot, the planning docs it links as
 current, and the translation-repair runbooks and troubleshooting docs.

 @returns Files with their text, named from the repository root

 @example
 ```ts
 const files = await readRepositoryTexts();
 ```
 */
export async function readRepositoryTexts(): Promise<readonly PackageText[]> {
  /**
   Living repository-level docs.
   */
  const {
    decisionRecords,
    handover,
    currentPlanning,
    operations,
  } = await readLivingRepositoryDocs();
  return Promise.all([
    ...decisionRecords,
    ...handover,
    ...currentPlanning,
    ...operations,
  ].map(async function read(
    path,
  ): Promise<PackageText> {
    return {
      path,
      text: await readFile(
        join(
          REPOSITORY_ROOT,
          path,
        ),
        'utf8',
      ),
    };
  },),);
}
