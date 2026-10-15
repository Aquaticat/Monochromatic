/** Publish a verified native release without replacing its immutable module paths. @module */
import {lstat,rename,symlink} from 'node:fs/promises';
import {basename,dirname,join} from 'node:path';
import {tagged} from '@monochromatic-dev/module-logger/ts';
import {NativeSourceBuildError,nativeBuildLog} from './build-contract.ts';

//region Only publication changes the active command target.
/** Absence is valid for the first installation; other filesystem failures remain errors. */
async function previousEntry(active:string):Promise<Awaited<ReturnType<typeof lstat>>|undefined>{
 try{return await lstat(active);}
 catch(error){
  if(!(error instanceof Error)||!('code' in error)||error.code!=='ENOENT')throw error;
  tagged({tag:previousEntry.name,l:nativeBuildLog}).debug(`No previous native release: ${String(error)}`);
  return undefined;
 }
}
/**
 Replace the active release link after verification; retain earlier releases for running processes.
 The first migration preserves the old directory and restores it if publication fails.

 @param output - complete release whose generated absolute imports must remain valid

 @param active - stable command location

 @throws NativeSourceBuildError when the existing command location is neither directory nor link

 @throws original filesystem error after restoring a migrated directory
 */
export async function activateNativeBuild({output,active}: {
 readonly output:string;
 readonly active:string;
}): Promise<void> {
 /** Publication diagnostics omit session and credential material. */
 const l=tagged({tag:activateNativeBuild.name,l:nativeBuildLog});
 l.debug('publishing verified native release');
 /** The temporary link shares the active entry's filesystem for atomic rename. */
 const link=`${output}.link`;
 await symlink(basename(output),link,'dir');
 /** Legacy installations used a directory at the stable command path. */
 const previous=await previousEntry(active);
 if(previous&&!previous.isDirectory()&&!previous.isSymbolicLink())
  throw new NativeSourceBuildError('Native activation requires an existing directory or release link');
 /** Preserve the first directory installation instead of deleting its modules. */
 const backup=join(dirname(active),`${basename(output)}-previous`);
 if(previous?.isDirectory())await rename(active,backup);
 try{await rename(link,active);}
 catch(error){
  if(previous?.isDirectory())await rename(backup,active);
  throw error;
 }
 l.debug('verified native release is active');
}
//endregion Release publication
