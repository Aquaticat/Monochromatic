var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
(function() {
  "use strict";
  const EPSILON = 1e-5;
  const almostEqual = (a, b) => {
    return Math.abs(a - b) < EPSILON;
  };
  const getCssValueOfFigmaVariableValue = (value, resolvedType) => {
    switch (resolvedType) {
      case "COLOR": {
        const colorValue = value;
        return `rgba(${colorValue.r * 255}, ${colorValue.g * 255}, ${colorValue.b * 255}, ${colorValue.a})`;
      }
      case "STRING": {
        const stringValue = value;
        if (!(stringValue.startsWith('"') && stringValue.endsWith('"')) || stringValue.startsWith("'") && stringValue.endsWith("'") && !stringValue.includes("var(--")) {
          return `'${stringValue.replaceAll("'", "\\'")}'`;
        }
        return stringValue;
      }
      case "FLOAT": {
        const floatValue = value;
        return String(floatValue);
      }
      case "BOOLEAN": {
        const booleanValue = value;
        return String(booleanValue);
      }
      default:
        throw new Error(`Unknown resolved type ${resolvedType} for value ${value}`);
    }
  };
  class EnhancedVariable {
    constructor(variable) {
      __publicField(this, "variable");
      __publicField(this, "collection");
      __publicField(this, "modeNames");
      __publicField(this, "modeIds");
      __publicField(this, "_values");
      __publicField(this, "_valuesByModeName");
      __publicField(this, "resolvedType");
      __publicField(this, "_name");
      __publicField(this, "description");
      __publicField(this, "collectionName");
      __publicField(this, "collectionId");
      __publicField(this, "id");
      __publicField(this, "_generatedCss", "");
      const { variableCollectionId: collectionId, name, description, resolvedType, id } = variable;
      const collection = collections.find((collection2) => collection2.id === collectionId);
      const modeIds = Object.keys(variable.valuesByMode);
      const modeNames = modeIds.map(
        (modeIdToFind) => collection.modes.find(({ modeId }) => modeIdToFind === modeId).name
      );
      const values = Object.values(variable.valuesByMode);
      const valuesByModeName = Object.fromEntries(
        modeNames.map((modeName, index) => [modeName, values[index]])
      );
      this.id = id;
      this.variable = variable;
      this.collection = collection;
      this.modeNames = modeNames;
      this.modeIds = modeIds;
      this._values = values;
      this._valuesByModeName = valuesByModeName;
      this.resolvedType = resolvedType;
      this._name = variable.name;
      this.description = description;
      this.collectionName = collection.name;
      this.collectionId = collectionId;
      this.recalculateGeneratedCss();
    }
    set name(name) {
      this._name = name;
      this.variable.name = name;
      this.recalculateGeneratedCss();
    }
    get name() {
      return this._name;
    }
    get generatedCss() {
      return this._generatedCss;
    }
    recalculateGeneratedCss() {
      var _a, _b;
      const { name, description, resolvedType } = this;
      const descriptionMatchesGeneratedCss = /`(?<code>.+)`/.exec(
        description
      );
      this._generatedCss = (_b = (_a = descriptionMatchesGeneratedCss == null ? void 0 : descriptionMatchesGeneratedCss.groups) == null ? void 0 : _a.code) != null ? _b : Object.entries(this._valuesByModeName).map(function generateCssForMode([modeName, value]) {
        return `[data-mode="${modeName}"] { --${name}: ${getCssValueOfFigmaVariableValue(
          value,
          resolvedType
        )}; }`;
      }).join("\n");
      return this._generatedCss;
    }
    setValueByModeName(value, modeName) {
      this._valuesByModeName[modeName] = value;
      const indexOfMode = this.modeNames.indexOf(modeName);
      const modeId = this.modeIds[indexOfMode];
      this._values[indexOfMode] = value;
      this.variable.setValueForMode(modeId, value);
      this.recalculateGeneratedCss();
    }
    getValueByModeName(modeName) {
      return this._valuesByModeName[modeName];
    }
  }
  let collections = [];
  let variables = [];
  let enhancedVariables = [];
  const populateFigmaVariables = async () => {
    collections = await figma.variables.getLocalVariableCollectionsAsync();
    variables = await figma.variables.getLocalVariablesAsync();
    enhancedVariables = variables.map(
      (variable) => new EnhancedVariable(variable)
    );
  };
  const normalizeVariables = () => {
    for (const variable of variables) {
      if (variable.name.startsWith("--")) {
        console.log(`Normalizing variable ${variable.name}`);
        variable.name = variable.name.slice("--".length);
      }
    }
  };
  const handleSettingVarMessage = ({
    cssVar,
    computedValue,
    originalValue,
    varType,
    mode
  }) => {
    if (varType === "number") {
      if (String(computedValue) !== String(originalValue)) {
        console.log(`Setting variable ${cssVar} to ${computedValue} in mode ${mode}`);
        const variable = enhancedVariables.find(
          (enhancedVariable) => enhancedVariable.name === cssVar.slice("--".length)
        );
        variable.setValueByModeName(computedValue, mode);
      }
    } else if (varType === "boolean") {
      if (String(computedValue) !== String(originalValue)) {
        console.log(`Setting variable ${cssVar} to ${computedValue} in mode ${mode}`);
        const variable = enhancedVariables.find(
          (enhancedVariable) => enhancedVariable.name === cssVar.slice("--".length)
        );
        variable.setValueByModeName(computedValue, mode);
      }
    } else if (varType === "color") {
      const color = function calculateColor() {
        if (computedValue.startsWith("rgba(")) {
          const rgba = computedValue.slice("rgba(".length, -")".length).split(",").map((value) => value.trim());
          return {
            r: Number(rgba[0]) / 255,
            g: Number(rgba[1]) / 255,
            b: Number(rgba[2]) / 255,
            a: Number(rgba[3])
          };
        }
        if (computedValue.startsWith("rgb(")) {
          const rgb = computedValue.slice("rgb(".length, -")".length).split(",").map((value) => value.trim());
          return {
            r: Number(rgb[0]) / 255,
            g: Number(rgb[1]) / 255,
            b: Number(rgb[2]) / 255,
            a: 1
          };
        }
        throw new Error(
          `Unsupported computedValue ${computedValue} color format in mode ${mode}`
        );
      }();
      const originalColor = function calculateOriginalColor() {
        if (originalValue.startsWith("rgba(")) {
          const rgba = originalValue.slice("rgba(".length, -")".length).split(",").map((value) => value.trim());
          return {
            r: Number(rgba[0]) / 255,
            g: Number(rgba[1]) / 255,
            b: Number(rgba[2]) / 255,
            a: Number(rgba[3])
          };
        }
        throw new Error(
          `Unsupported originalValue ${originalValue} color format in mode ${mode}`
        );
      }();
      if (almostEqual(color.r, originalColor.r) && almostEqual(color.g, originalColor.g) && almostEqual(color.b, originalColor.b) && almostEqual(color.a, originalColor.a)) {
        return;
      }
      console.log(`Setting variable ${cssVar} to ${computedValue} in mode ${mode}`);
      const variable = enhancedVariables.find(
        (enhancedVariable) => enhancedVariable.name === cssVar.slice("--".length)
      );
      variable.setValueByModeName(color, mode);
    } else if (varType === "string") {
      if (computedValue !== originalValue) {
        const valueToSet = computedValue.startsWith("'") && computedValue.endsWith("'") ? computedValue.slice("'".length, -"'".length) : computedValue;
        console.log(`Setting variable ${cssVar} to ${valueToSet} in mode ${mode}`);
        const variable = enhancedVariables.find(
          (enhancedVariable) => enhancedVariable.name === cssVar.slice("--".length)
        );
        variable.setValueByModeName(valueToSet, mode);
      }
    } else {
      throw new Error(`Unrecognized variable ${cssVar} type ${varType} in mode ${mode}`);
    }
  };
  const main = async () => {
    await populateFigmaVariables();
    normalizeVariables();
    const generatedCssForLocalVariables = enhancedVariables.map((enhancedVariable) => enhancedVariable.generatedCss).join("\n");
    console.log(generatedCssForLocalVariables);
    figma.showUI(__html__, { themeColors: true });
    figma.ui.postMessage({ generatedCssForLocalVariables }, { origin: "*" });
    figma.ui.onmessage = (message) => {
      console.log("got this from the UI", message);
      if (message.cssVar) {
        handleSettingVarMessage(message);
      }
    };
  };
  if ((/* @__PURE__ */ new Set(["figma", "slides"])).has(figma.editorType)) {
    main();
  }
})();
