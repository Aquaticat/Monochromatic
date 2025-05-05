"use strict";
// eslint-disable prefer-string-raw Figma plugin cannot use String.raw
// eslint-disable prefer-add-event-listener Figma plugin use on...
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var EPSILON = Math.pow(0.1, 5);
var almostEqual = function (a, b) {
    return Math.abs(a - b) < EPSILON;
};
var getCssValueOfFigmaVariableValue = function (value, resolvedType) {
    switch (resolvedType) {
        case 'COLOR': {
            var colorValue = value;
            return "rgba(".concat(colorValue.r * 255, ", ").concat(colorValue.g * 255, ", ").concat(colorValue.b * 255, ", ").concat(colorValue.a, ")");
        }
        case 'STRING': {
            var stringValue = value;
            if (!(stringValue.startsWith('"')
                && stringValue.endsWith('"'))
                || (stringValue.startsWith("'")
                    && stringValue.endsWith("'"))
                    && !stringValue.includes('var(--')) {
                return "'".concat(stringValue.replaceAll("'", "\\'"), "'");
            }
            return stringValue;
        }
        case 'FLOAT': {
            var floatValue = value;
            return String(floatValue);
        }
        case 'BOOLEAN': {
            // TODO: May or may need special handling here.
            var booleanValue = value;
            return String(booleanValue);
        }
        default:
            throw new Error("Unknown resolved type ".concat(resolvedType, " for value ").concat(value));
    }
};
var EnhancedVariable = /** @class */ (function () {
    function EnhancedVariable(variable) {
        this._generatedCss = '';
        var collectionId = variable.variableCollectionId, name = variable.name, description = variable.description, resolvedType = variable.resolvedType, id = variable.id;
        var collection = collections.find(function (collection) { return collection.id === collectionId; });
        var modeIds = Object.keys(variable.valuesByMode);
        var modeNames = modeIds.map(function (modeIdToFind) {
            return collection.modes.find(function (_a) {
                var modeId = _a.modeId;
                return modeIdToFind === modeId;
            }).name;
        });
        var values = Object.values(variable.valuesByMode);
        var valuesByModeName = Object.fromEntries(modeNames.map(function (modeName, index) { return [modeName, values[index]]; }));
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
    Object.defineProperty(EnhancedVariable.prototype, "name", {
        get: function () {
            return this._name;
        },
        set: function (name) {
            this._name = name;
            this.variable.name = name;
            this.recalculateGeneratedCss();
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(EnhancedVariable.prototype, "generatedCss", {
        get: function () {
            return this._generatedCss;
        },
        enumerable: false,
        configurable: true
    });
    EnhancedVariable.prototype.recalculateGeneratedCss = function () {
        var _a, _b;
        var _c = this, name = _c.name, description = _c.description, resolvedType = _c.resolvedType;
        var descriptionMatchesGeneratedCss = /`(?<code>.+)`/
            .exec(description);
        this._generatedCss = (_b = (_a = descriptionMatchesGeneratedCss === null || descriptionMatchesGeneratedCss === void 0 ? void 0 : descriptionMatchesGeneratedCss.groups) === null || _a === void 0 ? void 0 : _a.code) !== null && _b !== void 0 ? _b : Object
            .entries(this._valuesByModeName)
            .map(function generateCssForMode(_a) {
            var modeName = _a[0], value = _a[1];
            return "[data-mode=\"".concat(modeName, "\"] { --").concat(name, ": ").concat(getCssValueOfFigmaVariableValue(value, resolvedType), "; }");
        })
            .join('\n');
        return this._generatedCss;
    };
    EnhancedVariable.prototype.setValueByModeName = function (value, modeName) {
        this._valuesByModeName[modeName] = value;
        var indexOfMode = this.modeNames.indexOf(modeName);
        var modeId = this.modeIds[indexOfMode];
        this._values[indexOfMode] = value;
        this.variable.setValueForMode(modeId, value);
        this.recalculateGeneratedCss();
    };
    EnhancedVariable.prototype.getValueByModeName = function (modeName) {
        return this._valuesByModeName[modeName];
    };
    return EnhancedVariable;
}());
// Will be filled with real variables as soon as getFigmaVariables() is called for the first time,
// which is when we normalize all variables.
// Therefore, many variable methods won't need async.
var collections = [];
var variables = [];
var enhancedVariables = [];
var styles = [];
var paintStyles = [];
var textStyles = [];
var effectStyles = [];
var gridStyles = [];
var populateFigmaVariables = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, figma.variables.getLocalVariableCollectionsAsync()];
            case 1:
                collections = _a.sent();
                return [4 /*yield*/, figma
                        .variables
                        .getLocalVariablesAsync()];
            case 2:
                variables = _a.sent();
                enhancedVariables = variables.map(function (variable) {
                    return new EnhancedVariable(variable);
                });
                return [2 /*return*/];
        }
    });
}); };
var normalizeVariables = function () {
    for (var _i = 0, variables_1 = variables; _i < variables_1.length; _i++) {
        var variable = variables_1[_i];
        if (variable.name.startsWith('--')) {
            console.log("Normalizing variable ".concat(variable.name));
            variable.name = variable.name.slice('--'.length);
        }
    }
};
var handleSettingVarMessage = function (_a) {
    var cssVar = _a.cssVar, computedValue = _a.computedValue, originalValue = _a.originalValue, varType = _a.varType, mode = _a.mode, originalComputedValue = _a.originalComputedValue;
    if (varType === 'number') {
        if (String(computedValue) !== String(originalValue)) {
            console.log("Setting variable ".concat(cssVar, " to ").concat(computedValue, " in mode ").concat(mode, " with original computed value ").concat(originalComputedValue));
            var variable = enhancedVariables.find(function (enhancedVariable) {
                return enhancedVariable.name === cssVar.slice('--'.length);
            });
            variable.setValueByModeName(computedValue, mode);
        }
    }
    else if (varType === 'boolean') {
        if (String(computedValue) !== String(originalValue)) {
            console.log("Setting variable ".concat(cssVar, " to ").concat(computedValue, " in mode ").concat(mode, " with original computed value ").concat(originalComputedValue));
            var variable = enhancedVariables.find(function (enhancedVariable) {
                return enhancedVariable.name === cssVar.slice('--'.length);
            });
            variable.setValueByModeName(computedValue, mode);
        }
    }
    else if (varType === 'color') {
        var color = (function calculateColor() {
            if (computedValue.startsWith('rgba(')) {
                var rgba = computedValue
                    .slice('rgba('.length, -')'.length)
                    .split(',')
                    .map(function trimValue(value) {
                    return value.trim();
                });
                return {
                    r: Number(rgba[0]) / 255,
                    g: Number(rgba[1]) / 255,
                    b: Number(rgba[2]) / 255,
                    a: Number(rgba[3]),
                };
            }
            if (computedValue.startsWith('rgb(')) {
                var rgb = computedValue
                    .slice('rgb('.length, -')'.length)
                    .split(',')
                    .map(function trimValue(value) {
                    return value.trim();
                });
                return {
                    r: Number(rgb[0]) / 255,
                    g: Number(rgb[1]) / 255,
                    b: Number(rgb[2]) / 255,
                    a: 1,
                };
            }
            throw new Error("Unsupported computedValue ".concat(computedValue, " color format in mode ").concat(mode));
        })();
        var originalColor = (function calculateOriginalColor() {
            if (originalValue.startsWith('rgba(')) {
                var rgba = originalValue
                    .slice('rgba('.length, -')'.length)
                    .split(',')
                    .map(function (value) { return value.trim(); });
                return {
                    r: Number(rgba[0]) / 255,
                    g: Number(rgba[1]) / 255,
                    b: Number(rgba[2]) / 255,
                    a: Number(rgba[3]),
                };
            }
            throw new Error("Unsupported originalValue ".concat(originalValue, " color format in mode ").concat(mode));
        })();
        // TODO: Auto create transparent versions of variables.
        if (almostEqual(color.r, originalColor.r)
            && almostEqual(color.g, originalColor.g)
            && almostEqual(color.b, originalColor.b)
            && almostEqual(color.a, originalColor.a)) {
            // console.log(`Skipping setting variable ${cssVar} to ${computedValue} in mode ${mode}`);
            return;
        }
        console.log("Setting variable ".concat(cssVar, " to ").concat(computedValue, " in mode ").concat(mode, " with original computed value ").concat(originalComputedValue));
        var variable = enhancedVariables.find(function (enhancedVariable) {
            return enhancedVariable.name === cssVar.slice('--'.length);
        });
        variable.setValueByModeName(color, mode);
    }
    else if (varType === 'string') {
        if (computedValue !== originalValue) {
            var valueToSet = (computedValue.startsWith("'")
                && computedValue.endsWith("'"))
                ? computedValue.slice("'".length, -"'".length)
                : computedValue;
            console.log("Setting variable ".concat(cssVar, " to ").concat(computedValue, " in mode ").concat(mode, " with original computed value ").concat(originalComputedValue));
            var variable = enhancedVariables.find(function (enhancedVariable) {
                return enhancedVariable.name === cssVar.slice('--'.length);
            });
            variable.setValueByModeName(valueToSet, mode);
        }
    }
    else {
        // TODO: Auto create string versions of non-string variables.
        // We're not really handling box-shadow "variables",
        // since Figma variables cannot be box shadows.
        // Only Figma styles can be box shadows,
        // and you should create the variables to use in the style value anyway.
        throw new Error("Unrecognized variable ".concat(cssVar, " type ").concat(varType, " in mode ").concat(mode));
    }
};
var main = function () { return __awaiter(void 0, void 0, void 0, function () {
    var generatedCssForLocalVariables;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: 
            // Fill the local variable variables.
            return [4 /*yield*/, populateFigmaVariables()];
            case 1:
                // Fill the local variable variables.
                _a.sent();
                normalizeVariables();
                generatedCssForLocalVariables = enhancedVariables
                    .map(function (enhancedVariable) { return enhancedVariable.generatedCss; })
                    .join('\n');
                console.log(generatedCssForLocalVariables);
                figma.showUI(__html__, { themeColors: true });
                figma.ui.postMessage({ generatedCssForLocalVariables: generatedCssForLocalVariables }, { origin: '*' });
                figma.ui.onmessage = function (message) {
                    console.log('got this from the UI', message);
                    if (message.cssVar) {
                        handleSettingVarMessage(message);
                    }
                };
                return [2 /*return*/];
        }
    });
}); };
if (new Set(['figma', 'slides']).has(figma.editorType)) {
    // noinspection JSIgnoredPromiseFromCall - Figma plugin API does not support top level await
    main();
}
