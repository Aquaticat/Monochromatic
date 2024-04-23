import { exec as execOriginal } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { promisify } from 'node:util';

const exec = promisify(execOriginal);
const shell = '/bin/bash';

console.log('br.mjs');

readdirSync('temp', { recursive: true }).forEach(async (filePath) => {
  console.log(`br ${filePath}`, await exec(`br -f -q 11 ${filePath}`, { shell }).stdout);
});
