import type { Rule } from 'eslint';
import type * as estree from 'estree';

/**
 * `gs.nil(value)` is the SN-blessed way to check empty/null/undefined.
 * It handles all GlideElement edge cases that bare `== null` doesn't.
 */
const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer gs.nil() over == null / == "" / == undefined comparisons.',
      recommended: true,
    },
    messages: {
      useGsNil: "Use gs.nil({{ name }}) instead of comparing to {{ rhs }}.",
    },
    schema: [],
  },
  create(context) {
    return {
      BinaryExpression(node: estree.BinaryExpression) {
        if (node.operator !== '==' && node.operator !== '===' &&
            node.operator !== '!=' && node.operator !== '!==') {
          return;
        }
        const isEmptyLit = (n: estree.Node): boolean =>
          (n.type === 'Literal' && (n.value === null || n.value === '')) ||
          (n.type === 'Identifier' && n.name === 'undefined');

        let candidateName: string | null = null;
        let rhs = '';
        if (isEmptyLit(node.right) && node.left.type === 'Identifier') {
          candidateName = node.left.name;
          rhs = exprText(node.right);
        } else if (isEmptyLit(node.left) && node.right.type === 'Identifier') {
          candidateName = node.right.name;
          rhs = exprText(node.left);
        }
        if (!candidateName) return;
        context.report({
          node,
          messageId: 'useGsNil',
          data: { name: candidateName, rhs },
        });
      },
    };
  },
};

function exprText(node: estree.Node): string {
  if (node.type === 'Literal') {
    if (node.value === null) return 'null';
    if (node.value === '') return '""';
    return String(node.value);
  }
  if (node.type === 'Identifier') return node.name;
  return 'value';
}

export default rule;
