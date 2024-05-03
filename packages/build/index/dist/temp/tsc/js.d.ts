import * as esbuild from 'esbuild';
import type { State } from './state.ts';
export declare const esbuildOptions: (entryPoints?: [string, ...string[]], outdir?: string) => esbuild.BuildOptions;
export default function indexJs(globCache?: import("./g.ts").MGlob): Promise<State>;
//# sourceMappingURL=js.d.ts.map