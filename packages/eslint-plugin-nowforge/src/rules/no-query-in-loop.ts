import type { Rule } from 'eslint';
import { isMethodCall, isInsideLoop } from '../util.js';

/**
 * Catch `gr.query()` calls inside a loop body. This is almost always a
 * performance bug — the user is re-querying the database for every iteration
 * when they could have hoisted the query.
 */
const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow GlideRecord.query() inside a loop — major performance issue.',
      recommended: true,
    },
    messages: {
      queryInLoop:
        'GlideRecord.query() inside a loop runs N database round-trips. Hoist the query above the loop, or restructure the logic.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isMethodCall(node, 'query')) return;
        if (!isInsideLoop(node as Rule.Node)) return;
        context.report({ node, messageId: 'queryInLoop' });
      },
    };
  },
};

export default rule;
