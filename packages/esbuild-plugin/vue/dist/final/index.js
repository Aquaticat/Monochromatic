var __defProp=Object.defineProperty;var __name=(target,value)=>__defProp(target,"name",{value,configurable:!0});import{fs,path}from"@monochromatic.dev/module-fs-path";import resolve from"@monochromatic.dev/module-resolve";import{compileScript,parse}from"vue/compiler-sfc";var __defProp2=Object.defineProperty,__name2=__name((target,value)=>__defProp2(target,"name",{value,configurable:!0}),"__name"),src_default=__name2(str=>Math.abs(Number(Array.from(str,char=>char.codePointAt(0)??0).reduce((accumulator,currentCharCode)=>BigInt.asIntN(16,accumulator+BigInt(currentCharCode)),0n))).toString(36),"default");var src_default2=__name(()=>({name:"vue",setup(build){let cache=new Map;build.onResolve({filter:/\.vue$/},async args=>({path:await resolve(args.path,args.importer),namespace:"vue"})),build.onLoad({filter:/\.*/,namespace:"vue"},async args=>{let input=await fs.readFileU(args.path),value=cache.get(args.path);if(value&&value.input===input)return{contents:value.output,loader:"ts",resolveDir:(await path.parseFs(args.path)).dir};let sfcParseResult=parse(input,{filename:args.path});if(sfcParseResult.errors.length!==0)throw new Error(`
@monochromatic.dev/esbuild-plugin-vue failed to parse

\`\`\`${args.path}
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
@monochromatic.dev/esbuild-plugin-vue encountered unsupported script on

\`\`\`${args.path}
${input}
\`\`\`

with script:
${sfcDescriptor.script}

and result:
${sfcDescriptor}
`);if(sfcDescriptor.customBlocks.length>0)throw new Error(`
@monochromatic.dev/esbuild-plugin-vue encountered unsupported custom blocks on

\`\`\`${args.path}
${input}
\`\`\`

with ${sfcDescriptor.customBlocks.length} custom blocks:
${sfcDescriptor.customBlocks}

and result:
${sfcDescriptor}
`);if(sfcDescriptor.styles.length>0)throw new Error(`
@monochromatic.dev/esbuild-plugin-vue encountered unsupported styles on

\`\`\`${args.path}
${input}
\`\`\`

with ${sfcDescriptor.styles.length} styles:
${sfcDescriptor.styles}

and result:
${sfcDescriptor}
`);if(sfcDescriptor.cssVars.length>0)throw new Error(`
@monochromatic.dev/esbuild-plugin-vue encountered unsupported css vars on

\`\`\`${args.path}
${input}
\`\`\`

with ${sfcDescriptor.cssVars.length} css vars:
${sfcDescriptor.cssVars}

and result:
${sfcDescriptor}
`);let hash=src_default(args.path),output=compileScript(sfcDescriptor,{id:hash,isProd:!1,babelParserPlugins:["typescript"],inlineTemplate:!0,templateOptions:{}}).content,newValue={input,output};return cache.set(args.path,newValue),{contents:output,loader:"ts",resolveDir:(await path.parseFs(args.path)).dir}}),build.onDispose(()=>{cache.clear()})}}),"default");export{src_default2 as default};
