import { Glob, type GlobOptions } from 'glob';
export declare const mGlobPatten: string[];
export declare const mGlobOptions: {
    ignore: string[];
    nodir: boolean;
    maxDepth: number;
};
export type MGlobOptions = typeof mGlobOptions;
export type MGlob = Glob<Omit<GlobOptions, 'withFileTypes'>>;
declare const _default: (pattern?: string | string[] | undefined, options?: Omit<GlobOptions, "withFileTypes"> | undefined) => MGlob;
export default _default;
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
export declare const otherFilePaths: string[];
//# sourceMappingURL=g.d.ts.map