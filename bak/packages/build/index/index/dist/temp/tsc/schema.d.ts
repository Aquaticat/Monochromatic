/// <reference types="node" resolution-mode="require"/>
import { z } from 'zod';
export declare const zPost: z.ZodPipeline<z.ZodEffects<z.ZodEffects<z.ZodObject<{
    author: z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>;
    title: z.ZodString;
    siteTitle: z.ZodString;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    site: z.ZodString;
    license: z.ZodPipeline<z.ZodUnion<[z.ZodReadonly<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, {
        name: string;
        url: string;
    }, string>>, z.ZodReadonly<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>>]>, z.ZodReadonly<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>>>;
    path: z.ZodReadonly<z.ZodObject<{
        dir: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        dir: string;
    }, {
        name: string;
        dir: string;
    }>>;
    pkgJsonAbsPath: z.ZodString;
    modified: z.ZodOptional<z.ZodUnknown>;
    published: z.ZodOptional<z.ZodUnknown>;
    lang: z.ZodString;
    theming: z.ZodReadonly<z.ZodObject<{
        color: z.ZodString;
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
    socials: z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    author: z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>;
    title: z.ZodString;
    siteTitle: z.ZodString;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    site: z.ZodString;
    license: z.ZodPipeline<z.ZodUnion<[z.ZodReadonly<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, {
        name: string;
        url: string;
    }, string>>, z.ZodReadonly<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>>]>, z.ZodReadonly<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>>>;
    path: z.ZodReadonly<z.ZodObject<{
        dir: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        dir: string;
    }, {
        name: string;
        dir: string;
    }>>;
    pkgJsonAbsPath: z.ZodString;
    modified: z.ZodOptional<z.ZodUnknown>;
    published: z.ZodOptional<z.ZodUnknown>;
    lang: z.ZodString;
    theming: z.ZodReadonly<z.ZodObject<{
        color: z.ZodString;
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
    socials: z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    author: z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>;
    title: z.ZodString;
    siteTitle: z.ZodString;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    site: z.ZodString;
    license: z.ZodPipeline<z.ZodUnion<[z.ZodReadonly<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, {
        name: string;
        url: string;
    }, string>>, z.ZodReadonly<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>>]>, z.ZodReadonly<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>>>;
    path: z.ZodReadonly<z.ZodObject<{
        dir: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        dir: string;
    }, {
        name: string;
        dir: string;
    }>>;
    pkgJsonAbsPath: z.ZodString;
    modified: z.ZodOptional<z.ZodUnknown>;
    published: z.ZodOptional<z.ZodUnknown>;
    lang: z.ZodString;
    theming: z.ZodReadonly<z.ZodObject<{
        color: z.ZodString;
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
    socials: z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.ZodTypeAny, "passthrough">>, {
    description: string;
    fullTitle: string;
    lang: string;
    siteBase: string;
    mdxContent: string;
    fullUrlWIndexWoExt: import("url").URL;
    fullUrlWIndexWExt: import("url").URL;
    modified: readonly {
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }[] | readonly [{
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }, ...{
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }[]] | readonly {
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }[] | readonly [{
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }, ...{
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }[]];
    published: readonly {
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }[] | readonly [{
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }, ...{
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }[]] | readonly {
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }[] | readonly [{
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }, ...{
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }[]];
    path: Readonly<{
        name: string;
        dir: string;
    }>;
    author: {
        name: string;
        url: string;
    };
    title: string;
    siteTitle: string;
    tags: string[];
    site: string;
    license: Readonly<{
        name: string;
        url: string;
    }>;
    pkgJsonAbsPath: string;
    theming: Readonly<{
        color: string;
        shiki: Readonly<{
            light: string;
            dark: string;
        }>;
    }>;
    socials: Readonly<Record<string, string>>;
}, z.objectInputType<{
    author: z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>;
    title: z.ZodString;
    siteTitle: z.ZodString;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    site: z.ZodString;
    license: z.ZodPipeline<z.ZodUnion<[z.ZodReadonly<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, {
        name: string;
        url: string;
    }, string>>, z.ZodReadonly<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>>]>, z.ZodReadonly<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>>>;
    path: z.ZodReadonly<z.ZodObject<{
        dir: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        dir: string;
    }, {
        name: string;
        dir: string;
    }>>;
    pkgJsonAbsPath: z.ZodString;
    modified: z.ZodOptional<z.ZodUnknown>;
    published: z.ZodOptional<z.ZodUnknown>;
    lang: z.ZodString;
    theming: z.ZodReadonly<z.ZodObject<{
        color: z.ZodString;
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
    socials: z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.ZodTypeAny, "passthrough">>, {
    siteWithBase: string | import("url").URL;
    canonicalUrl: import("url").URL;
    summary: string;
    description: string;
    fullTitle: string;
    lang: string;
    siteBase: string;
    mdxContent: string;
    fullUrlWIndexWoExt: import("url").URL;
    fullUrlWIndexWExt: import("url").URL;
    modified: readonly {
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }[] | readonly [{
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }, ...{
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }[]] | readonly {
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }[] | readonly [{
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }, ...{
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }[]];
    published: readonly {
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }[] | readonly [{
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }, ...{
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }[]] | readonly {
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }[] | readonly [{
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }, ...{
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }[]];
    path: Readonly<{
        name: string;
        dir: string;
    }>;
    author: {
        name: string;
        url: string;
    };
    title: string;
    siteTitle: string;
    tags: string[];
    site: string;
    license: Readonly<{
        name: string;
        url: string;
    }>;
    pkgJsonAbsPath: string;
    theming: Readonly<{
        color: string;
        shiki: Readonly<{
            light: string;
            dark: string;
        }>;
    }>;
    socials: Readonly<Record<string, string>>;
}, z.objectInputType<{
    author: z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>;
    title: z.ZodString;
    siteTitle: z.ZodString;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    site: z.ZodString;
    license: z.ZodPipeline<z.ZodUnion<[z.ZodReadonly<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, {
        name: string;
        url: string;
    }, string>>, z.ZodReadonly<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>>]>, z.ZodReadonly<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>>>;
    path: z.ZodReadonly<z.ZodObject<{
        dir: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        dir: string;
    }, {
        name: string;
        dir: string;
    }>>;
    pkgJsonAbsPath: z.ZodString;
    modified: z.ZodOptional<z.ZodUnknown>;
    published: z.ZodOptional<z.ZodUnknown>;
    lang: z.ZodString;
    theming: z.ZodReadonly<z.ZodObject<{
        color: z.ZodString;
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
    socials: z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodString>>;
}, z.ZodTypeAny, "passthrough">>, z.ZodObject<{
    title: z.ZodString;
    siteTitle: z.ZodString;
    fullTitle: z.ZodString;
    description: z.ZodString;
    site: z.ZodString;
    siteBase: z.ZodString;
    siteWithBase: z.ZodString;
    mdxContent: z.ZodString;
    fullUrlWIndexWoExt: z.ZodString;
    fullUrlWIndexWExt: z.ZodString;
    canonicalUrl: z.ZodString;
    license: z.ZodReadonly<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>>;
    lang: z.ZodString;
    path: z.ZodReadonly<z.ZodObject<{
        dir: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        dir: string;
    }, {
        name: string;
        dir: string;
    }>>;
    theming: z.ZodReadonly<z.ZodObject<{
        color: z.ZodString;
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
    socials: z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodString>>;
    summary: z.ZodString;
    tags: z.ZodArray<z.ZodString, "many">;
    published: z.ZodReadonly<z.ZodArray<z.ZodObject<{
        date: z.ZodDate;
        author: z.ZodObject<{
            name: z.ZodString;
            url: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            url: string;
        }, {
            name: string;
            url: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }, {
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }>, "atleastone">>;
    modified: z.ZodReadonly<z.ZodArray<z.ZodObject<{
        date: z.ZodDate;
        author: z.ZodObject<{
            name: z.ZodString;
            url: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            url: string;
        }, {
            name: string;
            url: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }, {
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }>, "atleastone">>;
}, "strip", z.ZodTypeAny, {
    path: Readonly<{
        name: string;
        dir: string;
    }>;
    title: string;
    siteTitle: string;
    tags: string[];
    site: string;
    license: Readonly<{
        name: string;
        url: string;
    }>;
    modified: readonly [{
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }, ...{
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }[]];
    published: readonly [{
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }, ...{
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }[]];
    lang: string;
    theming: Readonly<{
        color: string;
        shiki: Readonly<{
            light: string;
            dark: string;
        }>;
    }>;
    socials: Readonly<Record<string, string>>;
    description: string;
    fullTitle: string;
    siteBase: string;
    mdxContent: string;
    fullUrlWIndexWoExt: string;
    fullUrlWIndexWExt: string;
    siteWithBase: string;
    canonicalUrl: string;
    summary: string;
}, {
    path: {
        name: string;
        dir: string;
    };
    title: string;
    siteTitle: string;
    tags: string[];
    site: string;
    license: {
        name: string;
        url: string;
    };
    modified: [{
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }, ...{
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }[]];
    published: [{
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }, ...{
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }[]];
    lang: string;
    theming: {
        color: string;
        shiki: {
            light: string;
            dark: string;
        };
    };
    socials: Record<string, string>;
    description: string;
    fullTitle: string;
    siteBase: string;
    mdxContent: string;
    fullUrlWIndexWoExt: string;
    fullUrlWIndexWExt: string;
    siteWithBase: string;
    canonicalUrl: string;
    summary: string;
}>>;
//# sourceMappingURL=schema.d.ts.map