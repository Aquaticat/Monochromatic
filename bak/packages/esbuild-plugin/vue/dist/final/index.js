var __defProp=Object.defineProperty;var __name=(target,value)=>__defProp(target,"name",{value,configurable:!0});import{fs,path}from"@monochromatic-dev/module-fs-path";import resolve from"@monochromatic-dev/module-resolve";import memoizeFs from"memoize-fs";async function mapParallelAsyncFn(fn,arr){let promised=arr.map((a,i)=>fn(a,i));return Promise.all(promised)}__name(mapParallelAsyncFn,"mapParallelAsyncFn");function mapParallelAsync(fn,arr){return arguments.length===1?async holder=>mapParallelAsyncFn(fn,holder):new Promise((resolve2,reject)=>{mapParallelAsyncFn(fn,arr).then(resolve2).catch(reject)})}__name(mapParallelAsync,"mapParallelAsync");import{compileScript,parse}from"vue/compiler-sfc";var memoizer=memoizeFs({cachePath:"dist/temp/cache/",cacheId:"vue",astBody:!0,retryOnInvalidCache:!0}),toTsWoCache=__name(async(input,inputPath)=>{let sfcParseResult=parse(input,{filename:inputPath});if(sfcParseResult.errors.length!==0)throw new Error(`
@monochromatic-dev/esbuild-plugin-vue failed to parse

\`\`\`${inputPath}
${input}
\`\`\`

with ${sfcParseResult.errors.length} errors:
${sfcParseResult.errors.map(error=>"code"in error?`compiler ${error.message} ${error.loc?`
\`\`\` ${error.loc.start} to ${error.loc.end}
${error.loc.source}
\`\`\`
`:""} vue(${error.code})`:`syntax ${error.message}`).join(`
`)}

and result:
${sfcParseResult.descriptor}
`);let sfcDescriptor=sfcParseResult.descriptor;if(sfcDescriptor.script)throw new Error(`
@monochromatic-dev/esbuild-plugin-vue encountered unsupported script on

\`\`\`${inputPath}
${input}
\`\`\`

with script:
${sfcDescriptor.script}

and result:
${sfcDescriptor}
`);if(sfcDescriptor.customBlocks.length>0)throw new Error(`
@monochromatic-dev/esbuild-plugin-vue encountered unsupported custom blocks on

\`\`\`${inputPath}
${input}
\`\`\`

with ${sfcDescriptor.customBlocks.length} custom blocks:
${sfcDescriptor.customBlocks}

and result:
${sfcDescriptor}
`);if(sfcDescriptor.styles.length>0)throw new Error(`
@monochromatic-dev/esbuild-plugin-vue encountered unsupported styles on

\`\`\`${inputPath}
${input}
\`\`\`

with ${sfcDescriptor.styles.length} styles:
${sfcDescriptor.styles}

and result:
${sfcDescriptor}
`);if(sfcDescriptor.cssVars.length>0)throw new Error(`
@monochromatic-dev/esbuild-plugin-vue encountered unsupported css vars on

\`\`\`${inputPath}
${input}
\`\`\`

with ${sfcDescriptor.cssVars.length} css vars:
${sfcDescriptor.cssVars}

and result:
${sfcDescriptor}
`);return compileScript(sfcDescriptor,{id:"vue",isProd:!1,babelParserPlugins:["typescript"],inlineTemplate:!0,templateOptions:{}}).content},"toTsWoCache"),toTs=await memoizer.fn(toTsWoCache),src_default=__name(options=>{let save=options?.save??!1;return{name:"vue",setup(build){let saveTo=save===!0?[build.initialOptions.outdir?`${build.initialOptions.outdir}/vue`:"dist/temp/vue"]:save===!1?[]:typeof save=="string"?[save]:save;build.onResolve({filter:/\.vue$/},async args=>({path:await resolve(args.path,args.importer),namespace:"vue"})),build.onLoad({filter:/\.*/,namespace:"vue"},async args=>{let input=await fs.readFileU(args.path),contents=await toTs(input,args.path);return await mapParallelAsync(async outputDirPath=>await fs.outputFile(`${path.join(outputDirPath,path.relative(path.join(path.resolve(),"src"),args.path))}.ts`,contents),saveTo),{contents,loader:"ts",resolveDir:(await path.parseFs(args.path)).dir}})}}},"default");export{src_default as default,toTs};
