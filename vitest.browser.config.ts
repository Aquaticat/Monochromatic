// import { getVitestBrowserWorkspace, } from '@monochromatic-dev/config-vite';
import { vitestOnlyBrowserConfigWorkspace, } from '@monochromatic-dev/config-vite';

import type { UserConfigFnObject, } from 'vite';

// const _default_1: UserConfigFnObject = getVitestBrowserWorkspace(import.meta.dirname,);
const _default_1: UserConfigFnObject = vitestOnlyBrowserConfigWorkspace;
export default _default_1;
