/**
 Bind reached program groups to the original request's tool snapshot through parsed source edits. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import { parse, type Node } from 'yuku-parser';
import { NativeBatchBuildError } from './build-entries.ts';
import { applyNativeSourceEdits, type NativeSourceEdit } from './build-spans.ts';
import { walkNativeSyntax } from './build-syntax.ts';
import { insertOriginalTools, isOriginalHostTools } from './program-runner-shapes.ts';

/** Original class methods retain their parser-owned body and parameter locations. */
type RunnerMethod = Extract<Node, { type: 'MethodDefinition' }>;

/** Build diagnostics remain distinct from runtime execution authority. */
const l = tagged({ tag: 'auto-mode-native-program-runner-source' });

//region Parsed runner methods preserve the original tool snapshot and group handoff

/**
 Select one original runner method with an unchanged binding profile.

 @param members - original runner class members

 @param name - fixed public or private method name

 @returns unique original method

 @throws NativeBatchBuildError when method identity or declaration membership changed
 */
function originalMethod({ members, name }: {
  readonly members: readonly Node[];
  readonly name: string;
}): RunnerMethod {
  const rl = tagged({ tag: originalMethod.name, l });
  rl.debug('selecting original native runner method');
  const methods = members.filter(function matches(node): node is RunnerMethod {
    return (node.type === 'MethodDefinition') && !node.computed && !node.static
      && ((node.key.type === 'Identifier') || (node.key.type === 'PrivateIdentifier'))
      && (node.key.name === name);
  });
  if (methods.length !== 1) throw new NativeBatchBuildError(`Original native runner method is absent or repeated: ${name}`);
  return nonNullishOrThrow(methods[0]);
}

/**
 Add the request snapshot to one original method's destructured parameter.

 @param method - original method with one object parameter

 @param names - original shorthand binding names

 @returns insertion into the original object binding

 @throws NativeBatchBuildError when the original signature changed
 */
function methodTools({ method, names }: {
  readonly method: RunnerMethod;
  readonly names: readonly string[];
}): NativeSourceEdit {
  const rl = tagged({ tag: methodTools.name, l });
  rl.debug('binding request tools to original runner parameters');
  if ((method.kind !== 'method') || method.value.async || method.value.generator
    || (method.value.params.length !== 1)) throw new NativeBatchBuildError('Original native runner signature changed');
  return insertOriginalTools({ node: nonNullishOrThrow(method.value.params[0]), names });
}

/**
 Remove only the original registry-backed tools declarator, preserving neighboring declarations.

 @param declaration - original const declaration containing the tools binding

 @returns parser-owned span for the complete declaration or its selected comma-separated member

 @throws NativeBatchBuildError when registry access or declaration membership changed
 */
function removeRegistryTools(declaration: Extract<Node, { type: 'VariableDeclaration' }>): NativeSourceEdit {
  const rl = tagged({ tag: removeRegistryTools.name, l });
  rl.debug('removing later native registry lookup');
  const index = declaration.declarations.findIndex(function toolsBinding(value) {
    return (value.id.type === 'Identifier') && (value.id.name === 'tools');
  });
  const selected = nonNullishOrThrow(declaration.declarations[index]);
  if ((declaration.kind !== 'const') || (selected.init === null) || !isOriginalHostTools(selected.init))
    throw new NativeBatchBuildError('Original native group tools lookup changed');
  if (declaration.declarations.length === 1) return { start: declaration.start, end: declaration.end, text: '' };
  return index === 0
    ? { start: selected.start, end: nonNullishOrThrow(declaration.declarations[1]).start, text: '' }
    : { start: nonNullishOrThrow(declaration.declarations[index - 1]).end, end: selected.end, text: '' };
}

/**
 Use the original request's executable tools for every reached group without depending on source formatting.

 @param source - qualified original runner module

 @returns generated runner preserving original method bodies outside selected ownership edits

 @throws NativeBatchBuildError when original class, signatures, registry reads, or group handoff changed

 @example
 ```ts
 const generated = programRunnerSource(originalRunner);
 ```
 */
export function programRunnerSource(source: string): string {
  const rl = tagged({ tag: programRunnerSource.name, l });
  rl.debug('preparing parsed original native program runner');
  const parsed = parse(source, { sourceType: 'module', semanticErrors: true });
  if (parsed.diagnostics.length > 0) throw new NativeBatchBuildError('Cannot parse original native program runner');
  const classes = [...walkNativeSyntax(parsed.program)].filter(function originalRunner(node) {
    return (node.type === 'ClassExpression') && (node.id?.name === 'ReachedProgramNestedRunner');
  });
  if (classes.length !== 1) throw new NativeBatchBuildError('Original native program runner class is absent or repeated');
  const declaration = nonNullishOrThrow(classes[0]);
  if (declaration.type !== 'ClassExpression') throw new NativeBatchBuildError('Original native runner is not a class expression');
  const create = originalMethod({ members: declaration.body.body, name: 'createDeclaredProgram' });
  const bind = originalMethod({ members: declaration.body.body, name: 'bindGroup' });
  const edits: NativeSourceEdit[] = [
    methodTools({ method: create, names: ['origin', 'carrier', 'code', 'assertParentCurrent'] }),
    methodTools({ method: bind, names: ['origin', 'carrier', 'group', 'assertParentCurrent'] }),
    { start: create.value.body.start + 1, end: create.value.body.start + 1,
      text: '\nif(!Array.isArray(tools)||!Object.isFrozen(tools))throw new Error("Original request tool snapshot is unavailable");\n' },
  ];
  const reads: Node[] = [];
  const handoffs: Node[] = [];
  for (const node of walkNativeSyntax(create.value.body)) {
    if ((node.type === 'VariableDeclarator') && (node.id.type === 'Identifier')
      && (node.id.name === 'toolNames') && (node.init !== null)) {
      for (const expression of walkNativeSyntax(node.init)) if (isOriginalHostTools(expression)) reads.push(expression);
    }
    if ((node.type === 'CallExpression') && (node.callee.type === 'MemberExpression')
      && !node.callee.computed && !node.callee.optional && (node.callee.object.type === 'ThisExpression')
      && (node.callee.property.type === 'PrivateIdentifier') && (node.callee.property.name === 'bindGroup')) {
      if (node.arguments.length !== 1) throw new NativeBatchBuildError('Original native runner group handoff changed');
      handoffs.push(nonNullishOrThrow(node.arguments[0]));
    }
  }
  if ((reads.length !== 1) || (handoffs.length !== 1))
    throw new NativeBatchBuildError('Original native runner requires one tool-name lookup and one group handoff');
  const read = nonNullishOrThrow(reads[0]);
  edits.push({ start: read.start, end: read.end, text: 'tools' });
  edits.push(insertOriginalTools({ node: nonNullishOrThrow(handoffs[0]), names: ['origin', 'carrier', 'group', 'assertParentCurrent'] }));
  const lookups = [...walkNativeSyntax(bind.value.body)].filter(function toolsDeclaration(node) {
    return (node.type === 'VariableDeclaration') && node.declarations.some(function declaresTools(value) {
      return (value.id.type === 'Identifier') && (value.id.name === 'tools');
    });
  });
  if (lookups.length !== 1) throw new NativeBatchBuildError('Original native runner group lookup is absent or repeated');
  const lookup = nonNullishOrThrow(lookups[0]);
  if (lookup.type !== 'VariableDeclaration') throw new NativeBatchBuildError('Original native group tools lookup is not a declaration');
  edits.push(removeRegistryTools(lookup));
  return applyNativeSourceEdits({ source, edits: edits.toSorted(function sourceOrder(left, right) { return left.start - right.start; }) });
}

//endregion Parsed runner methods preserve the original tool snapshot and group handoff
