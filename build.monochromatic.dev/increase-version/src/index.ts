import closestPath from '@monochromatic.dev/closest-path-built';

import fs from 'fs';

import path from 'path';

import {
  inc,
} from 'semver';

import shell from 'shelljs';

const increaseVersion = (): void => {
  const packagePath = closestPath()!;
  const packagePackageJson = JSON.parse(fs.readFileSync(path.join(packagePath, 'package.json'), { encoding: 'utf8' }));
  const { name } = packagePackageJson;

  const indexPackagePath = path.join(closestPath(), '..', 'index');

  const workspacePath = closestPath(path.resolve(), 'pnpm-workspace.yaml')!;
  const workspacePackageJson = JSON.parse(
    fs.readFileSync(path.join(workspacePath, 'package.json'), { encoding: 'utf8' }),
  );

  const builtPackagePath = path.join(workspacePath, 'build.monochromatic.dev', `${name.replace(/@.+\//, '')}-built`);

  if (
    fs.existsSync(path.join(packagePath, 'dist', 'final'))
    && fs.readdirSync(path.join(packagePath, 'dist', 'final')).length > 0
  ) {
    const current = fs.readdirSync(path.join(packagePath, 'dist', 'final')).map((fileNameWIthExtension) =>
      fs.readFileSync(path.join(packagePath, 'dist', 'final', fileNameWIthExtension), { encoding: 'utf8' })
    ).join('');

    if (
      !fs.existsSync(path.join(packagePath, 'dist', 'final.txt'))
      || current !== fs.readFileSync(path.join(packagePath, 'dist', 'final.txt'), { encoding: 'utf8' })
    ) {
      fs.writeFileSync(path.join(packagePath, 'dist', 'final.txt'), current);

      fs.writeFileSync(
        path.join(packagePath, 'package.json'),
        JSON.stringify(
          {
            ...packagePackageJson,
            ...{ version: inc(packagePackageJson.version, 'patch') },
          },
          null,
          2,
        ),
      );

      if (fs.existsSync(indexPackagePath)) {
        const indexPackageJson = JSON.parse(
          fs.readFileSync(path.join(indexPackagePath, 'package.json'), { encoding: 'utf8' }),
        );

        fs.writeFileSync(
          path.join(indexPackagePath, 'package.json'),
          JSON.stringify(
            {
              ...indexPackageJson,
              ...{ version: inc(indexPackageJson.version, 'patch') },
            },
            null,
            2,
          ),
        );
      }

      if (fs.existsSync(builtPackagePath)) {
        shell.cd(path.join(builtPackagePath, '..', 'index'));
        shell.exec('pnpm run build');

        const builtPackageJson = JSON.parse(
          fs.readFileSync(path.join(builtPackagePath, 'package.json'), { encoding: 'utf8' }),
        );

        fs.writeFileSync(
          path.join(builtPackagePath, 'package.json'),
          JSON.stringify(
            {
              ...builtPackageJson,
              ...{ version: inc(builtPackageJson.version, 'patch') },
            },
            null,
            2,
          ),
        );
      }

      fs.writeFileSync(
        path.join(workspacePath, 'package.json'),
        JSON.stringify(
          {
            ...workspacePackageJson,
            ...{ version: inc(workspacePackageJson.version, 'patch') },
          },
          null,
          2,
        ),
      );
    }
  }
};

export default increaseVersion;
