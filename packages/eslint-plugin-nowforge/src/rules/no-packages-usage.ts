import type { Rule } from 'eslint';

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow Packages.* — deprecated and breaks in scoped applications.',
      recommended: true,
    },
    messages: {
      noPackages:
        'Packages.* and direct Java class references are deprecated. They run only in global scope and are blocked in scoped apps.',
    },
    schema: [],
  },
  create(context) {
    function check(node: Rule.Node): void {
      if (
        (node.type === 'MemberExpression' || node.type === 'Identifier') &&
        getRootName(node) === 'Packages'
      ) {
        context.report({ node, messageId: 'noPackages' });
      }
    }

    function getRootName(node: Rule.Node): string | null {
      let cur: Rule.Node | null = node;
      while (cur && cur.type === 'MemberExpression') {
        cur = cur.object as Rule.Node;
      }
      return cur && cur.type === 'Identifier' ? cur.name : null;
    }

    return {
      MemberExpression(node) { check(node as Rule.Node); },
    };
  },
};

export default rule;
