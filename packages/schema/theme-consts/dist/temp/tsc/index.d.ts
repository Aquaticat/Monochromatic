import { z } from 'zod';
declare const _default: z.ZodReadonly<z.ZodObject<{
    title: z.ZodString;
    description: z.ZodString;
    author: z.ZodString;
    site: z.ZodString;
    base: z.ZodEffects<z.ZodString, string, string>;
    license: z.ZodReadonly<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, {
        name: string;
        url: string;
    }, string>>;
    theming: z.ZodReadonly<z.ZodObject<{
        color: z.ZodEffects<z.ZodString, string, string>;
        shiki: z.ZodReadonly<z.ZodObject<{
            light: z.ZodString;
            dark: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            light: string;
            dark: string;
        }, {
            light: string;
            dark: string;
        }>>;
    }, "strip", z.ZodTypeAny, {
        color: string;
        shiki: Readonly<{
            light: string;
            dark: string;
        }>;
    }, {
        color: string;
        shiki: {
            light: string;
            dark: string;
        };
    }>>;
    socials: z.ZodReadonly<z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodString>, Map<string, string>, Record<string, string>>>;
    links: z.ZodReadonly<z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodString>, Map<string, string>, Record<string, string>>>;
    langs: z.ZodReadonly<z.ZodEffects<z.ZodEffects<z.ZodRecord<z.ZodEffects<z.ZodString, string, string>, z.ZodReadonly<z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "atleastone">>>, Record<string, readonly [string, ...string[]]>, Record<string, [string, ...string[]]>>, {
        defaultLang: string;
        paths: readonly string[];
        langs: readonly string[];
        mappings: Readonly<unknown>;
    }, Record<string, [string, ...string[]]>>>;
    strings: z.ZodReadonly<z.ZodEffects<z.ZodRecord<z.ZodEffects<z.ZodString, string, string>, z.ZodRecord<z.ZodString, z.ZodString>>, Map<string, Readonly<Map<string, string>>>, Record<string, Record<string, string>>>>;
}, "strip", z.ZodTypeAny, {
    title: string;
    description: string;
    author: string;
    site: string;
    base: string;
    license: Readonly<{
        name: string;
        url: string;
    }>;
    theming: Readonly<{
        color: string;
        shiki: Readonly<{
            light: string;
            dark: string;
        }>;
    }>;
    socials: ReadonlyMap<string, string>;
    links: ReadonlyMap<string, string>;
    langs: Readonly<{
        defaultLang: string;
        paths: readonly string[];
        langs: readonly string[];
        mappings: Readonly<unknown>;
    }>;
    strings: ReadonlyMap<string, Readonly<Map<string, string>>>;
}, {
    title: string;
    description: string;
    author: string;
    site: string;
    base: string;
    license: string;
    theming: {
        color: string;
        shiki: {
            light: string;
            dark: string;
        };
    };
    socials: Record<string, string>;
    links: Record<string, string>;
    langs: Record<string, [string, ...string[]]>;
    strings: Record<string, Record<string, string>>;
}>>;
export default _default;
export declare const typescriptType = "{\n  title: string;\n  description: string;\n  author: string;\n  site: string;\n  base: string;\n  license: {\n    name: string;\n    url: string;\n  };\n  theming: { color: string; shiki: { light: string; dark: string } };\n  socials: ReadonlyMap<string, string>;\n  links: ReadonlyMap<string, string>;\n  langs: {\n    defaultLang: string;\n    paths: readonly ['', ...string[]];\n    langs: readonly string[];\n    mappings: ReadonlyMap<string, string>;\n  };\n  strings: ReadonlyMap<string, ReadonlyMap<string, string>>;\n}";
//# sourceMappingURL=index.d.ts.map