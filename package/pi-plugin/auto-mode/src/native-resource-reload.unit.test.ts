/**
 Original native reload routing preserves resource identity, arguments, results, and failures.

 @module
 */
import { describe, expect, it } from '@monochromatic-dev/module-test/ts';
import { nativeResourceReload, type ReloadFixture } from './native-resource-reload-fixture.ts';

/**
 An unused alternative reload must fail visibly if routing reaches it.

 @throws Error whenever unexpected native fallback runs
 */
async function unexpectedReload(): Promise<never> {
  throw new Error('Unexpected native reload fallback');
}

//region Native and registered reloads preserve the original operation

await describe({name:'',children:[
  ...[false,true].map(function route(registered) {
    return it({name:`preserves receiver, options, and result for ${registered ? 'registered policy' : 'standalone SDK'} reload`,fn:async function retainedOperation() {
      /**
       The result and options retain object identity through the selected original method.
       */
      const result={binding:'original'};
      /**
       Native optional arguments are forwarded without copying or interpretation.
       */
      const options={resolveProjectTrust:async function trust(){return true;}};
      /**
       Capture the native receiver and options independently of the tested return path.
       */
      const calls: unknown[]=[];
      /**
       The original method records its receiver without binding or replacing it.
       */
      const selected: ReloadFixture={async reload(input) {
        calls.push(this,input);
        return result;
      }};
      /**
       Registered resources must never invoke the loader's alternative method.
       */
      const loader=registered ? {reload:unexpectedReload} : selected;
      if(registered)nativeResourceReload.registerHostResource({loader,policyInput:selected});
      expect(await nativeResourceReload.reloadHostResource({loader,options})).toBe(result);
      expect(calls).toHaveLength(2);
      expect(calls[0]).toBe(selected);
      expect(calls[1]).toBe(options);
    }});
  }),
  it({name:'retains the original registered record and rejects duplicate or copied loader identities',fn:async function originalRecord() {
    /**
     An untouched native method cannot substitute for the loader object that owns it.
     */
    const loader={reload:unexpectedReload};
    /**
     Registration freezes the retained outer record without freezing borrowed capabilities.
     */
    const record={loader,policyInput:{reload:unexpectedReload}};
    nativeResourceReload.registerHostResource(record);
    expect(nativeResourceReload.readHostResource(loader)).toBe(record);
    expect(Object.isFrozen(record)).toBe(true);
    expect(Object.isFrozen(loader)).toBe(false);
    expect(function duplicate(){nativeResourceReload.registerHostResource({...record});}).toThrow('Resource loader already has a native host owner');
    expect(nativeResourceReload.readHostResource(loader)).toBe(record);
    expect(function copied(){nativeResourceReload.readHostResource({...loader});}).toThrow('Session resource loader was not created by this native host');
  }}),
  ...[false,true].flatMap(function originalFailureRoute(registered) {
    /**
     JavaScript callbacks may reject with any original value, including undefined.
     */
    const failures:readonly unknown[]=[undefined,null,'native failure',new Error('original failure')];
    return failures.map(function originalFailure(error,index) {
      return it({name:`preserves original ${registered ? 'policy' : 'SDK'} rejection ${index}`,fn:async function retainedFailure() {
        /**
         Original callback failure must pass through without wrapping or replacement.
         */
        const selected: ReloadFixture={async reload(){throw error;}};
        /**
         Registered resources route only through their original policy method.
         */
        const loader=registered ? {reload:unexpectedReload} : selected;
        if(registered)nativeResourceReload.registerHostResource({loader,policyInput:selected});
        /**
         A populated array distinguishes an undefined rejection from successful completion.
         */
        const caught:unknown[]=[];
        try {await nativeResourceReload.reloadHostResource({loader});}
        catch(value){caught.push(value);}
        expect(caught).toHaveLength(1);
        expect(caught[0]).toBe(error);
      }});
    });
  })
]});

//endregion Native and registered reloads preserve the original operation
