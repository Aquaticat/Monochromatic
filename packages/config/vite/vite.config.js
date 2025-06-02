'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
var index_ts_1 = require('./src/index.ts');
var node_path_1 = require('node:path');
var node_url_1 = require('node:url');
var __dirname = (0, node_path_1.dirname)((0, node_url_1.fileURLToPath)(import.meta.url));
var _default_1 = (0, index_ts_1.getLib)(__dirname);
exports.default = _default_1;
