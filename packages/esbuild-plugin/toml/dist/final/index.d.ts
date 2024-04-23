import type { Plugin } from 'esbuild';
import { ZodObject } from 'zod';
import { ZodPipeline } from 'zod';

declare function toml(mergeParent?: string, schema?: ZodPipeline<any, any> | ZodObject<any>, injectMetadata?: boolean): Plugin;
export default toml;

export { }
