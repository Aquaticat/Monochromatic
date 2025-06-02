'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
var config_vite_1 = require('@monochromatic-dev/config-vite');
var node_path_1 = require('node:path');
var node_url_1 = require('node:url');
var __dirname = (0, node_path_1.dirname)((0, node_url_1.fileURLToPath)(import.meta.url));
var _default_1 = (0, config_vite_1.getLib)(__dirname);
exports.default = _default_1;
