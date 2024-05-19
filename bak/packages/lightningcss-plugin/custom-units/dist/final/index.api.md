## API Report File for "@monochromatic.dev/lightningcss-plugin-custom-units"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts

// @public (undocumented)
const _default: {
    Token: {
        dimension(token: {
            type: "dimension";
            unit: string;
            value: number;
        }): {
            type: "function";
            value: {
                name: string;
                arguments: ({
                    type: "token";
                    value: {
                        type: "number";
                        value: number;
                        name?: never;
                    };
                } | {
                    type: "token";
                    value: {
                        type: "delim";
                        value: string;
                        name?: never;
                    };
                } | {
                    type: "var";
                    value: {
                        name: {
                            ident: string;
                        };
                        type?: never;
                        value?: never;
                    };
                })[];
            };
        } | undefined;
    };
};
export default _default;

// (No @packageDocumentation comment for this package)

```