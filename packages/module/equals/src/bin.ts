import equals from './index.js';
import { pipe } from 'effect';
import c from '@monochromatic.dev/module-console';

const positionals = process.argv.slice(2);

switch (true) {
  case positionals.length >= 2: {
    const result = pipe(
      positionals,
      (positionals) =>
        positionals.map((positional) => {
          let json: JSON;
          try {
            json = JSON.parse(positional);
            c.debug(json);
            return json;
          } catch (error) {
            c.warn(error);
            return positional;
          }
        }),
      (processedPositionals) => equals(...processedPositionals),
    );
    console.log(result);
    process.exitCode = result ? 0 : 1;
    break;
  }

  default: {
    throw new RangeError(`Expected 2 arguments, got ${process.argv.length - 2} arguments.`);
  }
}
