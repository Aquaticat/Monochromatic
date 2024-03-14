import * as path from 'node:path';

import * as fs from 'node:fs';

const closestPath = async (
  currentPath: string = path.resolve(),
  selectors = 'package.json',
  layers = 1,
): Promise<string> => {
  if (
    fs.lstatSync(currentPath).isDirectory() &&
    (await Bun.$`ls ${selectors}`.cwd(currentPath).quiet()).exitCode === 0
  ) {
    if (layers === 1) return currentPath;

    return closestPath(path.join(currentPath, '..'), selectors, layers - 1);
  }

  return closestPath(path.join(currentPath, '..'), selectors, layers);
};

export default closestPath;
