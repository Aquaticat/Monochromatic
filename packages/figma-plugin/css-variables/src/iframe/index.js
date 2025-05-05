"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts_1 = require("@monochromatic-dev/module-es/ts");
var lfi_1 = require("lfi");
var DEFAULT_ELEMENT_WIDTH_NUMBER = 3840 - 8 * 2;
var testCssVar = function (cssValue_1, cssVar_1, mode_1) {
    var args_1 = [];
    for (var _i = 3; _i < arguments.length; _i++) {
        args_1[_i - 3] = arguments[_i];
    }
    return __awaiter(void 0, __spreadArray([cssValue_1, cssVar_1, mode_1], args_1, true), void 0, function (cssValue, cssVar, mode, depth) {
        var modeApplier, testElementAssumeUnitfulLength, computedStyle, computedWidth, testElementAssumeNumber, computedStyle, computedWidth, testElementAssumeColor, computedStyle, computedBackgroundColor, computedColor, testElementAssumeBoxShadow, computedStyle, computedBoxShadow, testElementAssumeString, assumeStringStyleSheet, computedStyle, computedContent;
        var _a;
        if (depth === void 0) { depth = 0; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (depth > 10) {
                        throw new Error('Infinite loop detected');
                    }
                    console.log("testCssVar(cssValue: ".concat(cssValue, ", cssVar: ").concat(cssVar, ", mode: ").concat(mode, ", depth: ").concat(depth, ")"));
                    modeApplier = (_a = document.querySelector("body > [data-mode=\"".concat(mode, "\"]"))) !== null && _a !== void 0 ? _a : (function createModeApplier() {
                        var createdModeApplier = document.createElement('div');
                        createdModeApplier.dataset.mode = mode;
                        document.body.append(createdModeApplier);
                        return createdModeApplier;
                    })();
                    {
                        testElementAssumeUnitfulLength = document.createElement('div');
                        testElementAssumeUnitfulLength.style.width = cssValue;
                        testElementAssumeUnitfulLength.style.height = cssValue;
                        modeApplier.append(testElementAssumeUnitfulLength);
                        computedStyle = window.getComputedStyle(testElementAssumeUnitfulLength);
                        computedWidth = computedStyle.getPropertyValue('width');
                        testElementAssumeUnitfulLength.remove();
                        if (computedWidth
                            === "".concat(DEFAULT_ELEMENT_WIDTH_NUMBER, "px")) {
                            /*            console.log(
                              `${cssVar} isn't a unitful length value.
                              Try treating it as a number`,
                            );*/
                        }
                        else {
                            return [2 /*return*/, {
                                    cssVar: cssVar,
                                    originalValue: cssValue,
                                    computedValue: Number(computedWidth.slice(0, -('px'.length))),
                                    varType: 'number',
                                    mode: mode,
                                    error: {
                                        message: "Figma doesn't support unitful length values,\n                          consider using a number or string for this value.\n                          If you're relying on the behavior of converting from rem to px,\n                          you can safely ignore this error.",
                                        level: cssValue.includes('em') ? 'notice' : 'error',
                                    },
                                    originalComputedValue: computedWidth,
                                }];
                        }
                    }
                    {
                        testElementAssumeNumber = document.createElement('div');
                        testElementAssumeNumber.style.width = "".concat(cssValue, "px");
                        testElementAssumeNumber.style.height = "".concat(cssValue, "px");
                        modeApplier.append(testElementAssumeNumber);
                        computedStyle = window.getComputedStyle(testElementAssumeNumber);
                        computedWidth = computedStyle.getPropertyValue('width');
                        testElementAssumeNumber.remove();
                        if (computedWidth
                            === "".concat(DEFAULT_ELEMENT_WIDTH_NUMBER, "px")) {
                            /*            console.log(
                              `${cssVar} isn't a number value.
                              Try treating it as a unitful length value`,
                            );*/
                        }
                        else {
                            return [2 /*return*/, {
                                    cssVar: cssVar,
                                    originalValue: cssValue,
                                    computedValue: Number(computedWidth.slice(0, -('px'.length))),
                                    varType: 'number',
                                    mode: mode,
                                    originalComputedValue: computedWidth,
                                }];
                        }
                    }
                    {
                        testElementAssumeColor = document.createElement('div');
                        testElementAssumeColor.style.backgroundColor = cssValue;
                        testElementAssumeColor.style.color = cssValue;
                        document.body.append(testElementAssumeColor);
                        computedStyle = window.getComputedStyle(testElementAssumeColor);
                        computedBackgroundColor = computedStyle
                            .getPropertyValue('background-color');
                        computedColor = computedStyle.getPropertyValue('color');
                        testElementAssumeColor.remove();
                        if (computedBackgroundColor === computedColor) {
                            // eslint-disable-next-line no-else-return
                            return [2 /*return*/, {
                                    cssVar: cssVar,
                                    originalValue: cssValue,
                                    computedValue: computedBackgroundColor,
                                    varType: 'color',
                                    mode: mode,
                                    originalComputedValue: computedBackgroundColor,
                                }];
                        }
                        else {
                            /*            console.log(
                              `${cssVar} isn't a color value. Try treating it as something else.`,
                            );*/
                        }
                    }
                    {
                        testElementAssumeBoxShadow = document.createElement('div');
                        testElementAssumeBoxShadow.style.boxShadow = cssValue;
                        document.body.append(testElementAssumeBoxShadow);
                        computedStyle = window.getComputedStyle(testElementAssumeBoxShadow);
                        computedBoxShadow = computedStyle
                            .getPropertyValue('box-shadow');
                        testElementAssumeBoxShadow.remove();
                        if (
                        // If the element's background color and color are different,
                        // it means at least one of them isn't applied.
                        // It means the CSS var isn't a color value.
                        computedBoxShadow === 'none') {
                            /*            console.log(
                              `${cssVar} isn't a box-shadow value.
                              Try treating it as something else.`,
                            );*/
                        }
                        else {
                            return [2 /*return*/, {
                                    cssVar: cssVar,
                                    originalValue: cssValue,
                                    computedValue: computedBoxShadow,
                                    varType: 'box-shadow',
                                    mode: mode,
                                    originalComputedValue: computedBoxShadow,
                                }];
                        }
                    }
                    testElementAssumeString = document.createElement('div');
                    testElementAssumeString.id = "testElementAssumeString".concat(cssVar);
                    testElementAssumeString.style.setProperty(cssVar, cssValue);
                    return [4 /*yield*/, new CSSStyleSheet().replace("#testElementAssumeString".concat(cssVar, "::before { content: ").concat(cssValue, "; }"))];
                case 1:
                    assumeStringStyleSheet = _b.sent();
                    document.adoptedStyleSheets.push(assumeStringStyleSheet);
                    document.body.append(testElementAssumeString);
                    computedStyle = window.getComputedStyle(testElementAssumeString);
                    computedContent = computedStyle
                        .getPropertyValue('content');
                    if (computedContent === 'none') {
                        console
                            .log(templateObject_1 || (templateObject_1 = __makeTemplateObject(["", " isn't a string (CSS content) value.\n              Try treating it as something else."], ["", " isn't a string (CSS content) value.\n              Try treating it as something else."])), cssVar);
                    }
                    else {
                        return [2 /*return*/, {
                                cssVar: cssVar,
                                originalValue: cssValue,
                                computedValue: cssValue.includes('var(--')
                                    // TODO: Handle the case where cssValue contains var(--)
                                    ? cssValue.replaceAll('var(--', 'var(--')
                                    : cssValue,
                                varType: 'string',
                                mode: mode,
                                originalComputedValue: computedContent,
                            }];
                    }
                    // If even assuming it's a string fails, return invalid.
                    return [2 /*return*/, {
                            cssVar: cssVar,
                            originalValue: cssValue,
                            computedValue: cssValue,
                            varType: 'invalid',
                            mode: mode,
                            error: {
                                message: "".concat(cssVar, "'s ").concat(cssValue, " cannot be treated as a unitful length,\n             a number, a color, a box-shadow, or a string (CSS content) value."),
                                level: 'error',
                            },
                            originalComputedValue: cssValue,
                        }];
            }
        });
    });
};
var processCssVarRuleStyle = function (ruleStyle, rule, mode) { return __awaiter(void 0, void 0, void 0, function () {
    var cssVar, cssValue, authoredCss;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                cssVar = ruleStyle;
                cssValue = rule.style.getPropertyValue(cssVar);
                if (!(0, ts_1.isPositiveNumberString)(cssValue)) return [3 /*break*/, 1];
                window.parent.postMessage({
                    authoredCss: {
                        cssVar: cssVar,
                        originalValue: cssValue,
                        computedValue: Number(cssValue),
                        varType: 'number',
                        mode: mode,
                        originalComputedValue: cssValue,
                    },
                }, '*');
                return [3 /*break*/, 5];
            case 1:
                if (!(cssValue === 'true')) return [3 /*break*/, 2];
                window.parent.postMessage({
                    authoredCss: {
                        cssVar: cssVar,
                        originalValue: cssValue,
                        computedValue: true,
                        varType: 'boolean',
                        mode: mode,
                        originalComputedValue: cssValue,
                    },
                }, '*');
                return [3 /*break*/, 5];
            case 2:
                if (!(cssValue === 'false')) return [3 /*break*/, 3];
                window.parent.postMessage({
                    authoredCss: {
                        cssVar: cssVar,
                        originalValue: cssValue,
                        computedValue: false,
                        varType: 'boolean',
                        mode: mode,
                        originalComputedValue: cssValue,
                    },
                }, '*');
                return [3 /*break*/, 5];
            case 3: return [4 /*yield*/, testCssVar(cssValue, cssVar, mode, 0)];
            case 4:
                authoredCss = _a.sent();
                // Send the message to the outer iframe
                window.parent.postMessage({ authoredCss: authoredCss }, '*');
                _a.label = 5;
            case 5: return [2 /*return*/];
        }
    });
}); };
var processBasicRule = function (rule, mode) { return __awaiter(void 0, void 0, void 0, function () {
    var ruleStyles, i;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                ruleStyles = [];
                for (i = 0; i < rule.style.length; i++) {
                    ruleStyles.push(rule.style.item(i));
                }
                /*  for (const ruleStyle of ruleStyles) {
                  if (ruleStyle.startsWith('--')) {
                    await processCssVarRuleStyle(ruleStyle, rule, mode);
                  } else {
                    // console.log(`non-css var: ${ruleStyle}`);
                  }
                }*/
                return [4 /*yield*/, (0, lfi_1.forEachConcur)(function processRuleStyle(ruleStyle) {
                        return __awaiter(this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        if (!ruleStyle.startsWith('--')) return [3 /*break*/, 2];
                                        return [4 /*yield*/, processCssVarRuleStyle(ruleStyle, rule, mode)];
                                    case 1:
                                        _a.sent();
                                        return [3 /*break*/, 2];
                                    case 2: return [2 /*return*/];
                                }
                            });
                        });
                    }, (0, lfi_1.asConcur)(ruleStyles))];
            case 1:
                /*  for (const ruleStyle of ruleStyles) {
                  if (ruleStyle.startsWith('--')) {
                    await processCssVarRuleStyle(ruleStyle, rule, mode);
                  } else {
                    // console.log(`non-css var: ${ruleStyle}`);
                  }
                }*/
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var processNonBasicRule = function (rule) {
    console.log("non-basic rule: ".concat(rule.selectorText));
};
var processRule = function (rule) { return __awaiter(void 0, void 0, void 0, function () {
    var mode;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!/^\[data-mode=(?:"\w+"|'\w+')]$/.test(rule.selectorText.trim())) return [3 /*break*/, 2];
                mode = rule.selectorText.trim().slice('[data-mode="'.length, -'"]'
                    .length);
                return [4 /*yield*/, processBasicRule(rule, mode)];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                processNonBasicRule(rule);
                _a.label = 3;
            case 3: return [2 /*return*/];
        }
    });
}); };
var handleReceivingCss = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    var sheet, ruleList, rules, i;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, new CSSStyleSheet().replace(event.data.css)];
            case 1:
                sheet = _a.sent();
                document.adoptedStyleSheets = [sheet];
                window.parent.postMessage({ authoredCss: 'adopted stylesheets applied' }, '*');
                ruleList = sheet.cssRules;
                rules = [];
                for (i = 0; i < ruleList.length; i++) {
                    rules.push(ruleList.item(i));
                }
                return [4 /*yield*/, (0, lfi_1.forEachConcur)(processRule, (0, lfi_1.asConcur)(rules))];
            case 2:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
var messageHandler = function (event) { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!Object.hasOwn(event.data, 'css')) return [3 /*break*/, 2];
                return [4 /*yield*/, handleReceivingCss(event)];
            case 1:
                _a.sent();
                _a.label = 2;
            case 2: return [2 /*return*/];
        }
    });
}); };
window.addEventListener('message', messageHandler);
var templateObject_1;
