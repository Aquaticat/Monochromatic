(function() {
  "use strict";
  if ((/* @__PURE__ */ new Set(["figma", "slides"])).has(figma.editorType)) {
    (async () => {
      var _a, _b;
      const localVariableCollections = await figma.variables.getLocalVariableCollectionsAsync();
      let generatedCssForLocalVariables = "";
      for (const localVariableCollection of localVariableCollections) {
        console.log(
          `variable collection ${localVariableCollection.name} start with modes ${localVariableCollection.modes}`
        );
        let generatedCssForLocalVariableCollection = "";
        for (const localVariableIdInCollection of localVariableCollection.variableIds) {
          const localVariableInCollection = await figma.variables.getVariableByIdAsync(localVariableIdInCollection);
          const descriptionMatchesGeneratedCssForLocalVariableInCollection = /`(?<code>.+)`/.exec(
            localVariableInCollection.description
          );
          const valueInPrimaryMode = Object.values(localVariableInCollection.valuesByMode)[0];
          const generatedCssForLocalVariableInCollection = (_b = (_a = descriptionMatchesGeneratedCssForLocalVariableInCollection == null ? void 0 : descriptionMatchesGeneratedCssForLocalVariableInCollection.groups) == null ? void 0 : _a.code) != null ? _b : `:root { --${localVariableInCollection.name}: ${localVariableInCollection.resolvedType === "COLOR" ? `rgba(${valueInPrimaryMode.r * 255},${valueInPrimaryMode.g * 255},${valueInPrimaryMode.b * 255},${valueInPrimaryMode.a * 255})` : Object.values(localVariableInCollection.valuesByMode)[0]}; }`;
          generatedCssForLocalVariableCollection = `${generatedCssForLocalVariableCollection}
        ${generatedCssForLocalVariableInCollection}`;
        }
        generatedCssForLocalVariables = `${generatedCssForLocalVariables}
      ${generatedCssForLocalVariableCollection}`;
      }
      console.log(generatedCssForLocalVariables);
      figma.showUI(__html__, { themeColors: true });
      figma.ui.postMessage({ generatedCssForLocalVariables }, { origin: "*" });
      figma.ui.onmessage = (message) => {
        console.log("got this from the UI", message);
      };
    })();
  }
})();
