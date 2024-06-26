import { z } from 'zod';
export declare const zChronoDate: z.ZodEffects<z.ZodDate, Date, unknown>;
export declare const zAuthor: z.ZodObject<{
    name: z.ZodString;
    url: z.ZodString;
}, "strict", z.ZodTypeAny, {
    name: string;
    url: string;
}, {
    name: string;
    url: string;
}>;
export declare const zBlame: z.ZodPipeline<z.ZodObject<{
    date: z.ZodEffects<z.ZodDate, Date, unknown>;
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
}, "strict", z.ZodTypeAny, {
    date: Date;
    author: {
        name: string;
        url: string;
    };
}, {
    author: {
        name: string;
        url: string;
    };
    date?: unknown;
}>, z.ZodObject<{
    date: z.ZodDate;
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
}>>;
export declare const zBlames: z.ZodPipeline<z.ZodArray<z.ZodPipeline<z.ZodObject<{
    date: z.ZodEffects<z.ZodDate, Date, unknown>;
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
}, "strict", z.ZodTypeAny, {
    date: Date;
    author: {
        name: string;
        url: string;
    };
}, {
    author: {
        name: string;
        url: string;
    };
    date?: unknown;
}>, z.ZodObject<{
    date: z.ZodDate;
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
}>>, "atleastone">, z.ZodArray<z.ZodObject<{
    date: z.ZodDate;
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
declare const zPost: z.ZodPipeline<z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodEffects<z.ZodObject<{
    path: z.ZodObject<{
        dir: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        dir: string;
    }, {
        name: string;
        dir: string;
    }>;
    pkgJsonAbsPath: z.ZodString;
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
    earliest: z.ZodOptional<z.ZodEffects<z.ZodDate, Date, unknown>>;
    isHome: z.ZodOptional<z.ZodBoolean>;
    isLinks: z.ZodOptional<z.ZodBoolean>;
    is404: z.ZodOptional<z.ZodBoolean>;
    isPost: z.ZodOptional<z.ZodBoolean>;
    lang: z.ZodString;
    latest: z.ZodOptional<z.ZodEffects<z.ZodDate, Date, unknown>>;
    license: z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodString, {}, string>, z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>]>, z.ZodReadonly<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>>>;
    links: z.ZodReadonly<z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodString>, Map<string, string>, Record<string, string>>, z.ZodMap<z.ZodString, z.ZodString>]>, z.ZodMap<z.ZodString, z.ZodString>>>;
    updated: z.ZodOptional<z.ZodUnknown>;
    published: z.ZodOptional<z.ZodUnknown>;
    site: z.ZodString;
    siteTitle: z.ZodString;
    socials: z.ZodReadonly<z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodString>, Map<string, string>, Record<string, string>>, z.ZodMap<z.ZodString, z.ZodString>]>, z.ZodMap<z.ZodString, z.ZodString>>>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    theming: z.ZodObject<{
        color: z.ZodString;
        shiki: z.ZodObject<{
            light: z.ZodString;
            dark: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            light: string;
            dark: string;
        }, {
            light: string;
            dark: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        color: string;
        shiki: {
            light: string;
            dark: string;
        };
    }, {
        color: string;
        shiki: {
            light: string;
            dark: string;
        };
    }>;
    title: z.ZodString;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    path: z.ZodObject<{
        dir: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        dir: string;
    }, {
        name: string;
        dir: string;
    }>;
    pkgJsonAbsPath: z.ZodString;
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
    earliest: z.ZodOptional<z.ZodEffects<z.ZodDate, Date, unknown>>;
    isHome: z.ZodOptional<z.ZodBoolean>;
    isLinks: z.ZodOptional<z.ZodBoolean>;
    is404: z.ZodOptional<z.ZodBoolean>;
    isPost: z.ZodOptional<z.ZodBoolean>;
    lang: z.ZodString;
    latest: z.ZodOptional<z.ZodEffects<z.ZodDate, Date, unknown>>;
    license: z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodString, {}, string>, z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>]>, z.ZodReadonly<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>>>;
    links: z.ZodReadonly<z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodString>, Map<string, string>, Record<string, string>>, z.ZodMap<z.ZodString, z.ZodString>]>, z.ZodMap<z.ZodString, z.ZodString>>>;
    updated: z.ZodOptional<z.ZodUnknown>;
    published: z.ZodOptional<z.ZodUnknown>;
    site: z.ZodString;
    siteTitle: z.ZodString;
    socials: z.ZodReadonly<z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodString>, Map<string, string>, Record<string, string>>, z.ZodMap<z.ZodString, z.ZodString>]>, z.ZodMap<z.ZodString, z.ZodString>>>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    theming: z.ZodObject<{
        color: z.ZodString;
        shiki: z.ZodObject<{
            light: z.ZodString;
            dark: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            light: string;
            dark: string;
        }, {
            light: string;
            dark: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        color: string;
        shiki: {
            light: string;
            dark: string;
        };
    }, {
        color: string;
        shiki: {
            light: string;
            dark: string;
        };
    }>;
    title: z.ZodString;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    path: z.ZodObject<{
        dir: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        dir: string;
    }, {
        name: string;
        dir: string;
    }>;
    pkgJsonAbsPath: z.ZodString;
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
    earliest: z.ZodOptional<z.ZodEffects<z.ZodDate, Date, unknown>>;
    isHome: z.ZodOptional<z.ZodBoolean>;
    isLinks: z.ZodOptional<z.ZodBoolean>;
    is404: z.ZodOptional<z.ZodBoolean>;
    isPost: z.ZodOptional<z.ZodBoolean>;
    lang: z.ZodString;
    latest: z.ZodOptional<z.ZodEffects<z.ZodDate, Date, unknown>>;
    license: z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodString, {}, string>, z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>]>, z.ZodReadonly<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>>>;
    links: z.ZodReadonly<z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodString>, Map<string, string>, Record<string, string>>, z.ZodMap<z.ZodString, z.ZodString>]>, z.ZodMap<z.ZodString, z.ZodString>>>;
    updated: z.ZodOptional<z.ZodUnknown>;
    published: z.ZodOptional<z.ZodUnknown>;
    site: z.ZodString;
    siteTitle: z.ZodString;
    socials: z.ZodReadonly<z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodString>, Map<string, string>, Record<string, string>>, z.ZodMap<z.ZodString, z.ZodString>]>, z.ZodMap<z.ZodString, z.ZodString>>>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    theming: z.ZodObject<{
        color: z.ZodString;
        shiki: z.ZodObject<{
            light: z.ZodString;
            dark: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            light: string;
            dark: string;
        }, {
            light: string;
            dark: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        color: string;
        shiki: {
            light: string;
            dark: string;
        };
    }, {
        color: string;
        shiki: {
            light: string;
            dark: string;
        };
    }>;
    title: z.ZodString;
}, z.ZodTypeAny, "passthrough">>, {
    defaultLang: string;
    description: string;
    earliest: Date;
    frontmatterPath: string;
    fullTitle: string;
    fullUrlWIndexWExt: URL;
    fullUrlWIndexWoExt: URL;
    layoutPath: string;
    isHome: boolean;
    isLinks: boolean;
    is404: boolean;
    lang: string;
    latest: Date;
    mdxContent: string;
    updated: readonly {
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }[];
    published: readonly {
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }[];
    slugWIndexWExt: string;
    slugWIndexWoExt: string;
    siteBase: string;
    path: {
        name: string;
        dir: string;
    };
    author: {
        name: string;
        url: string;
    };
    pkgJsonAbsPath: string;
    license: Readonly<{
        name: string;
        url: string;
    }>;
    links: ReadonlyMap<string, string>;
    site: string;
    siteTitle: string;
    socials: ReadonlyMap<string, string>;
    tags: string[];
    theming: {
        color: string;
        shiki: {
            light: string;
            dark: string;
        };
    };
    title: string;
    isPost?: boolean | undefined;
}, z.objectInputType<{
    path: z.ZodObject<{
        dir: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        dir: string;
    }, {
        name: string;
        dir: string;
    }>;
    pkgJsonAbsPath: z.ZodString;
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
    earliest: z.ZodOptional<z.ZodEffects<z.ZodDate, Date, unknown>>;
    isHome: z.ZodOptional<z.ZodBoolean>;
    isLinks: z.ZodOptional<z.ZodBoolean>;
    is404: z.ZodOptional<z.ZodBoolean>;
    isPost: z.ZodOptional<z.ZodBoolean>;
    lang: z.ZodString;
    latest: z.ZodOptional<z.ZodEffects<z.ZodDate, Date, unknown>>;
    license: z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodString, {}, string>, z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>]>, z.ZodReadonly<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>>>;
    links: z.ZodReadonly<z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodString>, Map<string, string>, Record<string, string>>, z.ZodMap<z.ZodString, z.ZodString>]>, z.ZodMap<z.ZodString, z.ZodString>>>;
    updated: z.ZodOptional<z.ZodUnknown>;
    published: z.ZodOptional<z.ZodUnknown>;
    site: z.ZodString;
    siteTitle: z.ZodString;
    socials: z.ZodReadonly<z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodString>, Map<string, string>, Record<string, string>>, z.ZodMap<z.ZodString, z.ZodString>]>, z.ZodMap<z.ZodString, z.ZodString>>>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    theming: z.ZodObject<{
        color: z.ZodString;
        shiki: z.ZodObject<{
            light: z.ZodString;
            dark: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            light: string;
            dark: string;
        }, {
            light: string;
            dark: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        color: string;
        shiki: {
            light: string;
            dark: string;
        };
    }, {
        color: string;
        shiki: {
            light: string;
            dark: string;
        };
    }>;
    title: z.ZodString;
}, z.ZodTypeAny, "passthrough">>, {
    canonicalUrl: URL;
    frontmatterImportName: string;
    layoutImportName: string;
    isPost: boolean;
    postImportName: string;
    siteWithBase: string | URL;
    slashSiteBase: string;
    slug: string;
    summary: string;
    defaultLang: string;
    description: string;
    earliest: Date;
    frontmatterPath: string;
    fullTitle: string;
    fullUrlWIndexWExt: URL;
    fullUrlWIndexWoExt: URL;
    layoutPath: string;
    isHome: boolean;
    isLinks: boolean;
    is404: boolean;
    lang: string;
    latest: Date;
    mdxContent: string;
    updated: readonly {
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }[];
    published: readonly {
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }[];
    slugWIndexWExt: string;
    slugWIndexWoExt: string;
    siteBase: string;
    path: {
        name: string;
        dir: string;
    };
    author: {
        name: string;
        url: string;
    };
    pkgJsonAbsPath: string;
    license: Readonly<{
        name: string;
        url: string;
    }>;
    links: ReadonlyMap<string, string>;
    site: string;
    siteTitle: string;
    socials: ReadonlyMap<string, string>;
    tags: string[];
    theming: {
        color: string;
        shiki: {
            light: string;
            dark: string;
        };
    };
    title: string;
}, z.objectInputType<{
    path: z.ZodObject<{
        dir: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        dir: string;
    }, {
        name: string;
        dir: string;
    }>;
    pkgJsonAbsPath: z.ZodString;
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
    earliest: z.ZodOptional<z.ZodEffects<z.ZodDate, Date, unknown>>;
    isHome: z.ZodOptional<z.ZodBoolean>;
    isLinks: z.ZodOptional<z.ZodBoolean>;
    is404: z.ZodOptional<z.ZodBoolean>;
    isPost: z.ZodOptional<z.ZodBoolean>;
    lang: z.ZodString;
    latest: z.ZodOptional<z.ZodEffects<z.ZodDate, Date, unknown>>;
    license: z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodString, {}, string>, z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>]>, z.ZodReadonly<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>>>;
    links: z.ZodReadonly<z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodString>, Map<string, string>, Record<string, string>>, z.ZodMap<z.ZodString, z.ZodString>]>, z.ZodMap<z.ZodString, z.ZodString>>>;
    updated: z.ZodOptional<z.ZodUnknown>;
    published: z.ZodOptional<z.ZodUnknown>;
    site: z.ZodString;
    siteTitle: z.ZodString;
    socials: z.ZodReadonly<z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodString>, Map<string, string>, Record<string, string>>, z.ZodMap<z.ZodString, z.ZodString>]>, z.ZodMap<z.ZodString, z.ZodString>>>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    theming: z.ZodObject<{
        color: z.ZodString;
        shiki: z.ZodObject<{
            light: z.ZodString;
            dark: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            light: string;
            dark: string;
        }, {
            light: string;
            dark: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        color: string;
        shiki: {
            light: string;
            dark: string;
        };
    }, {
        color: string;
        shiki: {
            light: string;
            dark: string;
        };
    }>;
    title: z.ZodString;
}, z.ZodTypeAny, "passthrough">>, {
    slashSiteBaseWSlash: string;
    slashSiteBaseWLang: string;
    canonicalUrl: URL;
    frontmatterImportName: string;
    layoutImportName: string;
    isPost: boolean;
    postImportName: string;
    siteWithBase: string | URL;
    slashSiteBase: string;
    slug: string;
    summary: string;
    defaultLang: string;
    description: string;
    earliest: Date;
    frontmatterPath: string;
    fullTitle: string;
    fullUrlWIndexWExt: URL;
    fullUrlWIndexWoExt: URL;
    layoutPath: string;
    isHome: boolean;
    isLinks: boolean;
    is404: boolean;
    lang: string;
    latest: Date;
    mdxContent: string;
    updated: readonly {
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }[];
    published: readonly {
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }[];
    slugWIndexWExt: string;
    slugWIndexWoExt: string;
    siteBase: string;
    path: {
        name: string;
        dir: string;
    };
    author: {
        name: string;
        url: string;
    };
    pkgJsonAbsPath: string;
    license: Readonly<{
        name: string;
        url: string;
    }>;
    links: ReadonlyMap<string, string>;
    site: string;
    siteTitle: string;
    socials: ReadonlyMap<string, string>;
    tags: string[];
    theming: {
        color: string;
        shiki: {
            light: string;
            dark: string;
        };
    };
    title: string;
}, z.objectInputType<{
    path: z.ZodObject<{
        dir: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        dir: string;
    }, {
        name: string;
        dir: string;
    }>;
    pkgJsonAbsPath: z.ZodString;
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
    earliest: z.ZodOptional<z.ZodEffects<z.ZodDate, Date, unknown>>;
    isHome: z.ZodOptional<z.ZodBoolean>;
    isLinks: z.ZodOptional<z.ZodBoolean>;
    is404: z.ZodOptional<z.ZodBoolean>;
    isPost: z.ZodOptional<z.ZodBoolean>;
    lang: z.ZodString;
    latest: z.ZodOptional<z.ZodEffects<z.ZodDate, Date, unknown>>;
    license: z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodString, {}, string>, z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>]>, z.ZodReadonly<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>>>;
    links: z.ZodReadonly<z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodString>, Map<string, string>, Record<string, string>>, z.ZodMap<z.ZodString, z.ZodString>]>, z.ZodMap<z.ZodString, z.ZodString>>>;
    updated: z.ZodOptional<z.ZodUnknown>;
    published: z.ZodOptional<z.ZodUnknown>;
    site: z.ZodString;
    siteTitle: z.ZodString;
    socials: z.ZodReadonly<z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodString>, Map<string, string>, Record<string, string>>, z.ZodMap<z.ZodString, z.ZodString>]>, z.ZodMap<z.ZodString, z.ZodString>>>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    theming: z.ZodObject<{
        color: z.ZodString;
        shiki: z.ZodObject<{
            light: z.ZodString;
            dark: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            light: string;
            dark: string;
        }, {
            light: string;
            dark: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        color: string;
        shiki: {
            light: string;
            dark: string;
        };
    }, {
        color: string;
        shiki: {
            light: string;
            dark: string;
        };
    }>;
    title: z.ZodString;
}, z.ZodTypeAny, "passthrough">>, {
    slashSiteBaseWLangWSlash: string;
    slashSiteBaseWSlash: string;
    slashSiteBaseWLang: string;
    canonicalUrl: URL;
    frontmatterImportName: string;
    layoutImportName: string;
    isPost: boolean;
    postImportName: string;
    siteWithBase: string | URL;
    slashSiteBase: string;
    slug: string;
    summary: string;
    defaultLang: string;
    description: string;
    earliest: Date;
    frontmatterPath: string;
    fullTitle: string;
    fullUrlWIndexWExt: URL;
    fullUrlWIndexWoExt: URL;
    layoutPath: string;
    isHome: boolean;
    isLinks: boolean;
    is404: boolean;
    lang: string;
    latest: Date;
    mdxContent: string;
    updated: readonly {
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }[];
    published: readonly {
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }[];
    slugWIndexWExt: string;
    slugWIndexWoExt: string;
    siteBase: string;
    path: {
        name: string;
        dir: string;
    };
    author: {
        name: string;
        url: string;
    };
    pkgJsonAbsPath: string;
    license: Readonly<{
        name: string;
        url: string;
    }>;
    links: ReadonlyMap<string, string>;
    site: string;
    siteTitle: string;
    socials: ReadonlyMap<string, string>;
    tags: string[];
    theming: {
        color: string;
        shiki: {
            light: string;
            dark: string;
        };
    };
    title: string;
}, z.objectInputType<{
    path: z.ZodObject<{
        dir: z.ZodString;
        name: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        dir: string;
    }, {
        name: string;
        dir: string;
    }>;
    pkgJsonAbsPath: z.ZodString;
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
    earliest: z.ZodOptional<z.ZodEffects<z.ZodDate, Date, unknown>>;
    isHome: z.ZodOptional<z.ZodBoolean>;
    isLinks: z.ZodOptional<z.ZodBoolean>;
    is404: z.ZodOptional<z.ZodBoolean>;
    isPost: z.ZodOptional<z.ZodBoolean>;
    lang: z.ZodString;
    latest: z.ZodOptional<z.ZodEffects<z.ZodDate, Date, unknown>>;
    license: z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodString, {}, string>, z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>]>, z.ZodReadonly<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>>>;
    links: z.ZodReadonly<z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodString>, Map<string, string>, Record<string, string>>, z.ZodMap<z.ZodString, z.ZodString>]>, z.ZodMap<z.ZodString, z.ZodString>>>;
    updated: z.ZodOptional<z.ZodUnknown>;
    published: z.ZodOptional<z.ZodUnknown>;
    site: z.ZodString;
    siteTitle: z.ZodString;
    socials: z.ZodReadonly<z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodRecord<z.ZodString, z.ZodString>, Map<string, string>, Record<string, string>>, z.ZodMap<z.ZodString, z.ZodString>]>, z.ZodMap<z.ZodString, z.ZodString>>>;
    tags: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    theming: z.ZodObject<{
        color: z.ZodString;
        shiki: z.ZodObject<{
            light: z.ZodString;
            dark: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            light: string;
            dark: string;
        }, {
            light: string;
            dark: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        color: string;
        shiki: {
            light: string;
            dark: string;
        };
    }, {
        color: string;
        shiki: {
            light: string;
            dark: string;
        };
    }>;
    title: z.ZodString;
}, z.ZodTypeAny, "passthrough">>, z.ZodObject<{
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
    author: z.ZodReadonly<z.ZodObject<{
        name: z.ZodString;
        url: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        url: string;
    }, {
        name: string;
        url: string;
    }>>;
    canonicalUrl: z.ZodString;
    defaultLang: z.ZodString;
    description: z.ZodString;
    earliest: z.ZodDate;
    frontmatterImportName: z.ZodString;
    frontmatterPath: z.ZodString;
    fullTitle: z.ZodString;
    fullUrlWIndexWExt: z.ZodString;
    fullUrlWIndexWoExt: z.ZodString;
    isHome: z.ZodBoolean;
    isLinks: z.ZodBoolean;
    is404: z.ZodBoolean;
    isPost: z.ZodBoolean;
    lang: z.ZodString;
    latest: z.ZodDate;
    layoutImportName: z.ZodString;
    layoutPath: z.ZodString;
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
    links: z.ZodReadonly<z.ZodMap<z.ZodString, z.ZodString>>;
    mdxContent: z.ZodString;
    postImportName: z.ZodString;
    published: z.ZodReadonly<z.ZodArray<z.ZodObject<{
        date: z.ZodDate;
        author: z.ZodReadonly<z.ZodObject<{
            name: z.ZodString;
            url: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            url: string;
        }, {
            name: string;
            url: string;
        }>>;
    }, "strip", z.ZodTypeAny, {
        date: Date;
        author: Readonly<{
            name: string;
            url: string;
        }>;
    }, {
        date: Date;
        author: {
            name: string;
            url: string;
        };
    }>, "atleastone">>;
    slashSiteBase: z.ZodString;
    slashSiteBaseWSlash: z.ZodString;
    slashSiteBaseWLang: z.ZodString;
    slashSiteBaseWLangWSlash: z.ZodString;
    site: z.ZodString;
    siteBase: z.ZodString;
    siteTitle: z.ZodString;
    siteWithBase: z.ZodString;
    slugWIndexWExt: z.ZodString;
    slugWIndexWoExt: z.ZodString;
    slug: z.ZodString;
    socials: z.ZodReadonly<z.ZodMap<z.ZodString, z.ZodString>>;
    summary: z.ZodString;
    tags: z.ZodArray<z.ZodString, "many">;
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
    title: z.ZodString;
    updated: z.ZodReadonly<z.ZodArray<z.ZodObject<{
        date: z.ZodDate;
        author: z.ZodReadonly<z.ZodObject<{
            name: z.ZodString;
            url: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            url: string;
        }, {
            name: string;
            url: string;
        }>>;
    }, "strip", z.ZodTypeAny, {
        date: Date;
        author: Readonly<{
            name: string;
            url: string;
        }>;
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
    author: Readonly<{
        name: string;
        url: string;
    }>;
    pkgJsonAbsPath: string;
    earliest: Date;
    isHome: boolean;
    isLinks: boolean;
    is404: boolean;
    isPost: boolean;
    lang: string;
    latest: Date;
    license: Readonly<{
        name: string;
        url: string;
    }>;
    links: ReadonlyMap<string, string>;
    updated: readonly [{
        date: Date;
        author: Readonly<{
            name: string;
            url: string;
        }>;
    }, ...{
        date: Date;
        author: Readonly<{
            name: string;
            url: string;
        }>;
    }[]];
    published: readonly [{
        date: Date;
        author: Readonly<{
            name: string;
            url: string;
        }>;
    }, ...{
        date: Date;
        author: Readonly<{
            name: string;
            url: string;
        }>;
    }[]];
    site: string;
    siteTitle: string;
    socials: ReadonlyMap<string, string>;
    tags: string[];
    theming: Readonly<{
        color: string;
        shiki: Readonly<{
            light: string;
            dark: string;
        }>;
    }>;
    title: string;
    defaultLang: string;
    description: string;
    frontmatterPath: string;
    fullTitle: string;
    fullUrlWIndexWExt: string;
    fullUrlWIndexWoExt: string;
    layoutPath: string;
    mdxContent: string;
    slugWIndexWExt: string;
    slugWIndexWoExt: string;
    siteBase: string;
    canonicalUrl: string;
    frontmatterImportName: string;
    layoutImportName: string;
    postImportName: string;
    siteWithBase: string;
    slashSiteBase: string;
    slug: string;
    summary: string;
    slashSiteBaseWSlash: string;
    slashSiteBaseWLang: string;
    slashSiteBaseWLangWSlash: string;
}, {
    path: {
        name: string;
        dir: string;
    };
    author: {
        name: string;
        url: string;
    };
    pkgJsonAbsPath: string;
    earliest: Date;
    isHome: boolean;
    isLinks: boolean;
    is404: boolean;
    isPost: boolean;
    lang: string;
    latest: Date;
    license: {
        name: string;
        url: string;
    };
    links: Map<string, string>;
    updated: [{
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
    site: string;
    siteTitle: string;
    socials: Map<string, string>;
    tags: string[];
    theming: {
        color: string;
        shiki: {
            light: string;
            dark: string;
        };
    };
    title: string;
    defaultLang: string;
    description: string;
    frontmatterPath: string;
    fullTitle: string;
    fullUrlWIndexWExt: string;
    fullUrlWIndexWoExt: string;
    layoutPath: string;
    mdxContent: string;
    slugWIndexWExt: string;
    slugWIndexWoExt: string;
    siteBase: string;
    canonicalUrl: string;
    frontmatterImportName: string;
    layoutImportName: string;
    postImportName: string;
    siteWithBase: string;
    slashSiteBase: string;
    slug: string;
    summary: string;
    slashSiteBaseWSlash: string;
    slashSiteBaseWLang: string;
    slashSiteBaseWLangWSlash: string;
}>>;
export default zPost;
//# sourceMappingURL=index.d.ts.map