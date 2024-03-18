import { z } from 'zod';
import isLang from '@monochromatic.dev/module-is-lang';

export default z
  .object({
    title: z.string(),
    description: z.string(),
    author: z.string(),
    site: z.string().url(),
    base: z.string().transform((val) => {
      let result = val;
      if (result.startsWith('/')) result = result.slice(1);
      if (result.endsWith('/')) result = result.slice(0, -1);
      return result;
    }),
    theming: z
      .object({
        color: z.string().refine((val) => /#[\da-zA-Z]{6}/.test(val)),
        shiki: z
          .object({
            light: z.string(),
            dark: z.string(),
          })
          .readonly(),
      })
      .readonly(),
    socials: z
      .record(z.string(), z.string().url())
      .transform((val) => new Map(Object.entries(val)))
      .readonly(),
    links: z
      .record(z.string(), z.string().url())
      .transform((val) => new Map(Object.entries(val)))
      .readonly(),
    langs: z
      .record(
        z.string().refine((val) => val.length === 0 || isLang(val)),
        z
          .array(z.string().refine((val) => isLang(val)))
          .nonempty()
          .readonly(),
      )
      .refine((val) => val[''])
      .transform((val) => {
        const defaultLang = val[''][0];
        const paths = Object.freeze(Object.keys(val));
        return {
          defaultLang: defaultLang,
          paths: paths,
          langs: Object.freeze(paths.toSpliced(paths.indexOf(''), 1, defaultLang)),
          mappings: Object.freeze(
            new Map(
              Object.entries(val).flatMap(([path, codes]) =>
                Object.freeze(codes.map((code) => Object.freeze([code, path]))),
              ),
            ),
          ),
        };
      })
      .readonly(),
    strings: z
      .record(
        z.string().refine((val) => isLang(val)),
        z.record(z.string(), z.string()),
      )
      .transform(
        (val) =>
          new Map(
            Object.entries(val).map(([lang, stringsLang]) => [
              lang,
              Object.freeze(new Map(Object.entries(stringsLang))),
            ]),
          ),
      )
      .readonly(),
  })
  .readonly();
