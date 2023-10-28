import {
  parse,
} from '@ltd/j-toml';

import {
  readFileSync,
  copyFileSync,
  readdirSync,
  lstatSync,
  existsSync,
} from 'fs';

import {
  join,
} from 'path';

const depDir = 'node_modules';

const cpfdConfText = readFileSync('cpfd.toml', { encoding: 'utf8' });

const cpfdConf = parse(cpfdConfText);

const ignoredFiles = [];

console.log(JSON.stringify(cpfdConf, null, 2));

const traverseDepDir = (specifiers, dirs = [depDir]) => {
  if (specifiers.length > 0 && existsSync(join(...dirs))) {
    return lstatSync(join(...dirs).isDirectory)
      ? (readdirSync(join(...dirs)).filter((installed) => installed.match(specifiers[0]))).map((matched) =>
        traverseDepDir(specifiers.slice(1), [...dirs, matched])
      )
      : dirs.at(-1).match(specifiers.at(0))
      ? [...dirs, specifiers[0]]
      : dirs;
  }

  return dirs;
};

const traverseCpfdConf = (conf, keys = []) => {
  if (typeof conf === 'object') {
    Object.entries(conf).forEach(([k, v]) => {
      traverseCpfdConf(v, [...keys, k]);
    });
  } else if (['string', 'boolean'].includes(typeof conf)) {
    const files = JSON.stringify(traverseDepDir(keys)).match(/\[(?:"|,|_|@|-|\.|\w)+?]/g)?.map((matchedStr) =>
      JSON.parse(matchedStr)
    );

    if (!files)
      return;

    console.log(`${keys}: ${JSON.stringify(conf)}`, JSON.stringify(files));

    if (conf === false)
      ignoredFiles.concat(files);
    else {
      files.filter((file) => !ignoredFiles.includes(file)).forEach((file) => {
        if (lstatSync(join(...file)).isFile())
          copyFileSync(join(...file), conf === true ? file.at(-1) : file.at(-1).replace(keys.at(-1), conf));
      });
    }
  } else {
    throw new TypeError(`Invalid cpfdconf ${keys}: ${JSON.stringify(conf)}`);
  }
};

traverseCpfdConf(cpfdConf);
