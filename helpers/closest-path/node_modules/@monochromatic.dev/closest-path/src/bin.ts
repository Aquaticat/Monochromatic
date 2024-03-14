#!/usr/bin/env bun

import * as path from 'node:path';
import closestPath from './index.js';

switch (process.argv.length) {
  case 2: {
    console.log(await closestPath());
    break;
  }
  case 3: {
    console.log(await closestPath(path.resolve(), process.argv[2]));
    break;
  }
  case 4: {
    if (!process.argv[2]) {
      throw TypeError(`Invalid ${process.argv[2]}`);
    }

    if (process.argv[2].startsWith('/')) {
      console.log(await closestPath(process.argv[2]!, process.argv[3]));
    } else {
      console.log(await closestPath(path.join(path.resolve(), process.argv[2]!), process.argv[3]));
    }
    break;
  }

  default: {
    throw RangeError(`Expected 0 to 2 arguments, got ${process.argv.length - 2} arguments.`);
  }
}
