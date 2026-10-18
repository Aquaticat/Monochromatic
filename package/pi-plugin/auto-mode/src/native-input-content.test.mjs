/** Shared storage preserves exact text without accepting another source's content accessor. @module */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createInputContentStore,isInputContentDescriptor} from '../dist/native/contract/collector/run-prompt-custody-v3/input-content.ts';
import {captureLoadedInputs} from '../dist/native/contract/collector/run-prompt-custody-v3/loaded-inputs.mjs';
import {assertManagerOriginsAppended} from '../dist/native/contract/integration/policy-source/manager-source-growth.mjs';

//region Producer-owned storage retains exact UTF-16 and JSON grammar across chunk boundaries

const retain=createInputContentStore();
const boundaries=['', 'x'.repeat(4095), 'x'.repeat(4096), 'x'.repeat(4097), '😀'.repeat(4100), '\ud800', '\ud801', 'quote" slash\\ newline\n\t\u0000 __proto__ ; $()'];
for(const text of boundaries){
 const content=retain({text,json:false});
 assert.equal(content.read(),text);
 assert.equal(content.sha256,createHash('sha256').update(text).digest('hex'));
 assert.equal(retain({text,json:false}),content);
 const serialized=JSON.stringify({text,nested:[text,{['__proto__']:text}]});
 const json=retain({text:serialized,json:true});
 assert.equal(json.read(),serialized);
 assert.deepEqual(JSON.parse(json.read()),JSON.parse(serialized));
}
const first=retain({text:'\ud800',json:false});
const second=retain({text:'\ud801',json:false});
assert.equal(first.sha256,second.sha256,'Positive control: UTF-8 encoding replaces both unpaired surrogate code units');
assert.notEqual(first,second,'A digest cannot merge different original UTF-16 text');
const escaped='a'.repeat(4093)+'\\"\\\\\n😀\ud800';
const serialized=JSON.stringify({first:escaped,second:[escaped,escaped+'tail']});
assert.equal(retain({text:serialized,json:true}).read(),serialized);

//endregion Producer-owned storage retains exact UTF-16 and JSON grammar across chunk boundaries

//region Exact source identity controls the pure accessor exception after caller authentication

const pool=captureLoadedInputs([]);
function append(message){pool.captureManagerInput({frame:arguments,method:'appendMessage'});}
append({role:'user',content:'Original retained source'});
const origins=pool.readConstructedInputs();
assertManagerOriginsAppended({before:Object.freeze([]),after:origins});
const original=origins[0];
const descriptor=Object.getOwnPropertyDescriptor(original.source,'content');
assert.equal(typeof descriptor.get,'function');
assert.equal(isInputContentDescriptor({record:original.source,key:'content',field:descriptor}),true);
const copied=Object.freeze(Object.create(Object.prototype,Object.getOwnPropertyDescriptors(original.source)));
assert.equal(isInputContentDescriptor({record:copied,key:'content',field:Object.getOwnPropertyDescriptor(copied,'content')}),false);
assert.throws(function borrowedGetterCannotQualifyAnotherSource(){assertManagerOriginsAppended({before:Object.freeze([]),after:Object.freeze([Object.freeze({...original,source:copied})])});},/named data fields/);
const state={reads:0};
const fields=Object.getOwnPropertyDescriptors(original.source);
fields.content={enumerable:true,configurable:false,get(){state.reads++;return 'Forged content';}};
const foreign=Object.freeze(Object.create(Object.prototype,fields));
assert.throws(function foreignAccessorIsNotInvoked(){assertManagerOriginsAppended({before:Object.freeze([]),after:Object.freeze([Object.freeze({...original,source:foreign})])});},/named data fields/);
assert.equal(state.reads,0);
console.log(JSON.stringify({complete:true,exactCodeUnits:true,escapedBoundaries:true,digestCollisionControl:true,originalAccessorOnly:true,foreignGetterReads:state.reads}));

//endregion Exact source identity controls the pure accessor exception after caller authentication
