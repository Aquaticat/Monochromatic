/**
 Qualify original runner syntax before adding request-bound tool snapshots. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type { Node } from 'yuku-parser';
import { NativeBatchBuildError } from './build-entries.ts';
import type { NativeSourceEdit } from './build-spans.ts';

/** Source qualification diagnostics never confer runtime ownership. */
const l = tagged({ tag: 'auto-mode-native-program-runner-shapes' });

//region Original object bindings and host reads define the supported runner shape

/**
 Recognize the original registry read independently of spacing and comments.

 @param node - parsed expression selected within the original runner

 @returns whether the expression invokes this.host.getTools without arguments
 */
export function isOriginalHostTools(node: Node): boolean {
  const rl = tagged({ tag: isOriginalHostTools.name, l });
  rl.debug('qualifying original native registry read');
  if ((node.type !== 'CallExpression') || node.optional || (node.arguments.length !== 0)
    || (node.callee.type !== 'MemberExpression') || node.callee.computed
    || node.callee.optional || (node.callee.property.type !== 'Identifier')
    || (node.callee.property.name !== 'getTools')) return false;
  const receiver = node.callee.object;
  return (receiver.type === 'MemberExpression') && !receiver.computed && !receiver.optional
    && (receiver.object.type === 'ThisExpression') && (receiver.property.type === 'Identifier')
    && (receiver.property.name === 'host');
}

/**
 Add a fixed binding only to the exact original object parameter or argument.

 @param node - original object expression or binding pattern

 @param names - expected original shorthand fields in source order

 @returns insertion preserving original fields and comments

 @throws NativeBatchBuildError when the original parameter or argument shape changed
 */
export function insertOriginalTools({ node, names }: {
  readonly node: Node;
  readonly names: readonly string[];
}): NativeSourceEdit {
  const rl = tagged({ tag: insertOriginalTools.name, l });
  rl.debug('qualifying original native runner object fields');
  if ((node.type !== 'ObjectPattern') && (node.type !== 'ObjectExpression'))
    throw new NativeBatchBuildError('Original native runner requires one object binding or argument');
  if ((node.properties.length !== names.length)
    || node.properties.some(function differs(property, index) {
      return (property.type !== 'Property') || property.computed || !property.shorthand
        || (property.key.type !== 'Identifier') || (property.key.name !== names[index])
        || (property.value.type !== 'Identifier') || (property.value.name !== names[index]);
    })) throw new NativeBatchBuildError('Original native runner object fields changed');
  return { start: node.start + 1, end: node.start + 1, text: 'tools,' };
}

//endregion Original object bindings and host reads define the supported runner shape
