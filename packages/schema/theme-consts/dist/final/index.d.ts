import { z } from 'zod';

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
    date: z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodString, Date | null, string>, z.ZodDate]>, z.ZodDate>;
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
    date: (string | Date) & (string | Date | undefined);
    author: {
        name: string;
        url: string;
    };
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
    date: z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodString, Date | null, string>, z.ZodDate]>, z.ZodDate>;
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
    date: (string | Date) & (string | Date | undefined);
    author: {
        name: string;
        url: string;
    };
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

export declare const zChronoDate: z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodString, Date | null, string>, z.ZodDate]>, z.ZodDate>;

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
    earliest: z.ZodOptional<z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodString, Date | null, string>, z.ZodDate]>, z.ZodDate>>;
    lang: z.ZodString;
    latest: z.ZodOptional<z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodString, Date | null, string>, z.ZodDate]>, z.ZodDate>>;
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
    updated: z.ZodOptional<z.ZodUnknown>;
    published: z.ZodOptional<z.ZodUnknown>;
    site: z.ZodString;
    siteTitle: z.ZodString;
    socials: z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodString>>;
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
    earliest: z.ZodOptional<z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodString, Date | null, string>, z.ZodDate]>, z.ZodDate>>;
    lang: z.ZodString;
    latest: z.ZodOptional<z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodString, Date | null, string>, z.ZodDate]>, z.ZodDate>>;
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
    updated: z.ZodOptional<z.ZodUnknown>;
    published: z.ZodOptional<z.ZodUnknown>;
    site: z.ZodString;
    siteTitle: z.ZodString;
    socials: z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodString>>;
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
    earliest: z.ZodOptional<z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodString, Date | null, string>, z.ZodDate]>, z.ZodDate>>;
    lang: z.ZodString;
    latest: z.ZodOptional<z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodString, Date | null, string>, z.ZodDate]>, z.ZodDate>>;
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
    updated: z.ZodOptional<z.ZodUnknown>;
    published: z.ZodOptional<z.ZodUnknown>;
    site: z.ZodString;
    siteTitle: z.ZodString;
    socials: z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodString>>;
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
    fullTitle: string;
    fullUrlWIndexWExt: URL;
    fullUrlWIndexWoExt: URL;
    isHome: boolean;
    isLinks: boolean;
    is404: boolean;
    isPost: boolean;
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
    site: string;
    siteTitle: string;
    socials: Readonly<Record<string, string>>;
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
    earliest: z.ZodOptional<z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodString, Date | null, string>, z.ZodDate]>, z.ZodDate>>;
    lang: z.ZodString;
    latest: z.ZodOptional<z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodString, Date | null, string>, z.ZodDate]>, z.ZodDate>>;
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
    updated: z.ZodOptional<z.ZodUnknown>;
    published: z.ZodOptional<z.ZodUnknown>;
    site: z.ZodString;
    siteTitle: z.ZodString;
    socials: z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodString>>;
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
    siteWithBase: string | URL;
    slashSiteBase: string;
    slug: string;
    summary: string;
    defaultLang: string;
    description: string;
    earliest: Date;
    fullTitle: string;
    fullUrlWIndexWExt: URL;
    fullUrlWIndexWoExt: URL;
    isHome: boolean;
    isLinks: boolean;
    is404: boolean;
    isPost: boolean;
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
    site: string;
    siteTitle: string;
    socials: Readonly<Record<string, string>>;
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
    earliest: z.ZodOptional<z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodString, Date | null, string>, z.ZodDate]>, z.ZodDate>>;
    lang: z.ZodString;
    latest: z.ZodOptional<z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodString, Date | null, string>, z.ZodDate]>, z.ZodDate>>;
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
    updated: z.ZodOptional<z.ZodUnknown>;
    published: z.ZodOptional<z.ZodUnknown>;
    site: z.ZodString;
    siteTitle: z.ZodString;
    socials: z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodString>>;
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
    siteWithBase: string | URL;
    slashSiteBase: string;
    slug: string;
    summary: string;
    defaultLang: string;
    description: string;
    earliest: Date;
    fullTitle: string;
    fullUrlWIndexWExt: URL;
    fullUrlWIndexWoExt: URL;
    isHome: boolean;
    isLinks: boolean;
    is404: boolean;
    isPost: boolean;
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
    site: string;
    siteTitle: string;
    socials: Readonly<Record<string, string>>;
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
    earliest: z.ZodOptional<z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodString, Date | null, string>, z.ZodDate]>, z.ZodDate>>;
    lang: z.ZodString;
    latest: z.ZodOptional<z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodString, Date | null, string>, z.ZodDate]>, z.ZodDate>>;
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
    updated: z.ZodOptional<z.ZodUnknown>;
    published: z.ZodOptional<z.ZodUnknown>;
    site: z.ZodString;
    siteTitle: z.ZodString;
    socials: z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodString>>;
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
    siteWithBase: string | URL;
    slashSiteBase: string;
    slug: string;
    summary: string;
    defaultLang: string;
    description: string;
    earliest: Date;
    fullTitle: string;
    fullUrlWIndexWExt: URL;
    fullUrlWIndexWoExt: URL;
    isHome: boolean;
    isLinks: boolean;
    is404: boolean;
    isPost: boolean;
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
    site: string;
    siteTitle: string;
    socials: Readonly<Record<string, string>>;
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
    earliest: z.ZodOptional<z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodString, Date | null, string>, z.ZodDate]>, z.ZodDate>>;
    lang: z.ZodString;
    latest: z.ZodOptional<z.ZodPipeline<z.ZodUnion<[z.ZodEffects<z.ZodString, Date | null, string>, z.ZodDate]>, z.ZodDate>>;
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
    updated: z.ZodOptional<z.ZodUnknown>;
    published: z.ZodOptional<z.ZodUnknown>;
    site: z.ZodString;
    siteTitle: z.ZodString;
    socials: z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodString>>;
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
    fullTitle: z.ZodString;
    fullUrlWIndexWExt: z.ZodString;
    fullUrlWIndexWoExt: z.ZodString;
    isHome: z.ZodBoolean;
    isLinks: z.ZodBoolean;
    is404: z.ZodBoolean;
    isPost: z.ZodBoolean;
    lang: z.ZodString;
    latest: z.ZodDate;
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
    mdxContent: z.ZodString;
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
    socials: z.ZodReadonly<z.ZodRecord<z.ZodString, z.ZodString>>;
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
    earliest: Date;
    lang: string;
    latest: Date;
    license: Readonly<{
        name: string;
        url: string;
    }>;
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
    socials: Readonly<Record<string, string>>;
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
    fullTitle: string;
    fullUrlWIndexWExt: string;
    fullUrlWIndexWoExt: string;
    isHome: boolean;
    isLinks: boolean;
    is404: boolean;
    isPost: boolean;
    mdxContent: string;
    slugWIndexWExt: string;
    slugWIndexWoExt: string;
    siteBase: string;
    canonicalUrl: string;
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
    earliest: Date;
    lang: string;
    latest: Date;
    license: {
        name: string;
        url: string;
    };
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
    socials: Record<string, string>;
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
    fullTitle: string;
    fullUrlWIndexWExt: string;
    fullUrlWIndexWoExt: string;
    isHome: boolean;
    isLinks: boolean;
    is404: boolean;
    isPost: boolean;
    mdxContent: string;
    slugWIndexWExt: string;
    slugWIndexWoExt: string;
    siteBase: string;
    canonicalUrl: string;
    siteWithBase: string;
    slashSiteBase: string;
    slug: string;
    summary: string;
    slashSiteBaseWSlash: string;
    slashSiteBaseWLang: string;
    slashSiteBaseWLangWSlash: string;
}>>;
export default zPost;

export { }
