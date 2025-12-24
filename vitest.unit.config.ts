import { getVitestUnitWorkspace, } from '@monochromatic-dev/config-vite';
// import { vitestOnlyUnitConfigWorkspace, } from '@monochromatic-dev/config-vite';

import type { UserConfigFnObject, } from 'vite';

const _default_1: UserConfigFnObject = getVitestUnitWorkspace(import.meta.dirname,);
// const _default_1: UserConfigFnObject = vitestOnlyUnitConfigWorkspace;
export default _default_1;
