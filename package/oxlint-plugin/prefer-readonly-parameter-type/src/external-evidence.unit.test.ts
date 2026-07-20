import { createHash, } from 'node:crypto';
import {
  existsSync,
  readdirSync,
  readFileSync,
} from 'node:fs';
import { join, } from 'node:path';
import { fileURLToPath, } from 'node:url';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { INTRINSIC_EFFECTS, } from '../dist/final/node/index.mjs';

/**
 * Repository pnpm store holding exact installed package content.
 */
const PNPM_STORE = fileURLToPath(new URL(
  '../../../../node_modules/.pnpm/',
  import.meta.url,
),);

/**
 * Installed store entries listed once for prefix matching.
 */
const STORE_ENTRIES = readdirSync(PNPM_STORE,);

/**
 * One shipped-content claim parsed from catalog evidence prose.
 */
type ShippedClaim = {
  readonly relativePath: string;
  readonly digest: string;
};

/**
 * Parses `shipped <path> sha256 <hex>` claims from evidence prose.
 *
 * @param evidence - Audited catalog evidence text.
 *
 * @returns shipped-content claims in authored order.
 */
function shippedClaims(evidence: string,): readonly ShippedClaim[] {
  /**
   * Whitespace-separated evidence tokens.
   */
  const tokens = evidence.split(' ',);
  return tokens.flatMap(function claimAt(token, index,): ShippedClaim[] {
    if (token !== 'shipped')
      return [];
    /**
     * Path and digest tokens following the shipped keyword.
     */
    const relativePath = tokens[index + 1];
    if ((relativePath === undefined)
      || (tokens[index + 2] !== 'sha256'))
      return [];
    /**
     * Claimed content digest before trailing prose punctuation.
     */
    const digestToken = tokens[index + 3];
    if (digestToken === undefined)
      return [];
    /**
     * First non-hexadecimal offset bounding the digest prefix.
     */
    const hexEnd = { value: 0, };
    while (hexEnd.value < digestToken.length) {
      /**
       * Candidate digest character at current cursor.
       */
      const character = digestToken[hexEnd.value] ?? '';
      if (((character < '0') || (character > '9'))
        && ((character < 'a') || (character > 'f')))
        break;
      hexEnd.value += 1;
    }
    return [{
      relativePath,
      digest: digestToken.slice(
        0,
        hexEnd.value,
      ),
    },];
  },);
}

/**
 * Finds installed package directories matching name and version prefix.
 *
 * @param packageName - Published package name from provenance.
 *
 * @param version - Claimed version or version prefix from evidence.
 *
 * @returns matching installed package roots.
 */
function installedPackageRoots({
  packageName,
  version,
}: {
  readonly packageName: string;
  readonly version: string;
},): readonly string[] {
  /**
   * pnpm store directory name prefix for claimed name and version.
   */
  const storePrefix = `${packageName.replaceAll(
    '/',
    '+',
  )}@${version}`;
  return STORE_ENTRIES
    .filter(function matchesClaim(entry,): boolean {
      return entry.startsWith(storePrefix,)
        && ((entry.length === storePrefix.length)
          || (entry[storePrefix.length] === '.')
          || (entry[storePrefix.length] === '_'));
    },)
    .map(function packageRoot(entry,): string {
      return join(
        PNPM_STORE,
        entry,
        'node_modules',
        packageName,
      );
    },)
    .filter(function rootExists(root,): boolean {
      return existsSync(root,);
    },);
}

await describe({
  name: 'external catalog evidence validation',
  concurrency: 1,
  children: [
    it({
      name: 'matches every shipped-content digest against installed packages',
      fn: async () => {
        /**
         * Failures naming entry identity and drift cause.
         */
        const failures: string[] = [];
        /**
         * Validated shipped-content claims guarding against silent no-op.
         */
        const validatedClaims = { count: 0, };
        INTRINSIC_EFFECTS.forEach(function validateEntry(entry,): void {
          if (entry.provenance.kind !== 'package')
            return;
          /**
           * Published package name from exact provenance.
           */
          const { packageName, } = entry.provenance;
          // Tier gates validation: api-contract entries pin compatibility
          // through the provenance major alone, shipped-content entries pin
          // exact installed bytes, and an undeclared tier fails loudly so no
          // package audit silently opts out.
          if (entry.auditTier === 'api-contract')
            return;
          if (entry.auditTier !== 'shipped-content') {
            failures.push(
              `${packageName} (${entry.ownerType}.${entry.member}): package entry declares no audit tier`,
            );
            return;
          }
          /**
           * Claimed version token following package name in evidence prose.
           */
          const version = entry.evidence.startsWith(`${packageName} `,)
            ? entry
              .evidence
              .slice(packageName.length + 1,)
              .split(' ',)
              .at(0,)
            : undefined;
          /**
           * Leading version character distinguishing versions from prose.
           */
          const versionLead = version?.at(0,) ?? '';
          if ((version === undefined)
            || (versionLead < '0')
            || (versionLead > '9')) {
            failures.push(
              `${packageName} (${entry.ownerType}.${entry.member}): shipped-content evidence must open with package name and audited version`,
            );
            return;
          }
          /**
           * Installed roots matching claimed name and version.
           */
          const roots = installedPackageRoots({
            packageName,
            version,
          },);
          if (roots.length === 0) {
            failures.push(
              `${packageName} ${version} (${entry.ownerType}.${entry.member}): no installed package matches the audited version`,
            );
            return;
          }
          /**
           * Machine-checkable shipped-content claims for this entry.
           */
          const claims = shippedClaims(entry.evidence,);
          if (claims.length === 0) {
            failures.push(
              `${packageName} ${version} (${entry.ownerType}.${entry.member}): shipped-content evidence carries no shipped sha256 claim`,
            );
            return;
          }
          claims
            .forEach(function validateClaim(claim,): void {
              validatedClaims.count += 1;
              /**
               * Whether any installed root carries claimed content.
               */
              const matched = roots.some(function rootMatches(root,): boolean {
                /**
                 * Absolute shipped file path inside installed root.
                 */
                const filePath = join(
                  root,
                  claim.relativePath,
                );
                if (!existsSync(filePath,))
                  return false;
                return createHash('sha256',)
                  .update(readFileSync(filePath,),)
                  .digest('hex',)
                  === claim.digest;
              },);
              if (!matched) {
                failures.push(
                  `${packageName} ${version} (${entry.ownerType}.${entry.member}): shipped ${claim.relativePath} digest drifted; re-audit the entry against the installed version`,
                );
              }
            },);
        },);
        expect(failures,).toEqual([],);
        expect(validatedClaims.count > 0,).toBe(true,);
      },
    },),
  ],
},);
