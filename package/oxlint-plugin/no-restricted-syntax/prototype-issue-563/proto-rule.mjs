// PROTOTYPE (issue #563), throwaway: type-free rule that bans implicit array
// conversions and reports provably useless copies. Messages carry a [tag] so
// repo-wide runs can be counted per category.

const FRESH_METHODS = new Set([
  'concat', 'filter', 'flat', 'flatMap', 'map', 'slice', 'splice',
  'toReversed', 'toSorted', 'toSpliced', 'with', 'split',
]);
const HELPERS = new Set(['copyArray', 'numbersOf', 'collect', 'codePointsOf',]);

function calleeName(call) {
  if (call.type !== 'CallExpression') return undefined;
  if (call.callee.type === 'Identifier') return { kind: 'function', name: call.callee.name };
  if (call.callee.type === 'MemberExpression' && !call.callee.computed)
    return { kind: 'method', name: call.callee.property.name };
  return undefined;
}

function spreadKind(argument) {
  const callee = calleeName(argument);
  if (callee?.kind === 'method' && FRESH_METHODS.has(callee.name)) return 'spread-of-ambiguous-method';
  if (argument.type === 'CallExpression') return 'spread-of-other-call';
  return 'spread-of-value';
}

const rule = {
  create(context) {
    return {
      ArrayExpression(node) {
        if (node.elements.length !== 1) return;
        const [only] = node.elements;
        if (only?.type !== 'SpreadElement' || only.argument.type === 'ArrayExpression') return;
        context.report({
          node,
          message: `[${spreadKind(only.argument)}] implicit array conversion; name it: copyArray, numbersOf, collect, codePointsOf, or iterator.toArray()`,
        });
      },
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type === 'MemberExpression' && !callee.computed
          && callee.object.type === 'Identifier' && callee.object.name === 'Array'
          && callee.property.name === 'from'
          && node.arguments[0]?.type !== 'ObjectExpression'
        ) {
          context.report({
            node,
            message: `[array-from${node.arguments.length > 1 ? '-mapped' : ''}] implicit array conversion; name it`,
          });
          return;
        }
        const name = calleeName(node);
        const [argument] = node.arguments;
        if (name?.kind === 'function' && name.name === 'copyArray' && argument) {
          const inner = calleeName(argument);
          if ((inner?.kind === 'method' && FRESH_METHODS.has(inner.name)) || (inner?.kind === 'function' && HELPERS.has(inner.name))) {
            context.report({ node, message: '[useless-copy] copyArray of a fresh array; tsc proved it is an array, drop copyArray' });
          }
        }
        if (name?.kind === 'method' && name.name === 'slice' && node.arguments.length === 0) {
          const inner = calleeName(callee.object);
          if (inner?.kind === 'method' && FRESH_METHODS.has(inner.name)) {
            context.report({ node, message: '[useless-slice] slice() of a fresh value' });
          }
        }
      },
    };
  },
};

export default { meta: { name: 'proto563' }, rules: { 'no-implicit-array-conversion': rule } };
