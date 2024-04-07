var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
import { parse } from "smol-toml";
import { readFileSync as fsReadFileSync, writeFileSync as fsWriteFileSync } from "node:fs";
import { join as pathJoin, resolve as pathResolve } from "node:path";
import objectToExport from "@monochromatic.dev/module-object-to-export";
import themeConstsSchema from "@monochromatic.dev/schema-theme-consts";
var fs = { readFileSync: fsReadFileSync, writeFileSync: fsWriteFileSync };
var path = { join: pathJoin, resolve: pathResolve };
var src_default = /* @__PURE__ */ __name((file = "consts.toml") => ({
  name: "gen-consts",
  hooks: {
    "astro:config:setup": ({ updateConfig }) => {
      const consts = themeConstsSchema.parse(
        parse(fs.readFileSync(path.join(path.resolve(), file), { encoding: "utf8" }))
      );
      const exportedObj = objectToExport(consts);
      fs.writeFileSync(
        path.join(path.resolve(), "src", "temp", file.split(".").toSpliced(-1, 1, "ts").join(".")),
        `export default ${exportedObj}`
      );
      updateConfig({
        site: consts.site,
        base: `/${consts.base}`,
        markdown: {
          shikiConfig: {
            themes: {
              light: consts.theming.shiki.light,
              dark: consts.theming.shiki.dark
            }
          }
        },
        i18n: {
          defaultLocale: consts.langs.defaultLang,
          locales: [...consts.langs.langs]
        }
      });
    }
  }
}), "default");
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
