// src/index.ts
import { z } from "zod";
import isLang from "@monochromatic.dev/module-is-lang";
import { piped } from "rambdax";
import spdxLicenseList from "spdx-license-list";
var src_default = z.object({
  title: z.string(),
  description: z.string(),
  author: z.string(),
  site: z.string().url(),
  base: z.string().transform((val) => {
    let result = val;
    if (result.startsWith("/"))
      result = result.slice(1);
    if (result.endsWith("/"))
      result = result.slice(0, -1);
    return result;
  }),
  license: z.string().refine((val) => Object.hasOwn(spdxLicenseList, val)).transform((val) => ({ name: spdxLicenseList[val].name, url: spdxLicenseList[val].url })).readonly(),
  theming: z.object({
    color: z.string().refine((val) => /#[\da-zA-Z]{6}/.test(val)),
    shiki: z.object({
      light: z.string(),
      dark: z.string()
    }).readonly()
  }).readonly(),
  socials: z.record(z.string(), z.string().url()).transform((val) => new Map(Object.entries(val))).readonly(),
  links: z.record(z.string(), z.string().url()).transform((val) => new Map(Object.entries(val))).readonly(),
  langs: z.record(
    z.string().refine((val) => val.length === 0 || isLang(val)),
    z.array(z.string().refine((val) => isLang(val))).nonempty().readonly()
  ).refine((val) => val[""]).transform((val) => {
    const defaultLang = val[""][0];
    const paths = Object.freeze(Object.keys(val));
    return {
      defaultLang,
      paths,
      langs: Object.freeze(paths.toSpliced(paths.indexOf(""), 1, defaultLang)),
      // TODO: This section could be removed: We won't support extended language codes.
      mappings: piped(
        val,
        Object.entries,
        (valKV) => valKV.flatMap(([path, codes]) => codes.map((code) => [code, path])),
        Object.freeze
      )
    };
  }).readonly(),
  strings: z.record(
    z.string().refine((val) => isLang(val)),
    z.record(z.string(), z.string())
  ).transform(
    (val) => new Map(
      Object.entries(val).map(([lang, stringsLang]) => [
        lang,
        Object.freeze(new Map(Object.entries(stringsLang)))
      ])
    )
  ).readonly()
}).readonly();
var typescriptType = `{
  title: string;
  description: string;
  author: string;
  site: string;
  base: string;
  license: {
    name: string;
    url: string;
  };
  theming: { color: string; shiki: { light: string; dark: string } };
  socials: ReadonlyMap<string, string>;
  links: ReadonlyMap<string, string>;
  langs: {
    defaultLang: string;
    paths: readonly ['', ...string[]];
    langs: readonly string[];
    mappings: ReadonlyMap<string, string>;
  };
  strings: ReadonlyMap<string, ReadonlyMap<string, string>>;
}`;
export {
  src_default as default,
  typescriptType
};
//# sourceMappingURL=index.js.map
