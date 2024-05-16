import type { State } from '@/src/state.ts';
export declare const supportedRasterImageExtsWoDot: string[];
export declare const outputSmallIconSizes: number[];
export declare const outputFaviconSizes: number[];
export declare const outputPictureSizes: number[];
export declare const genPngFromSvg: (inputImageAbsPath: string, lang?: string, outputSizes?: number[]) => Promise<State>;
export default function genOptimizedImages(inputImageAbsPath: string, outputSizes?: number[]): Promise<State>;
