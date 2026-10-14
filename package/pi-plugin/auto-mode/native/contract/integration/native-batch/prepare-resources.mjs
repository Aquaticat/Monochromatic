import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sdk,core,ai,tui} from '../current-sdk/paths.ts';
import {extensionToolSource,resourceToolSource} from './extension-tool-source.ts';
import {replaceOnce} from './build-rebase.ts';
import {rewriteNativeImports} from './build-imports.ts';

/** Prepare the original native prepareResources modules with qualified source edits. */
export async function prepareResources({output,entry,imports}) {
  const extensionLoaderPath=join(
    sdk,
    'dist/core/extensions/loader.js'
  ),resourceLoaderPath=join(
    sdk,
    'dist/core/resource-loader.js'
  );
  const nativeAliases={
   '@earendil-works/pi-agent-core':entry({root:core}),
   '@earendil-works/pi-tui':entry({root:tui}),
   '@earendil-works/pi-ai/compat':entry({
     root:ai,
     subpath:'./compat'
   }),
   '@earendil-works/pi-ai/oauth':entry({
     root:ai,
     subpath:'./oauth'
   }),
   '@earendil-works/pi-ai/providers/all':entry({root:ai,subpath:'./providers/*'})
     .replace('*','all')
  };
  const originalExtensionLoader=extensionToolSource(await readFile(
    extensionLoaderPath,
    'utf8'
  ));
  const aliasedExtensionLoader=replaceOnce({
    source:originalExtensionLoader,
    from:'import.meta.resolve(specifier)',
    to:'('+JSON.stringify(nativeAliases)+')[specifier]'
  });
  const locatedExtensionLoader=aliasedExtensionLoader.replaceAll(
    'import.meta.url',
    JSON.stringify(pathToFileURL(extensionLoaderPath).href)
  );
  const extensionLoader=rewriteNativeImports({
    source:locatedExtensionLoader,
    path:extensionLoaderPath,
    select:function rebaseNativeDynamicImport({specifier,kind}) {
      return kind==='dynamic'&&specifier.startsWith('.')?new URL(specifier,pathToFileURL(extensionLoaderPath)).href:specifier;
    }
  });
  await writeFile(
    join(output,'extension-loader.mjs'),
    imports({source:extensionLoader,path:extensionLoaderPath}),
    {mode:0o600}
  );
  const poolUrl=new URL(
    '../../collector/run-prompt-custody-v3/loaded-inputs.mjs',
    import.meta.url
  ).href;
  const resourceLoader=imports({
    source:resourceToolSource(await readFile(resourceLoaderPath,'utf8')),
    path:resourceLoaderPath,
    overrides:{
   './extensions/loader.js':pathToFileURL(join(output,'extension-loader.mjs')).href,
   '@earendil-works/pi-tui':entry({root:tui}),
   chalk:pathToFileURL(createRequire(pathToFileURL(resourceLoaderPath)).resolve('chalk')).href,
   [poolUrl]:poolUrl
  }
  });
  await writeFile(
    join(output,'resource-loader.mjs'),
    resourceLoader,
    {mode:0o600}
  );
}
