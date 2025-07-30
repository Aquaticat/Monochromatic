import { getFigmaIframe, } from '@monochromatic-dev/config-vite/.ts';
import { dirname, } from 'node:path';
import { fileURLToPath, } from 'node:url';
import type { UserConfigFnObject, } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url,),);

const _default_1: UserConfigFnObject = getFigmaIframe(__dirname,);
export default _default_1;
