import {createRequire} from 'node:module';

export {parse} from "yuku-parser";
export const parserPath=createRequire(import.meta.url)
  .resolve('yuku-parser');
