/**
 Preserve original dispatcher error identities and publish the deciding group mode through parsed edits. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import { parse, type Node } from 'yuku-parser';
import { NativeBatchBuildError } from './build-entries.ts';
import { applyNativeSourceEdits, type NativeSourceEdit } from './build-spans.ts';
import { walkNativeSyntax } from './build-syntax.ts';

/** Dispatcher build diagnostics do not supply runtime evidence. */
const l = tagged({ tag: 'auto-mode-native-prepared-dispatcher-source' });

//region Original declarations and member objects retain their parser-owned boundaries

/**
 Qualify the immutable original member expression before adding its existing execution mode.

 @param node - original member initializer

 @returns original member object location

 @throws NativeBatchBuildError when the original member is no longer a frozen object with fixed fields
 */
function originalMemberObject(node: Node): Extract<Node, { type: 'ObjectExpression' }> {
  const rl = tagged({ tag: originalMemberObject.name, l });
  rl.debug('qualifying original prepared member initializer');
  if ((node.type !== 'CallExpression') || node.optional || (node.arguments.length !== 1)
    || (node.callee.type !== 'MemberExpression') || node.callee.computed || node.callee.optional
    || (node.callee.object.type !== 'Identifier') || (node.callee.object.name !== 'Object')
    || (node.callee.property.type !== 'Identifier') || (node.callee.property.name !== 'freeze'))
    throw new NativeBatchBuildError('Original prepared member is not an Object.freeze call');
  const value = nonNullishOrThrow(node.arguments[0]);
  const fields = ['id', 'name', 'input'];
  if ((value.type !== 'ObjectExpression') || (value.properties.length !== fields.length)
    || value.properties.some(function changedField(property, index) {
      return (property.type !== 'Property') || property.computed || (property.kind !== 'init')
        || (property.key.type !== 'Identifier') || (property.key.name !== fields[index]);
    })) throw new NativeBatchBuildError('Original prepared member fields changed');
  return value;
}

/**
 Retain the incumbent dispatcher and error identities while exposing each member's original group mode.

 @param source - original prepared dispatcher module

 @param originalUrl - original module retaining shared error constructor identities

 @returns generated source with parser-selected error exports and member metadata

 @throws NativeBatchBuildError when original declarations or member construction change

 @example
 ```ts
 const generated = preparedDispatcherSource({ source, originalUrl });
 ```
 */
export function preparedDispatcherSource({ source, originalUrl }: {
  readonly source: string;
  readonly originalUrl: string;
}): string {
  const rl = tagged({ tag: preparedDispatcherSource.name, l });
  rl.debug('preparing parsed original native dispatcher');
  const parsed = parse(source, { sourceType: 'module', semanticErrors: true });
  if (parsed.diagnostics.length > 0) throw new NativeBatchBuildError('Cannot parse original prepared dispatcher');
  const names = ['PreparedBatchContractError', 'PreparedBatchExecutionError'];
  const edits: NativeSourceEdit[] = names.map(function retainOriginalError(name) {
    const declarations = parsed.program.body.filter(function namedError(node) {
      return (node.type === 'ExportNamedDeclaration') && (node.declaration?.type === 'ClassDeclaration')
        && (node.declaration.id.name === name);
    });
    if (declarations.length !== 1) throw new NativeBatchBuildError(`Original dispatcher error is absent or repeated: ${name}`);
    const declaration = nonNullishOrThrow(declarations[0]);
    return { start: declaration.start, end: declaration.end, text: '' };
  });
  const members = [...walkNativeSyntax(parsed.program)].filter(function memberDeclaration(node) {
    return (node.type === 'VariableDeclarator') && (node.id.type === 'Identifier') && (node.id.name === 'member');
  });
  if (members.length !== 1) throw new NativeBatchBuildError('Original prepared member declaration is absent or repeated');
  const member = nonNullishOrThrow(members[0]);
  if ((member.type !== 'VariableDeclarator') || (member.init === null))
    throw new NativeBatchBuildError('Original prepared member initializer is unavailable');
  const object = originalMemberObject(member.init);
  edits.push({ start: object.start + 1, end: object.start + 1, text: 'groupExecutionMode:serial?"sequential":"parallel",' });
  const rewritten = applyNativeSourceEdits({ source, edits: edits.toSorted(function sourceOrder(left, right) { return left.start - right.start; }) });
  const original = JSON.stringify(originalUrl);
  return `import {PreparedBatchContractError,PreparedBatchExecutionError} from ${original};\nexport {PreparedBatchContractError,PreparedBatchExecutionError} from ${original};\n${rewritten}`;
}

//endregion Original declarations and member objects retain their parser-owned boundaries
