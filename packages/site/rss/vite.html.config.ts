import {
  getFrontend,
  type UserConfigFnObject,
} from '@monochromatic-dev/config-vite/.ts';

const _default_1: UserConfigFnObject = getFrontend(import.meta.dirname, {singleFile: false});
export default _default_1;
