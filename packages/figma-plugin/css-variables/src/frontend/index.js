"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
Object.defineProperty(exports, "__esModule", { value: true });
var ts_1 = require("@monochromatic-dev/module-es/ts");
await (0, ts_1.logtapeConfigure)(await (0, ts_1.logtapeConfiguration)());
var l = (0, ts_1.logtapeGetLogger)(['a', 'ui']);
var iframe = document.querySelector('#authoredCss');
var handleMessage = function (event) {
    if (Object.hasOwn(event.data, 'pluginMessage')) {
        var pluginMessage = event
            .data
            .pluginMessage;
        l.info(templateObject_1 || (templateObject_1 = __makeTemplateObject(["got this from plugin ", ""], ["got this from plugin ", ""])), pluginMessage);
        if (Object.hasOwn(pluginMessage, 'generatedCssForLocalVariables')) {
            // CSS as authored
            var css = pluginMessage.generatedCssForLocalVariables;
            iframe.contentWindow.postMessage({ css: css }, '*');
        }
    }
    else if (Object.hasOwn(event.data, 'authoredCss')) {
        var authoredCss = event
            .data
            .authoredCss;
        if (Object.hasOwn(authoredCss, 'cssVar')) {
            // Send data to plugin backend and set the variable value in Figma in specified mode to computed value.
            window.parent.postMessage({ pluginMessage: authoredCss }, '*');
        }
        else {
            l.info(templateObject_2 || (templateObject_2 = __makeTemplateObject(["got this from authoredCss ", ""], ["got this from authoredCss ", ""])), authoredCss);
        }
    }
};
window.addEventListener('message', handleMessage);
var templateObject_1, templateObject_2;
