import { shouldInlineAsset } from "./util.js";
function vitePluginScripts(internals) {
  let assetInlineLimit;
  return {
    name: "@astro/plugin-scripts",
    configResolved(config) {
      assetInlineLimit = config.build.assetsInlineLimit;
    },
    async generateBundle(_options, bundle) {
      for (const [id, output] of Object.entries(bundle)) {
        if (output.type === "chunk" && output.facadeModuleId && internals.discoveredScripts.has(output.facadeModuleId) && output.imports.length === 0 && output.dynamicImports.length === 0 && shouldInlineAsset(output.code, output.fileName, assetInlineLimit)) {
          internals.inlinedScripts.set(output.facadeModuleId, output.code.trim());
          delete bundle[id];
        }
      }
    }
  };
}
function pluginScripts(internals) {
  return {
    targets: ["client"],
    hooks: {
      "build:before": () => {
        return {
          vitePlugin: vitePluginScripts(internals)
        };
      }
    }
  };
}
export {
  pluginScripts,
  vitePluginScripts
};
