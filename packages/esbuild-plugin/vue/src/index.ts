import {fs, path} from '@monochromatic.dev/module-fs-path'
import type { Plugin } from 'esbuild'
import {parse, compileScript, compileTemplate, rewriteDefault} from 'vue/compiler-sfc'

export default (): Plugin => {
  return {
    name: 'vue',

    setup(build) {
      build.onResolve({ filter: /\.vue$/ }, (args) => {
        return {
          path: args.path,
          namespace: 'vue',
          pluginData: { resolveDir: args.resolveDir },
        }
      })

      build.onResolve({ filter: /\?vue&type=template/ }, (args) => {
        return {
          path: args.path,
          namespace: 'vue',
          pluginData: { resolveDir: args.resolveDir },
        }
      })

      build.onResolve({ filter: /\?vue&type=script/ }, (args) => {
        return {
          path: args.path,
          namespace: 'vue',
          pluginData: { resolveDir: args.resolveDir },
        }
      })

      build.onResolve({ filter: /\?vue&type=style/ }, (args) => {
        return {
          path: args.path,
          namespace: 'vue',
          pluginData: { resolveDir: args.resolveDir },
        }
      })

      build.onLoad({ filter: /\.vue$/, namespace: 'vue' }, async (args) => {
        const { resolveDir } = args.pluginData
        const filepath = formatPath(args.path, resolveDir)
        const content = await fs.readFileU(filepath)
        const sfc = parse(content);

        let contents = ``

        const inlineTemplate =
          !!sfc.descriptor.scriptSetup && !sfc.descriptor.template?.src
        const isTS =
          sfc.descriptor.scriptSetup?.lang === 'ts' ||
          sfc.descriptor.script?.lang === 'ts'
        const hasScoped = sfc.descriptor.styles.some((s) => s.scoped)

          const scriptResult = compileScript(sfc.descriptor, {
            inlineTemplate,
          })
          contents += rewriteDefault(
            scriptResult.content,
            '__sfc_main',
          )

          contents += `
          import { render } from "${args.path}?vue&type=template"

          __sfc_main.render = render
          `

        if (hasScoped) {
          contents += `__sfc_main.__scopeId = "data-v-${genId(args.path)}"\n`
        }

        contents += `\nexport default __sfc_main`
        return {
          contents,
          resolveDir,
          loader: 'ts',
          watchFiles: [filepath],
        }
      })

      build.onLoad(
        { filter: /\?vue&type=template/, namespace: 'vue' },
        async (args) => {
          const { resolveDir } = args.pluginData
          const relativePath = removeQuery(args.path)
          const filepath = formatPath(relativePath, resolveDir)
          const source = await fs.readFileU(filepath)
          const { descriptor } = parse(source)
            const hasScoped = descriptor.styles.some((s) => s.scoped)
            const id = genId(relativePath)

            const compiled = compileTemplate({
              source: descriptor.template.content,
              filename: filepath,
              id,
              scoped: hasScoped,
              isProd: process.env.NODE_ENV === 'production',
              slotted: descriptor.slotted,
              compilerOptions: {
                scopeId: hasScoped ? `data-v-${id}` : undefined,
                expressionPlugins,
              },
            })
            return {
              resolveDir,
              contents: compiled.code,
            }
        },
      )

      build.onLoad(
        { filter: /\?vue&type=script/, namespace: 'vue' },
        async (args) => {
          const compiler = await getCompiler(absPath)
          const { resolveDir } = args.pluginData
          const relativePath = removeQuery(args.path)
          const filepath = formatPath(relativePath, resolveDir)
          const source = await fs.promises.readFile(filepath, 'utf8')

          const { descriptor } = compiler.parse(source, { filename: filepath })
          if (descriptor.script) {
            const compiled = compiler.compileScript(descriptor, {
              id: genId(relativePath),
            })
            return {
              resolveDir,
              contents: compiled.content,
              loader: 'ts',
            }
          }
        },
      )
    },
  }
}
