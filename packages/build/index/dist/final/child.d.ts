/// <reference types="node" />
/// <reference types="node" />
import { Buffer } from 'node:buffer';
import { exec } from 'node:child_process';
declare const execP: typeof exec.__promisify__;
export default function $(...args: Parameters<typeof execP>): Promise<{
    stdoe: string | Buffer;
    stdout: string | Buffer;
    stderr: string | Buffer;
}>;
export declare const js: {
    (value: any, replacer?: ((this: any, key: string, value: any) => any) | undefined, space?: string | number | undefined): string;
    (value: any, replacer?: (string | number)[] | null | undefined, space?: string | number | undefined): string;
};
export {};
//# sourceMappingURL=child.d.ts.map