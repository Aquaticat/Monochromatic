import type { Plugin } from 'esbuild'
import {fs} from '@monochromatic.dev/module-fs-path'
import { parse } from 'node:querystring'
import { loadEntry } from './entry.ts'
import { resolveScript } from './script.ts'
import { resolveTemplate } from './template.ts'
import type { SFCTemplateCompileOptions, SFCScriptCompileOptions } from 'vue/compiler-sfc'

export interface Options {
    templateOptions?: Pick<
        SFCTemplateCompileOptions,
        'compiler' | 'preprocessLang' | 'preprocessOptions' | 'compilerOptions' | 'transformAssetUrls'
    >

    scriptOptions?: Pick<SFCScriptCompileOptions, 'babelParserPlugins'>
}

function plugin({ templateOptions, scriptOptions }: Options = {}): Plugin {
    return {
        name: 'vue',
        setup(build) {
            const { sourcemap } = build.initialOptions
            const isProd = process.env.NODE_ENV === 'production'

            build.onLoad(
                {
                    filter: /\.vue$/
                },
                async args => {
                    const filename = args.path
                    const source = await fs.readFileU(filename)
                    const { code, errors } = loadEntry(source, filename, !!sourcemap)
                    return {
                        contents: code,
                        errors
                    }
                }
            )

            build.onResolve(
                {
                    filter: /\.vue\?type=script/
                },
                args => {
                    return {
                        path: args.path,
                        namespace: 'vue-script'
                    }
                }
            )

            build.onLoad(
                {
                    filter: /.*/,
                    namespace: 'vue-script'
                },
                args => {
                    const [filename, dirname] = resolvePath(args.path)
                    const { code, error, isTs } = resolveScript(
                        filename,
                        scriptOptions,
                        templateOptions,
                        isProd,
                        !!sourcemap
                    )
                    return {
                        contents: code,
                        errors: error,
                        resolveDir: dirname,
                        loader: isTs ? 'ts' : 'js'
                    }
                }
            )

            build.onResolve(
                {
                    filter: /\.vue\?type=template/
                },
                args => {
                    return {
                        path: args.path,
                        namespace: 'vue-template'
                    }
                }
            )

            build.onLoad(
                {
                    filter: /.*/,
                    namespace: 'vue-template'
                },
                args => {
                    const [filename, dirname] = resolvePath(args.path)
                    const { code, errors } = resolveTemplate(filename, templateOptions, isProd)
                    return {
                        contents: code,
                        errors,
                        resolveDir: dirname
                    }
                }
            )
        }
    }
}

export default plugin

// for commonjs default require()
module.exports = plugin
