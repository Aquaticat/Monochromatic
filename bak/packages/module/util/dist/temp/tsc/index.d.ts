/** Detect which pm and install strategy is used for the specified file or folder inside a npm package

@remarks
Does not support yarn classic.
Supports independent packages or package in workspace.

@param fileOrFolderInPkgAbsPath - string of absolute path of any file or folder in package, defaults to path.resolve()

@returns an object containing packageManager and nodeLinker, as specified by https://pnpm.io/npmrc#node-linker
 */
export default function pm(fileOrFolderInPkgAbsPath?: string): Promise<{
    packageManager: 'pnpm';
    nodeLinker: 'isolated' | 'hoisted' | 'pnp';
} | {
    packageManager: 'bun';
    nodeLinker: 'hoisted';
} | {
    packageManager: 'yarn';
    nodeLinker: 'isolated' | 'hoisted' | 'pnp';
} | {
    packageManager: 'npm';
    nodeLinker: 'hoisted';
}>;
//# sourceMappingURL=index.d.ts.map