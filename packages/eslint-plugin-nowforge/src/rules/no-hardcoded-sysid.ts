import type { Rule } from 'eslint';

const SYS_ID_RE = /^[a-f0-9]{32}$/i;

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Warn on hardcoded sys_id literals — fragile and instance-specific.',
      recommended: true,
    },
    messages: {
      hardcoded:
        "Hardcoded sys_id '{{ id }}' will break across instances. Move it to a system property (gs.getProperty) or a reference field.",
    },
    schema: [],
  },
  create(context) {
    return {
      Literal(node) {
        if (typeof node.value !== 'string') return;
        if (!SYS_ID_RE.test(node.value)) return;
        context.report({
          node,
          messageId: 'hardcoded',
          data: { id: node.value.slice(0, 8) + '…' },
        });
      },
    };
  },
};

export default rule;
