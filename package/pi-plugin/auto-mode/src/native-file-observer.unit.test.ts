/** Descriptor-bound observations retain synchronous freshness and exact cleanup failures. @module */
import assert from 'node:assert/strict';
import {closeSync,fstatSync,readSync} from 'node:fs';
import {mkdir,mkdtemp,rm,symlink,writeFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {describe,it} from '@monochromatic-dev/module-test/ts';

//region The consumer receives a completed snapshot before observation returns.
/** Required stable snapshot fields. */
type Snapshot={
  /** Selected relative filename. */
  readonly relativePath:string;
  /** Exact observed bytes. */
  readonly bytes:Buffer;
};
/** Controlled read boundary used to exercise short reads and original failures. */
type ReadInput={
  /** Original open descriptor. */
  readonly fd:number;
  /** Owner-allocated bounded buffer. */
  readonly buffer:Buffer;
  /** Next output position. */
  readonly offset:number;
  /** Maximum remaining capacity. */
  readonly length:number;
  /** Original file position. */
  readonly position:number;
};
/** Required built module surface. */
type ObserverModule={
  /** Synchronous result preserves the surrounding original freshness boundary. */
  readonly observeDeclaredFile:(input:{
    /** Independently owned root. */
    readonly root:string;
    /** Root-relative selected input. */
    readonly relativePath:string;
    /** Exact expected permissions. */
    readonly requiredMode:number;
    /** Bounded read allocation. */
    readonly maxBytes?:number;
    /** Test-owned read interception. */
    readonly read?:(input:ReadInput)=>number;
  })=>Snapshot;
};
/**
 Admit only the required built observer export.
 @param value - copied module namespace
 @throws Error when the callable is missing
 */
function assertObserverModule(value:unknown):asserts value is ObserverModule{
  if((value===null)||((typeof value)!=='object')||(!('observeDeclaredFile' in value))
    ||((typeof value.observeDeclaredFile)!=='function'))throw new Error('Built file observer is unavailable');
}
/** Original copied artifact selected through its consumer URL. */
const loaded:unknown=await import(new URL('../dist/native/contract/lifecycle/external-dependency-controls/file-observer.ts',import.meta.url).href);
assertObserverModule(loaded);
/** Checked built callable namespace. */
const observer=loaded;
/**
 Capture the exact synchronous thrown value.
 @param operation - built observer call
 @returns original thrown value
 @throws Error when observation unexpectedly succeeds
 */
function failure(operation:()=>unknown):unknown{
  try{
    operation();
  }
  catch(error){
    return error;
  }
  throw new Error('File observation unexpectedly succeeded');
}
/**
 Allocate disposable file data with no mutations to real policy or cache entries.
 @returns scoped root and original observation input
 */
async function fixture(){
  const scratch=join(homedir(),'temp/agent');
  await mkdir(scratch,{recursive:true,mode:0o700});
  const root=await mkdtemp(join(scratch,'pi-file-observer-'));
  await writeFile(join(root,'policy'),'original',{mode:0o600});
  return {root,input:{root,relativePath:'policy',requiredMode:0o600},
    async [Symbol.asyncDispose](){
      await rm(root,{recursive:true,force:true});
    }
  };
}
//endregion

await describe({name:'',children:[
  it({name:'returns completed bytes synchronously and handles repeated short reads',fn:async function shortReads(){
    await using current=await fixture();
    const descriptors:number[]=[];
    const snapshot=observer.observeDeclaredFile({...current.input,read({fd,buffer,offset,length,position}){
      descriptors.push(fd);
      return readSync(fd,buffer,offset,Math.min(length,1),position);
    }});
    assert.equal('then' in snapshot,false);
    assert.equal(snapshot.bytes.toString(),'original');
    assert.ok(Object.isFrozen(snapshot));
    assert.equal(descriptors.length,9);
    for(const descriptor of descriptors){
      const error=failure(function closed(){
        return fstatSync(descriptor);
      });
      assert.ok(Error.isError(error));
      assert.ok('code' in error);
      assert.equal(error.code,'EBADF');
    }
  }}),
  it({name:'closes the descriptor while preserving an original read failure',fn:async function originalFailure(){
    await using current=await fixture();
    const original=new Error('Fixture read failed');
    const descriptors:number[]=[];
    const error=failure(function readFailure(){
      return observer.observeDeclaredFile({...current.input,read({fd}){
      descriptors.push(fd);
      throw original;
    }});
    });
    assert.equal(error,original);
    assert.equal(descriptors.length,1);
    for(const descriptor of descriptors)assert.throws(function closed(){
      fstatSync(descriptor);
    });
  }}),
  it({name:'aggregates original read and close failures in occurrence order',fn:async function cleanupFailure(){
    await using current=await fixture();
    const original=new Error('Fixture read failed after closing');
    const error=failure(function readFailure(){
      return observer.observeDeclaredFile({...current.input,read({fd}){
      closeSync(fd);
      throw original;
    }});
    });
    assert.ok(Error.isError(error));
    assert.equal(error.name,'ObservationLifecycleError');
    assert.ok(error.cause instanceof AggregateError);
    const errors:readonly unknown[]=error.cause.errors;
    assert.equal(errors.length,2);
    assert.equal(errors[0],original);
    const [,closeError]=errors;
    assert.ok(Error.isError(closeError));
    assert.ok('code' in closeError);
    assert.equal(closeError.code,'EBADF');
  }}),
  ...[-1,1.5,Number.NaN,100].map(function invalidCount(count){
    return it({name:`rejects invalid read count ${String(count)}`,fn:async function invalidRead(){
      await using current=await fixture();
      const error=failure(function readFailure(){
        return observer.observeDeclaredFile({...current.input,read(){
        return count;
      }});
      });
      assert.ok(Error.isError(error));
      assert.equal(error.name,'ObservationLifecycleError');
      assert.ok(error.cause instanceof AggregateError);
    }});
  }),
  it({name:'rejects incomplete reads and declared byte-bound overflow',fn:async function readBounds(){
    await using current=await fixture();
    const short=failure(function truncated(){
      return observer.observeDeclaredFile({...current.input,read(){
      return 0;
    }});
    });
    assert.ok(Error.isError(short));
    assert.equal(short.name,'ObservedFileUnstableReadError');
    const large=failure(function oversized(){
      return observer.observeDeclaredFile({...current.input,maxBytes:1});
    });
    assert.ok(Error.isError(large));
    assert.equal(large.name,'ObservedFileOversizeError');
  }}),
  it({name:'rejects missing, redirected, and out-of-scope inputs',fn:async function selectionBoundaries(){
    await using current=await fixture();
    await symlink(join(current.root,'policy'),join(current.root,'link'));
    const cases=[['missing','ObservedFileMissingError'],['link','ObservedFileTypeError'],['../policy','ObservedFileScopeError']] as const;
    for(const [relativePath,name] of cases){
      const error=failure(function invalidPath(){
        return observer.observeDeclaredFile({...current.input,relativePath});
      });
      assert.ok(Error.isError(error));
      assert.equal(error.name,name);
    }
  }}),
]});
