import * as path from 'path';

import * as fs from 'fs';

const closestPath = (currentPath: string = path.resolve(), selectors = 'package.json', layers = 1): string => {
  if (fs.existsSync(path.join(currentPath, selectors))) {
    if (layers === 1)
      return currentPath;

    return closestPath(path.join(currentPath, '..'), selectors, layers - 1);
  }

  return closestPath(path.join(currentPath, '..'), selectors, layers);
};

export default closestPath;
