import c from '@monochromatic.dev/module-console';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  equals,
  piped,
} from 'rambdax';
import { z } from 'zod';

const MapOfNameAndContentFromDirPathObject = z
  .object({
    root: z.string(),
    dir: z.string(),
    base: z.string(),
    ext: z.string(),
    name: z.string(),
  })
  .transform((val) => piped(val, path.format, path.normalize))
  .refine((val) => fs.existsSync(val) && fs.lstatSync(val).isDirectory())
  .transform((val) =>
    piped(
      val,
      (normalizedPath) =>
        fs
          .readdirSync(normalizedPath, { withFileTypes: true, recursive: true })
          .filter((dirent) => dirent.isFile())
          .map((dirent): readonly [string, string] =>
            Object.freeze([dirent.name, fs.readFileSync(path.join(val, dirent.name), { encoding: 'utf8' })])
          ),
      (mappings) => new Map(mappings),
      (map) => Object.freeze(map),
    )
  );

const ContentFromFilePathObject = z
  .object({
    root: z.string(),
    dir: z.string(),
    base: z.string(),
    ext: z.string(),
    name: z.string(),
  })
  .transform((val) => piped(val, path.format, path.normalize))
  .refine((val) => fs.existsSync(val) && fs.lstatSync(val).isFile())
  .transform((val) => fs.readFileSync(val, { encoding: 'utf8' }));

export default (...args) => {
  // either all the args are file path objects
  // or all the args are dir path objects
  // otherwise compare normally

  try {
    const contents = args.map((arg) => ContentFromFilePathObject.parse(arg));
    c.info(contents);
    return contents.every((content) => equals(content, contents[0]));
  } catch (notFilePathObjectError) {
    c.info(notFilePathObjectError);
    try {
      const maps = args.map((arg) => MapOfNameAndContentFromDirPathObject.parse(arg));
      c.info(maps);
      return maps.every((map) => equals(map, maps[0]));
    } catch (notDirPathObjectError) {
      c.info(notDirPathObjectError);
      c.info(...args);
      return args.every((arg) => equals(arg, args[0]));
    }
  }
};
