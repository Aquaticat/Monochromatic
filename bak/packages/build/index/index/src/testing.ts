import { getLogger } from '@logtape/logtape';

import {
  exec,
  type ExecaResult,
  packageInfo,
} from '@monochromatic-dev/module-node/ts';
import { outTestJsPaths } from './consts.ts';

const l = getLogger(['a', 't']);

export default async (): Promise<void> => {
  if (outTestJsPaths.length === 0) {
    l.warn`no tests defined`;
    return;
  }

  l.info`testing ${outTestJsPaths.length}: ${outTestJsPaths}`;

  const testResult = await Promise.allSettled(
    // TODO: Switch this to an implementation that actually just runs js file and is runtime/node-linker agnostic.
    // TODO: Searched once again, didn't find anything. Probably have still to write this myself.
    outTestJsPaths.map((outTestJsPath) => exec`${packageInfo.runtime} ${outTestJsPath}`),
  );

  l.info`tested ${
    (function humanReadableTestResult(testResult: PromiseSettledResult<ExecaResult>[]) {
      const testResultArray = testResult.map((testResultPerFile) =>
        testResultPerFile.status === 'fulfilled'
          ? testResultPerFile.value.stdout === ''
            ? ''
            : testResultPerFile.value
          : testResultPerFile
      );

      // TODO: Use BooleanNot here from my lib
      if (testResultArray.every((testResultSingle) => !testResultSingle)) {
        return testResultArray.length;
      }

      return testResult;
    })(testResult)
  }`;
};
