import {
  parse,
} from '@ltd/j-toml';

import {
  readFileSync,
  copyFileSync,
  cpSync,
  readdirSync,
  lstatSync,
  existsSync,
  readlinkSync,
  constants,
  mkdirSync,
} from 'fs';

import {
  join,
} from 'path';

const ensureDirExist = (...dir: string[]): void => {
  existsSync(join(...dir)) || mkdirSync(join(...dir), { recursive: true });
};

const js = JSON.stringify;

/* // From https://stackoverflow.com/a/64093016
const partition = (array: any[], predicate: (arg0: any) => boolean): any[][] =>
  array.reduce((acc, item: any) =>
    predicate(item)
      ? (acc[0].push(item), acc)
      : (acc[1].push(item), acc), [[], []]); */

const depDir = 'node_modules';

const cpfdConfText = readFileSync('cpfd.toml', { encoding: 'utf8' });

type CpfdConf = { [key: string]: CpfdConfInner; };

type CpfdConfInner = boolean | string | (true | string[])[] | { [key: string]: CpfdConfInner; };

const cpfdConf = parse(cpfdConfText) as CpfdConf;

console.log(js(cpfdConf, null, 2));

const ignoredFiles: string[][] = [];

const traverseDepDir = (specifiers: string[], dirs = [depDir]): string[][] => {
  if (!existsSync(join(...dirs))) {
    console.debug(`dirs don't exist. (dirs: ${js(dirs)}) => []`);
    return [];
  }

  if (specifiers.length > 0) {
    const matches = readdirSync(join(...dirs), { withFileTypes: true }).filter((installed) =>
      installed.name.match(specifiers.at(0)!)
    );

    const matchedDirs = matches.filter((matched) =>
      matched.isDirectory()
      || (matched.isSymbolicLink() && lstatSync(readlinkSync(join(matched.path, matched.name))).isDirectory())
    );
    const matchedFiles = matches.filter((matched) =>
      matched.isFile()
      || (matched.isSymbolicLink() && lstatSync(readlinkSync(join(matched.path, matched.name))).isFile())
    );

    if (matchedDirs.length > 0 && matchedFiles.length > 0) {
      console.debug(
        `matchedDirs: ${js(matchedDirs)}, matchedFiles: ${js(matchedFiles)}`,
      );
    }

    return [
      ...matchedFiles.map((matchedFile) => [...dirs, matchedFile.name]),
      ...matchedDirs.flatMap((matchedDir) => traverseDepDir(specifiers.slice(1), [...dirs, matchedDir.name])),
    ];
  }

  console.debug(`end of specifier. => [${js(dirs)}]`);
  return [dirs];
};

const traverseCpfdConf = (conf: CpfdConfInner, keys: string[] = []) => {
  if (typeof conf === 'object' && !Array.isArray(conf)) {
    Object.entries(conf).forEach(([k, v]) => {
      traverseCpfdConf(v, [...keys, k]);
    });
  } else if (
    (Array.isArray(conf) && conf.every((confSubArrOrTrue) =>
      (Array.isArray(confSubArrOrTrue) && confSubArrOrTrue.every((confSubArrItem) =>
        typeof confSubArrItem === 'string'
      )) || confSubArrOrTrue === true
    )) || ['string', 'boolean'].includes(typeof conf)
  ) {
    const files = traverseDepDir(keys);

    console.log(`${js(keys)}: ${js(conf)}, files: ${js(files)}`);

    if (conf === false)
      ignoredFiles.concat(files);
    else {
      files.filter((file) => !ignoredFiles.includes(file)).forEach((file) => {
        const dess: string[][] = conf === true
          ? [[file.at(-1)!]]
          : typeof conf === 'string'
          ? [[file.at(-1)!
            .replace(new RegExp(keys.at(-1)!), conf)]]
          : conf.map((confItem): string[] =>
            confItem === true
              ? [file.at(-1)!]
              : confItem.map((confItemPathSeg) =>
                file.at(-1)!
                  .replace(new RegExp(keys.at(-1)!), confItemPathSeg)
              )
          );

        console.log(`dess: ${js(dess)}`);

        /* ROADMAP: Current mode is skip files and dirs that already exist.
           I should provide a way to change mode
           but it's hard to do with the current config structure. */
        dess.forEach((des) => {
          if (!existsSync(join(...des))) {
            if (
              lstatSync(join(...file)).isFile()
              || (lstatSync(join(...file)).isSymbolicLink() && lstatSync(readlinkSync(join(...file))).isFile())
            ) {
              ensureDirExist(join(...des.slice(0, -1)));
              copyFileSync(
                join(...file),
                join(...des),
                constants.COPYFILE_EXCL,
              );
            } else if (
              lstatSync(join(...file)).isDirectory()
              || (lstatSync(join(...file)).isSymbolicLink() && lstatSync(readlinkSync(join(...file))).isDirectory())
            ) {
              cpSync(
                join(...file),
                join(...des),
                {
                  dereference: true,
                  errorOnExist: false,
                  force: false,
                  recursive: true,
                },
              );
            } else {
              throw new TypeError(`file: ${js(file)} not file or dir`);
            }
          } else {
            console.log(`existing des: ${js(des)} skipped`);
          }
        });
      });
    }
  } else {
    throw new TypeError(`Invalid cpfdconf ${keys}: ${js(conf)}`);
  }
};

traverseCpfdConf(cpfdConf);
