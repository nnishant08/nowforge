import type { Rule } from 'eslint';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow GlideAjax.getXMLWait() — blocks the browser UI thread.',
      recommended: true,
    },
    messages: {
      noSync: 'getXMLWait() is synchronous and blocks the UI. Use getXMLAnswer(callback) instead.',
    },
    schema: [],
  },
  create(context) {
    return {
      'CallExpression[callee.property.name="getXMLWait"]'(node: Rule.Node) {
        context.report({ node, messageId: 'noSync' });
      },
    };
  },
};

export default rule;
