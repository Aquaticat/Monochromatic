import path from 'node:path'
import fs from 'node:fs'
import type { SFCBlock, SFCDescriptor } from 'vue/compiler-sfc'
import type { RawSourceMap } from 'source-map-js'
import { normalizePath, transformWithEsbuild } from 'vite'
import {
  canInlineMain,
  isUseInlineTemplate,
  resolveScript,
  scriptIdentifier,
} from './script'
import { transformTemplateInMain } from './template'
import { createRollupError } from './utils/error'
import { EXPORT_HELPER_ID } from './helper'
import type { ResolvedOptions } from '.'

export async function transformMain(
  code: string,
  filename: string,
  options: ResolvedOptions,
  pluginContext: TransformPluginContext,
  ssr: boolean,
  customElement: boolean,
) {
  // feature information
  const attachedProps: [string, string][] = []
  const hasScoped = descriptor.styles.some((s) => s.scoped)

  // script
  const { code: scriptCode, map: scriptMap } = await genScriptCode(
    descriptor,
    options,
    pluginContext,
    ssr,
    customElement,
  )

  // template
  const hasTemplateImport =
    descriptor.template && !isUseInlineTemplate(descriptor, !devServer)

  let templateCode = ''
  let templateMap: RawSourceMap | undefined = undefined
  if (hasTemplateImport) {
    ;({ code: templateCode, map: templateMap } = await genTemplateCode(
      descriptor,
      options,
      pluginContext,
      ssr,
      customElement,
    ))
  }

  const output: string[] = [
    scriptCode,
    templateCode,
  ]
  if (hasScoped) {
    attachedProps.push([`__scopeId`, JSON.stringify(`data-v-${descriptor.id}`)])
  }

    const normalizedFilename = normalizePath(
      path.relative(options.root, filename),
    )
    output.push(
      `import { useSSRContext as __vite_useSSRContext } from 'vue'`,
      `const _sfc_setup = _sfc_main.setup`,
      `_sfc_main.setup = (props, ctx) => {`,
      `  const ssrContext = __vite_useSSRContext()`,
      `  ;(ssrContext.modules || (ssrContext.modules = new Set())).add(${JSON.stringify(
        normalizedFilename,
      )})`,
      `  return _sfc_setup ? _sfc_setup(props, ctx) : undefined`,
      `}`,
    )

  if (!attachedProps.length) {
    output.push(`export default _sfc_main`)
  } else {
    output.push(
      `import _export_sfc from '${EXPORT_HELPER_ID}'`,
      `export default /*#__PURE__*/_export_sfc(_sfc_main, [${attachedProps
        .map(([key, val]) => `['${key}',${val}]`)
        .join(',')}])`,
    )
  }

  // handle TS transpilation
  let resolvedCode = output.join('\n')
  const lang = descriptor.scriptSetup?.lang || descriptor.script?.lang

  if (
    lang &&
    /tsx?$/.test(lang) &&
    !descriptor.script?.src // only normal script can have src
  ) {
    const { code, map } = await transformWithEsbuild(
      resolvedCode,
      filename,
      {
        loader: 'ts',
        target: 'esnext',
        sourcemap: options.sourceMap,
      },
    )
    resolvedCode = code
  }

  return {
    code: resolvedCode,
  }
}

async function genTemplateCode(
  descriptor: SFCDescriptor,
  options: ResolvedOptions,
  ssr: boolean,
  customElement: boolean,
) {
  const template = descriptor.template!
  const hasScoped = descriptor.styles.some((style) => style.scoped)

  // If the template is not using pre-processor AND is not using external src,
  // compile and inline it directly in the main module. When served in vite this
  // saves an extra request per SFC which can improve load performance.
  if ((!template.lang || template.lang === 'html') && !template.src) {
    return transformTemplateInMain(
      template.content,
      descriptor,
      options,
    )
  }
    if (template.src) {
      await linkSrcToDescriptor(
        template.src,
        descriptor,
        hasScoped,
      )
    }
    const src = template.src || descriptor.filename
    const srcQuery = template.src
      ? hasScoped
        ? `&src=${descriptor.id}`
        : '&src=true'
      : ''
    const scopedQuery = hasScoped ? `&scoped=${descriptor.id}` : ``
    const attrsQuery = attrsToQuery(template.attrs, 'js', true)
    const query = `?vue&type=template${srcQuery}${scopedQuery}${attrsQuery}`
    const request = JSON.stringify(src + query)
    const renderFnName = ssr ? 'ssrRender' : 'render'
    return {
      code: `import { ${renderFnName} as _sfc_${renderFnName} } from ${request}`,
      map: undefined,
    }
}
