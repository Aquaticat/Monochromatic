## API Report File for "@monochromatic.dev/module-pm"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

// @public
function pm(fileOrFolderInPkgAbsPath?: string): Promise<{
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
export default pm;

// (No @packageDocumentation comment for this package)

```
