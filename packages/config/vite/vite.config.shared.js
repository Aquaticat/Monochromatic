"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
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
exports.getFigmaIframe = exports.getFigmaFrontend = exports.getFigmaBackend = exports.getShared = void 0;
var custom_units_1 = require("@csstools/custom-units");
var node_fs_1 = require("node:fs");
var node_fs_2 = require("node:fs");
var node_path_1 = require("node:path");
var postcss_custom_media_1 = require("postcss-custom-media");
var postcss_custom_selectors_1 = require("postcss-custom-selectors");
var postcss_mixins_1 = require("postcss-mixins");
var vite_1 = require("vite");
var vite_plugin_singlefile_1 = require("vite-plugin-singlefile");
var firefoxVersion = 128 << 16;
function createBaseConfig(configDir) {
    return {
        plugins: [],
        resolve: {
            alias: {
                '@': (0, node_path_1.resolve)(configDir),
                '@_': (0, node_path_1.resolve)(configDir, 'src'),
            },
        },
        css: {
            postcss: {
                plugins: [
                    (0, postcss_mixins_1.default)(),
                    (0, custom_units_1.default)(),
                    (0, postcss_custom_media_1.default)(),
                    (0, postcss_custom_selectors_1.default)(),
                ],
            },
            lightningcss: {
                targets: {
                    firefox: firefoxVersion,
                },
                cssModules: false,
            },
            preprocessorMaxWorkers: true,
            devSourcemap: true,
        },
        esbuild: {},
        build: {
            target: 'firefox128',
            cssMinify: 'lightningcss',
            outDir: 'dist/final',
            emptyOutDir: true,
            rollupOptions: {},
        },
        worker: {
            format: 'es',
        },
    };
}
function withNoMinify(config) {
    return __assign(__assign({}, config), { build: __assign(__assign({}, config.build), { minify: false }) });
}
function createModeConfig(configDir, sharedFactory) {
    return (0, vite_1.defineConfig)(function (_a) {
        var mode = _a.mode;
        switch (mode) {
            case 'development':
                return withNoMinify(sharedFactory(configDir));
            case 'production':
                return sharedFactory(configDir);
            default:
                throw new Error("invalid mode ".concat(mode));
        }
    });
}
function createBackendConfig(configDir) {
    var base = createBaseConfig(configDir);
    return __assign(__assign({}, base), { esbuild: __assign(__assign({}, base.esbuild), { supported: {
                'dynamic-import': false,
                'object-rest-spread': false,
                'top-level-await': false,
            } }), build: __assign(__assign({}, base.build), { target: 'es2019', outDir: 'dist/final/backend', lib: {
                entry: (0, node_path_1.resolve)(configDir, 'src/backend/index.ts'),
                name: 'index',
                fileName: 'index',
                formats: ['iife'],
            }, rollupOptions: {
                output: {
                    inlineDynamicImports: true,
                },
            } }) });
}
function createFrontendLikeConfig(configDir, subDir) {
    var base = createBaseConfig(configDir);
    return __assign(__assign({}, base), { define: {
            __filename: '""',
            __dirname: '""',
        }, esbuild: __assign(__assign({}, base.esbuild), { exclude: ['browserslist'] }), plugins: __spreadArray(__spreadArray([], (base.plugins || []), true), [
            (0, vite_plugin_singlefile_1.viteSingleFile)({}),
        ], false), root: (0, node_path_1.resolve)(configDir, "src/".concat(subDir)), build: __assign(__assign({}, base.build), { outDir: "../../dist/final/".concat(subDir) }) });
}
var getShared = function (configDir) {
    return createModeConfig(configDir, createBaseConfig);
};
exports.getShared = getShared;
var getFigmaBackend = function (configDir) {
    return createModeConfig(configDir, createBackendConfig);
};
exports.getFigmaBackend = getFigmaBackend;
var getFigmaFrontend = function (configDir) {
    return createModeConfig(configDir, function (configDir) {
        var frontendLikeConfigForFigmaFrontend = createFrontendLikeConfig(configDir, 'frontend');
        return __assign(__assign({}, frontendLikeConfigForFigmaFrontend), { plugins: __spreadArray(__spreadArray([], frontendLikeConfigForFigmaFrontend.plugins, true), [
                (function inlineIframePlugin() {
                    var iframePath = (0, node_path_1.join)(configDir, 'dist/final/iframe/index.html');
                    return {
                        name: 'vite-plugin-inline-iframe',
                        enforce: 'post',
                        buildStart: function () {
                            this.addWatchFile(iframePath);
                        },
                        transformIndexHtml: function (html) {
                            if (html.includes('REPLACE_WITH_IFRAME_INDEX_HTML')) {
                                console.log('replacing iframe');
                                (0, node_fs_2.chmodSync)(iframePath, node_fs_1.default.constants.S_IRUSR);
                                var iframeFile = (0, node_fs_2.readFileSync)(iframePath, 'utf8');
                                return html.replace('REPLACE_WITH_IFRAME_INDEX_HTML', iframeFile.replaceAll("'", '&apos;'));
                            }
                            return html;
                        },
                    };
                })(),
            ], false) });
    });
};
exports.getFigmaFrontend = getFigmaFrontend;
var getFigmaIframe = function (configDir) {
    return createModeConfig(configDir, function (configDir) {
        return createFrontendLikeConfig(configDir, 'iframe');
    });
};
exports.getFigmaIframe = getFigmaIframe;
