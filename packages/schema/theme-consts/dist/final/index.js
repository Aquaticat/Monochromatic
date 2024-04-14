// src/index.ts
import { z } from "zod";
import isLang from "@monochromatic.dev/module-is-lang";
import spdxLicenseList from "spdx-license-list";
var src_default = z.object({
  title: z.string(),
  description: z.string(),
  author: z.object({ name: z.string(), url: z.string().url() }).readonly(),
  site: z.string().url(),
  base: z.string().transform((val) => {
    let result = val;
    if (result.startsWith("/"))
      result = result.slice(1);
    if (result.endsWith("/"))
      result = result.slice(0, -1);
    return result;
  }),
  license: z.union([
    z.string().refine((val) => Object.hasOwn(spdxLicenseList, val)).transform((val) => ({ name: spdxLicenseList[val].name, url: spdxLicenseList[val].url })).readonly(),
    z.object({ name: z.string(), url: z.string().url() }).readonly()
  ]),
  theming: z.object({
    color: z.string().refine((val) => /#[\da-zA-Z]{6}/.test(val)),
    shiki: z.object({
      light: z.string(),
      dark: z.string()
    }).readonly()
  }).readonly(),
  socials: z.record(z.string(), z.string().url()).transform((val) => new Map(Object.entries(val))).readonly(),
  links: z.record(z.string(), z.string().url()).transform((val) => new Map(Object.entries(val))).readonly(),
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
  author: {
    name: string;
    url: string;
  };
  site: string;
  base: string;
  license: {
    name: string;
    url: string;
  };
  theming: { color: string; shiki: { light: string; dark: string } };
  socials: ReadonlyMap<string, string>;
  links: ReadonlyMap<string, string>;
  strings: ReadonlyMap<string, ReadonlyMap<string, string>>;
}`;
export {
  src_default as default,
  typescriptType
};
//# sourceMappingURL=index.js.map
