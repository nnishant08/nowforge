import type { Rule } from 'eslint';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow eval() and new Function() — security and upgradeability risk.',
      recommended: true,
    },
    messages: {
      noEval:
        'Avoid {{ which }}: it bypasses security review and is rejected by SN code scanners. Use a different approach.',
    },
    schema: [],
  },
  create(context) {
    return {
      'CallExpression[callee.name="eval"]'(node: Rule.Node) {
        context.report({ node, messageId: 'noEval', data: { which: 'eval()' } });
      },
      'NewExpression[callee.name="Function"]'(node: Rule.Node) {
        context.report({ node, messageId: 'noEval', data: { which: 'new Function()' } });
      },
    };
  },
};

export default rule;
