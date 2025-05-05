"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
Object.defineProperty(exports, "__esModule", { value: true });
var bun_1 = require("bun");
await Promise.all([
    (0, bun_1.$)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["vite build --config vite.config.iframe.ts --mode development && vite build --config vite.config.frontend.ts --mode development"], ["vite build --config vite.config.iframe.ts --mode development && vite build --config vite.config.frontend.ts --mode development"]))),
    (0, bun_1.$)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["vite build --config vite.config.backend.ts --mode development"], ["vite build --config vite.config.backend.ts --mode development"]))),
]);
await Promise.all([
    (0, bun_1.$)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["vite build --config vite.config.iframe.ts --watch --mode development"], ["vite build --config vite.config.iframe.ts --watch --mode development"]))),
    (0, bun_1.$)(templateObject_4 || (templateObject_4 = __makeTemplateObject(["vite build --config vite.config.frontend.ts --watch --mode development"], ["vite build --config vite.config.frontend.ts --watch --mode development"]))),
    (0, bun_1.$)(templateObject_5 || (templateObject_5 = __makeTemplateObject(["vite build --config vite.config.backend.ts --watch --mode development"], ["vite build --config vite.config.backend.ts --watch --mode development"]))),
]);
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5;
