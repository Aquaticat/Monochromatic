import fs from 'fs';

import path from 'path';

import closestPath from '@monochromatic/closest-path-built';

const copyBuiltPackage = (): void => {
  const WORKSPACE_DIR = closestPath(path.resolve(), 'pnpm-workspace.yaml');
  const { name } = JSON.parse(fs.readFileSync(path.join(path.resolve(), 'package.json'), { encoding: 'utf8' }));

  if (WORKSPACE_DIR && path.join(WORKSPACE_DIR, 'helpers', name) === path.resolve()) {
    const buildMonochromaticDevDir = path.join(WORKSPACE_DIR, 'build.monochromatic.dev');

    const src = path.join(path.resolve(), 'dist', 'final');

    const desPackage = path.join(buildMonochromaticDevDir, `${name}-built`);

    if (fs.existsSync(desPackage)) {
      const des = path.join(desPackage, 'dist', 'final');

      if (!fs.existsSync(des))
        fs.mkdirSync(des, { recursive: true });

      fs.readdirSync(src).forEach((file) => {
        fs.copyFileSync(path.join(src, file), path.join(des, file));
      });
    }
  }
};

export default copyBuiltPackage;
