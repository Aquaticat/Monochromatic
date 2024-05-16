import $c from '@/src/child.ts';
import {
  fromPm,
  indexJsFilePaths,
} from '@/src/consts.ts';
import type { State } from '@/src/state.ts';
import { getLogger } from '@logtape/logtape';
import {
  fs,
  path,
} from '@monochromatic.dev/module-fs-path';
const l = getLogger(['app', 'publicApi']);
import { pipedAsync } from 'rambdax';
import semver from 'semver';

export default async (): Promise<State> => {
  if (indexJsFilePaths.length === 0) {
    return ['publicApi', 'SKIP', `skipping dts, none of index.js or index.ts exists.`];
  }

  try {
    await fs.access(path.join('tsconfig.json'));
  } catch {
    return ['publicApi', 'SKIP', `skipping dts, tsconfig.json doesn't exist.`];
  }

  l.debug`dts`;

  const { stdoe } = await $c(`vue-tsc`);

  const pkgJsonObj: { version?: string; } = await pipedAsync(
    path.join(fromPm.packageAbsDir, 'package.json'),
    fs.readFileU,
    JSON.parse,
  );
  const oldVer = pkgJsonObj.version;
  if (oldVer) {
    if (String(stdoe).trim()) {
      l.warn`You have changed the public api`;

      if (semver.gte(oldVer, '1.0.0')) {
        l.warn`This is a general release package (version >=1). Incrementing major version.`;
        await fs.writeFile(
          path.join(fromPm.packageAbsDir, 'package.json'),
          JSON.stringify({ ...pkgJsonObj, version: semver.inc(oldVer, 'major') }, null, 2),
        );
      } else {
        l.warn`This is a prerelease package (version <1). Incrementing minor version.`;
        await fs.writeFile(
          path.join(fromPm.packageAbsDir, 'package.json'),
          JSON.stringify({ ...pkgJsonObj, version: semver.inc(oldVer, 'minor') }, null, 2),
        );
      }
    } else {
      l.info`Incrementing patch version.`;
      await fs.writeFile(
        path.join(fromPm.packageAbsDir, 'package.json'),
        JSON.stringify({ ...pkgJsonObj, version: semver.inc(oldVer, 'patch') }, null, 2),
      );
    }
  } else {
    l.warn`version not already set in ${path.join(fromPm.packageAbsDir, 'package.json')}, skipping inc ver`;
  }

  return ['publicApi', 'SUCCESS', stdoe];
};
