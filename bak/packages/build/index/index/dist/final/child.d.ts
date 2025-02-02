import { Buffer } from 'node:buffer';
import { exec } from 'node:child_process';
declare const execP: typeof exec.__promisify__;
export default function (...args: Parameters<typeof execP>): Promise<{
    stdoe: string | Buffer;
    stdout: string | Buffer;
    stderr: string | Buffer;
}>;
export declare const js: typeof JSON.stringify;
export {};
