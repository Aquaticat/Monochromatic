import type { Plugin } from 'esbuild';
type Options = {
    mergeParent?: boolean | string | string[];
    schema?: {
        parseAsync(input: any): Promise<any>;
    } | {
        parse(input: any): any;
    } | false;
    injectMetadata?: boolean;
    save?: boolean | string | string[];
};
declare const tomlToJsWoCache: (input: string, inputPath: string, options?: Options) => Promise<string>;
export declare const tomlToJs: typeof tomlToJsWoCache;
/**
@param options Object Options
*/
declare const _default: (options?: Options) => Plugin;
export default _default;
