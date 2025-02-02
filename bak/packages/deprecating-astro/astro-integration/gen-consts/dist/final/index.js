var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
import { parse } from "smol-toml";
import {
  readFileSync as fsReadFileSync,
  writeFileSync as fsWriteFileSync,
  readdirSync as fsReaddirSync
} from "node:fs";
import { join as pathJoin, resolve as pathResolve } from "node:path";
import objectToExport from "@monochromatic-dev/module-object-to-export";
import themeConstsSchema, { typescriptType as themeConstsTypescriptType } from "@monochromatic-dev/schema-theme-consts";
var fs = { readFileSync: fsReadFileSync, writeFileSync: fsWriteFileSync, readdirSync: fsReaddirSync };
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
        `type constsType = ${themeConstsTypescriptType};

const consts: constsType = ${exportedObj} as constsType;

export default consts;`
      );
      updateConfig({
        site: consts.site,
        base: `/${consts.base}`,
        // @ts-expect-error Type 'string' is not assignable to type 'DeepPartial<URL>'.ts(2322) schema.d.ts(399, 5): The expected type comes from property 'outDir' which is declared here on type 'DeepPartial<AstroConfig>'
        outDir: consts.base ? `./dist/temp/${consts.base}` : "./dist/temp/",
        markdown: {
          shikiConfig: {
            themes: {
              light: consts.theming.shiki.light,
              dark: consts.theming.shiki.dark
            }
          }
        },
        i18n: {
          locales: fs.readdirSync(path.join(path.resolve(), "src", "content", "post"))
        }
      });
    }
  }
}), "default");
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
