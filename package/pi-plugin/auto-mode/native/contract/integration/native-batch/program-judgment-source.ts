/**
 Preserve original native program ownership while preparing qualified SDK source.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { replaceOnce } from './build-rebase.ts';
import { NativeBatchBuildError } from './build-entries.ts';

//region Original program source boundaries retain their native execution and judgment owners

/**
 Program preparation retains diagnostics separate from execution authority.
 */
const l = tagged({ tag: 'auto-mode-native-program-source' });

/**
 Bind the existing decoder's declaration to the original prepared member before policy review.

 @param source - qualified original module before program observation

 @returns generated source retaining original program ownership boundaries

 @throws NativeBatchBuildError when original source qualification changes

 @example
 ```ts
 const generated = programJudgmentSource(source);
 ```
 */
export function programJudgmentSource(source: string): string {
 /**
  Each original program transformation retains its own diagnostic boundary.
  */
 const rl = tagged({
   tag: programJudgmentSource.name,
   l
 });
 rl.debug('preparing original native program source');
 /**
  The original decoder import must be replaced without changing its declaration owner.
  */
 const importLine=source.split('\n')
   .find(function isResultProgramImport(line): boolean {
     return line.startsWith('import {declareResultProgram} ');
   });
 if (importLine === undefined) throw new NativeBatchBuildError('Original program decoder import is unavailable');
 /**
  declaration import retains its original source occurrence before the next transformation.
  */
 const declarationImport=replaceOnce({
   source,
   from:importLine,
   to:`import {assertDeclaredProgram} from ${JSON.stringify(new URL(
     "../../collector/program-rule-batch-sdk-copy-v2/input/program-profile.mjs",
     import.meta.url
   ).href)};`
 });
 /**
  dependency guard retains its original source occurrence before the next transformation.
  */
 const dependencyGuard=replaceOnce({
   source:declarationImport,
   from:'    function dependencyCheck(read){',
   to:`    function assertPreparedProgramDependencies(){
      for(const member of byMember.values())bindings.get(member).preparedProgram?.assertCurrent();
    }
    function dependencyCheck(read){`
 });
 /**
  dependency read retains its original source occurrence before the next transformation.
  */
 const dependencyRead=replaceOnce({
   source:dependencyGuard,
   from:'      try{return read();}',
   to:'      try{const value=read();if(!bindingSegmentActive)assertPreparedProgramDependencies();return value;}'
 });
 /**
  prepared binding retains its original source occurrence before the next transformation.
  */
 const preparedBinding=replaceOnce({
   source:dependencyRead,
   from:'    function openProgram({parentToken,toolNames}){',
   to:`    function bindPreparedProgram({member,declaration,assertCurrent}){
      const record=knownMember(member);
      if(record.parent!==undefined||record.execution)throw new JudgmentConstructionError('Prepared program inspection requires an unentered original root member');
      if(record.preparedProgram)throw new JudgmentConstructionError('Original prepared program inspection is already bound');
      if(typeof assertCurrent!=='function')throw new JudgmentConstructionError('Prepared program requires its original tool-dependency reader');
      assertDeclaredProgram(declaration);
      if(declaration.source!==record.prepared.input.code)throw new JudgmentConstructionError('Inspected program differs from the original prepared source');
      ready();dependencyCheck(assertCurrent);ready();
      const view=Object.freeze({kind:'original-prepared-program-inspection',member,prepared:record.prepared,declaration,permission:false});
      record.preparedProgram={view,assertCurrent};return view;
    }
    function preparedProgramFor(member){
      const record=knownMember(member);assertDependenciesCurrent();parentCurrent(record);
      return record.preparedProgram?.view;
    }
    function openProgram({parentToken,toolNames}){`
 });
 /**
  runtime declaration retains its original source occurrence before the next transformation.
  */
 const runtimeDeclaration=replaceOnce({
   source:preparedBinding,
   from:'        const declaration=declareResultProgram({source:record.prepared.input.code,toolNames});',
   to:`        const declaration=record.preparedProgram?.view.declaration;
        if(!declaration)throw new JudgmentConstructionError('Native program requires its original declaration captured before policy review');
        if(!Array.isArray(toolNames)||declaration.sites.some(site=>!toolNames.includes(site.name)))throw new JudgmentConstructionError('Runtime callables differ from the original prepared program');`
 });
 /**
  scope state retains its original source occurrence before the next transformation.
  */
 const scopeState=replaceOnce({
   source:runtimeDeclaration,
   from:"status:scope.status,failure:scope.failure,producerValueReady:",
   to:"status:scope.status,failure:scope.failure,declaration:scope.declaration,producerValueReady:"
 });
 /**
  prepared views retains its original source occurrence before the next transformation.
  */
 const preparedViews=replaceOnce({
   source:scopeState,
   from:'memberExecutions:memberExecutionStates(),rootPrograms:',
   to:'memberExecutions:memberExecutionStates(),preparedPrograms:Object.freeze([...byMember.values()].flatMap(member=>{const inspection=bindings.get(member).preparedProgram;return inspection?[inspection.view]:[];})),rootPrograms:'
 });
 return replaceOnce({
   source:preparedViews,
   from:'const judgment=Object.freeze({openProgram:',
   to:'const judgment=Object.freeze({bindPreparedProgram:input=>operation(()=>bindPreparedProgram(input)),preparedProgramFor:member=>operation(()=>preparedProgramFor(member)),openProgram:'
 });
}


//endregion Original program source boundaries retain their native execution and judgment owners
