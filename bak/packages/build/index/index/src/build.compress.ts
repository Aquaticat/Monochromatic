import { cacheRootDir } from '@/src/consts';
import type { State } from '@/src/state.ts';
import { getLogger } from '@logtape/logtape';
import { partitionArrayLikeAsync } from '@monochromatic-dev/module-es/ts';
import {
  fs,
  path,
} from '@monochromatic-dev/module-fs-path';
import { exec } from '@monochromatic-dev/module-node/ts';
import { hashFile } from 'hasha';
import { mapParallelAsync } from 'rambdax';
const l = getLogger(['a', 'compress']);

const cacheDir = path.join(cacheRootDir, 'compress');

export default async (): Promise<State> => {
  const staticFilePaths =
    (await fs.readdir('dist/final', { withFileTypes: true, recursive: true }))
      .filter((finalDr) =>
        finalDr.isFile()
        && !finalDr.parentPath.includes('/_')
        && !['br', 'map', 'd.ts', 'gz', 'zst']
          .some((dotlessNoCompressExt) =>
            finalDr.name.endsWith(`.${dotlessNoCompressExt}`)
          )
      )
      .map((finalFileDr) => path.join(finalFileDr.parentPath, finalFileDr.name));

  const newStaticFilePathsMap = new Map(
    await mapParallelAsync(
      async (
        staticFilePath,
      ) => [staticFilePath, await hashFile(staticFilePath, { algorithm: 'md5' })],
      staticFilePaths,
    ),
  );

  l.debug`${JSON.stringify(newStaticFilePathsMap)}`;

  const [staticFilesToCp, staticFilesToCompress] = await partitionArrayLikeAsync(
    async ([_, newStaticFileHash]) =>
      Boolean(await fs.exists(path.join(cacheDir, newStaticFileHash))),
    Array.from(newStaticFilePathsMap),
  );

  const staticFileToCompressHashs = Array
    .from(new Map(staticFilesToCompress).keys());

  const [staticFilesCpRes, [compressRes, populateCacheRes]] = await Promise.all([
    mapParallelAsync(
      async (staticFileToCp) =>
        await fs.existsFile(path.join('dist', 'final', staticFileToCp[0])) || await fs
          .cpFile(path.join(cacheDir, staticFileToCp[1]), `${staticFileToCp[0]}.zst`),
      staticFilesToCp,
    ),
    (async () => {
      const compressRes =
        (await exec`zstd -z -f -v --no-check -T0 --exclude-compressed --no-content-size -- ${
          staticFileToCompressHashs
            .join(' ')
        }`)
          .stdout;
      const populateCacheRes = await mapParallelAsync(
        async ([staticFileToCompressPath, staticFileToCompressHash]) =>
          await fs.cpFile(
            staticFileToCompressPath,
            path.join(cacheDir, staticFileToCompressHash),
          ),
        staticFilesToCompress,
      );
      return [compressRes, populateCacheRes];
    })(),
  ]);

  return [
    'compress',
    'SUCCESS',
    [
      ['staticFilesCpRes', 'SUCCESS', staticFilesCpRes],
      ['populateCacheRes', 'SUCCESS', populateCacheRes],
      ['compressRes', 'SUCCESS', compressRes],
    ],
  ];
};
