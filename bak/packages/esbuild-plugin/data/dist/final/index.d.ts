import type { Plugin } from 'esbuild';
type Options = {
    mergeParent?: boolean | string | string[];
    schema?: {
        parseAsync(input: any): Promise<any>;
    } | {
        parse(input: any): any;
    } | false;
    injectMetadata?: boolean;
};
declare const toJsWoCache: (input: string, inputPath: string, options?: Options) => Promise<string>;
export declare const toJs: typeof toJsWoCache;
/**
@param options Object Options
*/
declare const _default: (options?: Options & {
    save?: boolean | string | string[];
}) => Plugin;
export default _default;
