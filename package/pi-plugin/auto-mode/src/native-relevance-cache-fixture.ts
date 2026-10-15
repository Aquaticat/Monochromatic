/**
 Built relevance owners operate only on disposable fixture policy and files. @module
 */
import {createHash} from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  rm
} from 'node:fs/promises';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {loadNativeParserArtifact} from './native-parser-fixture.ts';

//region Consumer contracts describe only observable cache operations.
/**
 Exact original source identity.
 */
type Source={
  /**
   Complete policy bytes.
   */
  readonly content:string;
  /**
   Production digest spelling.
   */
  readonly sha256:string;
};
/**
 Unqualified view returned by the built owner.
 */
export type CacheView={
  /**
   Original source digest.
   */
  readonly sourceSHA256:string;
  /**
   Changed rule membership.
   */
  readonly requestedRuleIds:readonly string[];
  /**
   Included rule membership.
   */
  readonly candidateRuleIds:readonly string[];
  /**
   No estimate authorizes a tool call.
   */
  readonly permission:false;
  /**
   Qualification is still absent.
   */
  readonly exclusionsAdmitted:false;
};
/**
 Built owner retains its publication and freshness checks.
 */
type Cache={
  /**
   Join the original pending job.
   */
  readonly refresh:(input?:{readonly signal:AbortSignal})=>Promise<CacheView>;
  /**
   Read the last successfully published original view.
   */
  readonly readCurrent:()=>CacheView;
  /**
   Reject views whose original policy is no longer current.
   */
  readonly assertCurrent:(view:CacheView)=>void;
};
/**
 Authored answers exercise wiring without provider requests.
 */
type Assessment={
  /**
   Complete source and changed membership retained by the consumer.
   */
  readonly request:{
    /**
     Exact authored policy.
     */
    readonly fullPolicy:string;
    /**
     Changed rule handles.
     */
    readonly rules:readonly {readonly id:string}[];
  };
};
/**
 Required callable module export.
 */
type CacheModule={
  /**
   Bind one owner to the original policy selector.
   */
  readonly bindRuleRelevanceCache:(input:{
    /**
     Identity checks belong to the fixture source owner.
     */
    readonly selection:{
      readonly capture:()=>Source;
      readonly assertCurrent:(source:Source)=>void
    };
    /**
     Built qualified parser.
     */
    readonly parse:(input:{
      readonly source:string;
      readonly mdx:boolean
    })=>unknown;
    /**
     Exclusive test-owned directory.
     */
    readonly directory:string;
    /**
     Stable namespace allows another owner to reuse entries.
     */
    readonly namespace:{
      readonly repository:string;
      readonly primaryBranch:string
    };
    /**
     Exact classifier and question identities.
     */
    readonly profile:Readonly<Record<string,string>>;
    /**
     No external model is used.
     */
    readonly assessBatch:(input:Assessment)=>Promise<readonly {
      readonly id:string;
      readonly probability:number
    }[]>;
    /**
     Events expose controlled operation boundaries.
     */
    readonly trace:(event:{readonly event:string})=>void;
  })=>Cache;
};
/**
 Require the built callable before invoking fixture operations.
 
 @param value - copied module namespace
 
 @returns normally after the required built callable is checked
 
 @throws Error when required export is missing
 */
function assertCacheModule(value:unknown):asserts value is CacheModule{
  if((value===null)||((typeof value)!=='object')
    ||(!('bindRuleRelevanceCache' in value))
    ||((typeof value.bindRuleRelevanceCache)!=='function'))throw new Error('Built relevance cache is unavailable');
}
/**
 Hash the complete fixture policy without interpreting its rules.
 
 @param content - original authored text
 
 @returns original source identity
 */
function sourceFor(content:string):Source{
  return Object.freeze({
    content,
    sha256:createHash('sha256')
      .update(content)
      .digest('hex')
  });
}
/**
 Built original module, independent of maintained source imports.
 */
const loaded:unknown=await import(new URL(
  '../dist/native/contract/lifecycle/rule-relevance-cache/cache.mjs',
  import.meta.url
).href);
assertCacheModule(loaded);
/**
 Checked factory retained across fixture construction.
 */
const cacheModule=loaded;
//endregion

//region Test-local ownership allows deterministic changes during asynchronous work.
/**
 Every callback and source replacement belongs to one disposable cache owner.
 */
type CacheFixture=AsyncDisposable&{
  /**
   Independent cache owner sharing only this fixture's persisted entries.
   */
  readonly open:()=>Cache;
  /**
   Advance the original policy occurrence.
   */
  readonly replace:(content:string)=>void;
  /**
   Original classifier requests retained for membership checks.
   */
  readonly requests:Assessment['request'][];
  /**
   Controlled callbacks run at real operation boundaries.
   */
  readonly callbacks:{
    /**
     Optional mutation at a real diagnostic boundary.
     */
    onEvent?:(event:string)=>void;
    /**
     Optional mutation during original classifier delivery.
     */
    onAssessment?:()=>void;
  };
};
/**
 Create an independent policy owner and disposable cache directory.
 
 @returns cache controls whose mutations remain inside the test
 
 @example
 ```ts
 await using fixture = await cacheFixture();
 const view = await fixture.open().refresh();
 ```
 */
export async function cacheFixture():Promise<CacheFixture>{
  /** Trusted scratch parent contains no shared test data. */
  const scratch=join(
    homedir(),
    'temp/agent'
  );
  await mkdir(
    scratch,
    {
      recursive:true,
      mode:0o700
    }
  );
  /** Exclusive directory owns every test mutation. */
  const root=await mkdtemp(join(
    scratch,
    'pi-native-cache-owner-'
  ));
  /** Consumer export comes from the current native artifact. */
  const parserModule=await loadNativeParserArtifact();
  /** Qualified parser preserves real index behavior in cache tests. */
  const parser=await parserModule.createNativeMarkdownParser({expectedVersion:'0.10.5'});
  /** Replacement changes source identity even when text is equal. */
  const state={source:sourceFor('AAA: Ask before publishing.\n\nBBB: Retain original permission.\n')};
  /** Capture exact original classifier membership. */
  const requests:Assessment['request'][]=[];
  /** Test-owned mutations run at real consumer boundaries. */
  const callbacks:CacheFixture['callbacks']={};
  /**
   Advance the source occurrence used by the original selector.
   @param content - replacement authored policy
   */
  function replace(content:string):void{
    state.source=sourceFor(content);
  }
  /**
   Bind an independent cache owner sharing only this fixture's files.
   @returns original built cache owner
   */
  function open():Cache{
    return cacheModule.bindRuleRelevanceCache({
      selection:{
        capture(){
          return state.source;
        },
        assertCurrent(source){
          if(source!==state.source)throw new Error('Fixture original policy changed');
        },
      },
      parse(input){
        return parser.parse(input);
      },
      directory:join(
        root,
        'cache'
      ),
      namespace:{
        repository:'fixture',
        primaryBranch:'main'
      },
      profile:{
        model:'authored',
        questionVersion:'1',
        remitVersion:'1',
        qualificationVersion:'none'
      },
      assessBatch({request}){
        requests.push(request);
        callbacks.onAssessment?.();
        /** Authored estimates exercise delivery without a provider request. */
        const answers=request.rules
          .map(function answer(rule){
            return {
            id:rule.id,
            probability:0.25
          };
          });
        return Promise.resolve(answers);
      },
      trace({event}){
        callbacks.onEvent?.(event);
      },
    });
  }
  return {
    open,
    replace,
    requests,
    callbacks,
    async [Symbol.asyncDispose](){
      await rm(
      root,
      {
        recursive:true,
        force:true
      }
    );
    }
  };
}
/**
 Retain original failure after fully settling the asynchronous operation.
 
 @param operation - pending built refresh
 
 @returns original rejection
 
 @throws Error when refresh unexpectedly succeeds
 
 @example
 ```ts
 const error = await cacheFailure(owner.refresh());
 ```
 */
export async function cacheFailure(operation:Promise<unknown>):Promise<unknown>{
  try{
    await operation;
  }
  catch(error){
    return error;
  }
  throw new Error('Relevance refresh unexpectedly succeeded');
}
//endregion
