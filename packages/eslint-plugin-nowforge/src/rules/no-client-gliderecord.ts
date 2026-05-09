import type { Rule } from 'eslint';

/**
 * Heuristic: a file is a "client" file if its path or filename suggests
 * client-side execution (sys_script_client folder, "client.js" basename, or
 * anything containing "client_script").
 */
const CLIENT_PATH_RE = /(client[ _-]?script|sys_script_client|client\.js$|service.?portal|widget)/i;

const rule: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow new GlideRecord in client-side code — use GlideAjax instead.',
      recommended: true,
    },
    messages: {
      noClientGlide:
        'GlideRecord on the client is deprecated, slow, and exposes data unnecessarily. Use GlideAjax to call a Script Include that wraps the GlideRecord on the server.',
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    if (!filename || !CLIENT_PATH_RE.test(filename)) return {};
    return {
      'NewExpression[callee.name="GlideRecord"]'(node: Rule.Node) {
        context.report({ node, messageId: 'noClientGlide' });
      },
    };
  },
};

export default rule;
