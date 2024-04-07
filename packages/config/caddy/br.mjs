import { exec as execOriginal } from 'node:child_process';
import { promisify } from 'node:util';
import { readdirSync } from 'node:fs';

const exec = promisify(execOriginal);
const shell = '/bin/bash';

console.log('br.mjs');

readdirSync('temp', { recursive: true }).forEach(async (filePath) => {
  console.log(`br ${filePath}`, await exec(`br -f -q 11 ${filePath}`, { shell }).stdout);
});
