"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
Object.defineProperty(exports, "__esModule", { value: true });
var bun_1 = require("bun");
await Promise.all([
    (0, bun_1.$)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["vite build --config vite.config.iframe.ts --mode production && vite build --config vite.config.frontend.ts --mode production"], ["vite build --config vite.config.iframe.ts --mode production && vite build --config vite.config.frontend.ts --mode production"]))),
    (0, bun_1.$)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["vite build --config vite.config.backend.ts --mode production"], ["vite build --config vite.config.backend.ts --mode production"]))),
]);
var templateObject_1, templateObject_2;
