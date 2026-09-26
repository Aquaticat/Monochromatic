import { copyArray, } from './conversions.prototype.ts';
// @ts-expect-error control: this line compiles, so tsc must report TS2578
export const control = copyArray(['kiwi',],);
