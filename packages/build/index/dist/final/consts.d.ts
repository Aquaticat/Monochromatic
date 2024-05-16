import pm from '@monochromatic.dev/module-pm';
import { Glob, type GlobOptions } from 'glob';
export declare const mGlobPatten: string[];
export declare const mGlobOptions: {
    ignore: string[];
    nodir: boolean;
    maxDepth: number;
};
export type MGlobOptions = typeof mGlobOptions;
export type MGlob = Glob<Omit<GlobOptions, 'withFileTypes'>>;
declare const _default_1: (pattern?: string | string[] | undefined, options?: Omit<GlobOptions, "withFileTypes"> | undefined) => MGlob;
export default _default_1;
export declare const indexJsFilePaths: string[];
export declare const mdxFilePaths: string[];
export declare const outMdxImportPathToNames: Map<string, string>;
export declare const outMdxImportStr: string;
export declare const outTomlImportPathToNames: Map<string, string>;
export declare const outTomlImportStr: string;
export declare const indexVueFilePaths: string[];
export declare const outIndexVueImportPathToNames: Map<string, string>;
export declare const outIndexVueImportStr: string;
export declare const cssFilePaths: string[];
export declare const cssJsFilePaths: string[];
export declare const otherFilePaths: string[];
export declare const caddyConfFilePath: string;
export { default as external } from './_/external.ts';
export { default as esbuildOptions } from './_/esbuildOptions.ts';
export declare const fromPm: Awaited<ReturnType<typeof pm>>;
export declare const cacheRootDir: string;
