export declare const importsPath: (potentialImportsSpecifier: string, from?: string) => Promise<string>;

export declare const packageFilePath: (potentialPackageWithIdentifier: string) => Promise<string>;

export declare const packageIdentifierSplitter: {
    [Symbol.split](str: string): [string, string];
};

export declare const prefixOf: (strs_0: string, ...strs_1: string[]) => string;

declare function resolve(specifier: string, from?: string): Promise<string>;
export default resolve;

export declare const tsconfigAliasedPath: (potentialTsconfigAlias: string, from?: string, pkgJsonAbsPath?: string) => Promise<string>;

export { }
