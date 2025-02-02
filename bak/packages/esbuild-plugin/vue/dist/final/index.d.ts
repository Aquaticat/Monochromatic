import type { Plugin } from 'esbuild';
declare const toTsWoCache: (input: string, inputPath: string) => Promise<string>;
export declare const toTs: typeof toTsWoCache;
declare const _default: (options?: {
    save?: boolean | string | string[];
}) => Plugin;
export default _default;
