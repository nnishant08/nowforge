import type { Rule } from 'eslint';

/**
 * Calling `current.update()` inside a Before business rule causes infinite
 * recursion (the BR fires on its own update). The platform never wants you
 * to do this.
 *
 * We detect by file content / file name: a sys_script-derived file that has
 * `when` set to "before". Since we can't read SN metadata, we trigger when
 * the file's path or name suggests a Business Rule.
 */
const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow current.update() in Before business rules — causes infinite loops.',
      recommended: true,
      url: 'https://docs.servicenow.com/business-rule-recursion',
    },
    messages: {
      noUpdate:
        'Do not call current.update() in a Before business rule — it triggers another BR run, leading to infinite recursion. Just modify field values; the BR commits them automatically.',
    },
    schema: [],
  },
  create(context) {
    return {
      'CallExpression[callee.object.name="current"][callee.property.name="update"]'(
        node: Rule.Node
      ) {
        context.report({ node, messageId: 'noUpdate' });
      },
    };
  },
};

export default rule;
