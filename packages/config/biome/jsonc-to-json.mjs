import jSONC from 'jsonc-simple-parser';
import {readFileSync, writeFileSync} from 'node:fs';

writeFileSync('index.json', JSON.stringify(jSONC.parse(readFileSync('index.jsonc', {encoding: 'utf8'})), null, 2));
