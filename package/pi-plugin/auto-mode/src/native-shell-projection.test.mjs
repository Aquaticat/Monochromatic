import assert from 'node:assert/strict';
import {projectPreparedOperation,projectVisibleOperation,projectOperationSummary} from '../dist/native/contract/integration/action-policy/wire-material.mjs';

//region Built provider projections distinguish execution syntax from literal argument data.
function review(command){
 const blocks=[{type:'thinking',thinking:'PRIVATE_THINKING'},{type:'toolCall',id:'local-id',name:'bash',arguments:{command,timeout:40},thoughtSignature:'PRIVATE_SIGNATURE'}];
 const projected=projectVisibleOperation(blocks);
 assert.deepEqual(projectPreparedOperation([{name:'bash',input:{command,timeout:40}}])[0].input,projected[0].arguments);
 assert.equal(projected[0].arguments.timeout,40);
 assert.equal(Object.hasOwn(projected[0].arguments,'command'),false);
 assert.equal(JSON.stringify(projected).includes('PRIVATE_'),false);
 assert.equal(blocks[1].arguments.command,command);
 return projected[0].arguments.shell.syntax;
}
const compound=review('MODE=test cat "input file" 2>error.log | wc -l && printf done || printf failed');
const logical=compound.commands[0].command;
assert.deepEqual(logical.operators,['&&','||']);
assert.deepEqual(logical.commands[0].operators,['|']);
const cat=logical.commands[0].commands[0];
assert.equal(cat.prefix[0].name,'MODE');
assert.equal(cat.suffix[0].parts[0].type,'DoubleQuoted');
assert.equal(cat.suffix[1].operator,'>');
assert.equal(cat.suffix[1].descriptor.value,2);
assert.equal(cat.suffix[1].target.value,'error.log');
const literal=JSON.stringify(review("printf '%s' '$(cat private.txt)'"));
assert.ok(literal.includes('SingleQuoted'));
assert.equal(literal.includes('CommandExpansion'),false);
const substitution=JSON.stringify(review('printf "%s" "$(cat private.txt)"'));
assert.ok(substitution.includes('CommandExpansion'));
assert.ok(substitution.includes('private.txt'));
assert.equal(substitution.includes('$(cat private.txt)'),false);
assert.ok(JSON.stringify(review('cat <(printf data)')).includes('ProcessSubstitution'));
assert.ok(JSON.stringify(review('printf "%s" "$((1 + 2))"')).includes('ArithmeticBinary'));
assert.ok(JSON.stringify(review('printf "%s" "${path:-fallback}"')).includes('Default'));
const quotedHeredoc=JSON.stringify(review("cat <<'END'\n$(cat private.txt)\nEND\n"));
assert.equal(quotedHeredoc.includes('CommandExpansion'),false);
assert.ok(quotedHeredoc.includes('$(cat private.txt)'));
const activeHeredoc=JSON.stringify(review('cat <<END\n$(cat private.txt)\nEND\n'));
assert.ok(activeHeredoc.includes('CommandExpansion'));
assert.equal(activeHeredoc.includes('$(cat private.txt)'),false);
assert.throws(function incomplete(){review('if true; then cat file');});
assert.throws(function missingCommand(){projectVisibleOperation([{type:'toolCall',name:'bash',arguments:{timeout:2}}]);},{name:'ReviewOperationInputError'});
assert.deepEqual(review('').commands,[]);
const malformed=[{type:'thinking',thinking:'PRIVATE_THINKING'},{type:'toolCall',name:'bash',arguments:{command:'if true; then cat file'}}];
assert.equal(projectOperationSummary(malformed)[0].arguments.command,'if true; then cat file');
assert.equal(JSON.stringify(projectOperationSummary(malformed)).includes('PRIVATE_THINKING'),false);
assert.deepEqual(projectPreparedOperation([{name:'read',input:{path:'file'}}]),[{name:'read',input:{path:'file'}}]);
const processInput={action:'start',command:'MODE=test bash -lc "cat private.txt" > output.log',cwd:'/fixture',name:'fixture',notify:{onFailure:'turn'}};
const processBlocks=[{type:'toolCall',name:'process',arguments:processInput}];
const projectedProcess=projectVisibleOperation(processBlocks)[0].arguments;
assert.equal(Object.hasOwn(projectedProcess,'command'),false);
assert.equal(projectedProcess.action,'start');
assert.equal(projectedProcess.cwd,'/fixture');
assert.deepEqual(projectedProcess.notify,processInput.notify);
assert.ok(JSON.stringify(projectedProcess.shell.syntax).includes('private.txt'));
assert.deepEqual(projectPreparedOperation([{name:'process',input:processInput}])[0].input,projectedProcess);
assert.equal(processBlocks[0].arguments,processInput);
assert.equal(processInput.command,'MODE=test bash -lc "cat private.txt" > output.log');
assert.throws(function missingProcessCommand(){projectPreparedOperation([{name:'process',input:{action:'start'}}]);},{name:'ReviewOperationInputError'});
for(const action of ['output','write','stop','list','update','clear']){
 const input={action,input:'printf arbitrary stdin',id:'fixture-id'};
 assert.deepEqual(projectPreparedOperation([{name:'process',input}])[0].input,input);
}
console.log(JSON.stringify({complete:true,parsedBash:true,thinkingAbsent:true,literalAndExecutionDistinct:true,humanFallbackRetained:true}));
//endregion
