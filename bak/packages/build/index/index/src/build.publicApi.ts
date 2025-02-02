import { indexJsFilePaths } from '@/src/consts.ts';
import type { State } from '@/src/state.ts';
import { getLogger } from '@logtape/logtape';
import {
  fs,
  path,
} from '@monochromatic-dev/module-fs-path';
import {
  exec,
  packageInfo,
} from '@monochromatic-dev/module-node/ts';
const l = getLogger(['a', 'publicApi']);
import {
  format as stringify,
  greaterOrEqual,
  increment,
  parse,
} from '@std/semver';
import { pipedAsync } from 'rambdax';

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

  // TODO: Find a way to make vue-tsc honor conf options
  // MAYBE: Do we need to generate d.ts files for vue at all?
  // FIXME: Just found out I used vue-tsc over tsc only for checking .vue files.
  //        Now that --noCheck option is out, calling it this way is pointless.
  //        Need to find a way to both check .vue and generate d.ts for others.
  //        If isolatedDeclaration is not turned on or oxc-transform isolatedDeclaration() fails,
  //        we fall back to the official tsc.
  // MAYBE: Or we don't need to check vue at all.
  //        Instruct users to setup .vue checking in their editors.
  //        After all, we're already not checking .ts
  const { all } = await exec({ timeout: 10000 })`vue-tsc --noCheck`;

  const pkgJsonObj: { version?: string; } = await pipedAsync(
    path.join(packageInfo.packageAbsDir, 'package.json'),
    fs.readFileU,
    JSON.parse,
  );
  if (!pkgJsonObj.version) {
    l.warn`version not already set in ${
      path.join(packageInfo.packageAbsDir, 'package.json')
    }, skipping inc ver`;
  }

  const oldVer = parse(pkgJsonObj.version!);
  if (
    // We don't need to handle the case
    // where those show up at the end of the output w/o trailing newline here
    // because tsc always spits out TSFILE: .../tsconfig.tsbuildinfo as the last line.
    ['/index.ts\n', '/bin.ts\n'].some((searchFileName) =>
      String(all).trim().includes(searchFileName)
    )
  ) {
    l.warn`You have changed the public api`;

    if (greaterOrEqual(oldVer, parse('1.0.0'))) {
      l
        .warn`This is a version >= 1 package. Incrementing major version.`;
      await fs.writeFile(
        path.join(packageInfo.packageAbsDir, 'package.json'),
        JSON.stringify(
          { ...pkgJsonObj, version: stringify(increment(oldVer, 'major')) },
          null,
          2,
        ),
      );
    } else {
      l.warn`This is a version < 1 package. Incrementing minor version.`;
      await fs.writeFile(
        path.join(packageInfo.packageAbsDir, 'package.json'),
        JSON.stringify(
          { ...pkgJsonObj, version: stringify(increment(oldVer, 'minor')) },
          null,
          2,
        ),
      );
    }
  } else {
    l.info`Incrementing patch version.`;
    await fs.writeFile(
      path.join(packageInfo.packageAbsDir, 'package.json'),
      JSON.stringify(
        { ...pkgJsonObj, version: stringify(increment(oldVer, 'patch')) },
        null,
        2,
      ),
    );
  }

  return ['publicApi', 'SUCCESS', all];
};
