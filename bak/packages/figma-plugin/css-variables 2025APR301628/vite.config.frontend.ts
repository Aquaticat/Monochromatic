import { getFigmaFrontend } from '@monochromatic-dev/config-vite';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));

export default getFigmaFrontend(__dirname);
