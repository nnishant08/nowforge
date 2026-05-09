/**
 * Shared AST predicates used across multiple rules. Keep these terse — each
 * rule file should still feel self-contained but lean on these for the
 * common "is this a GlideRecord call?" / "what method?" patterns.
 */
import type { Rule } from 'eslint';
import type * as estree from 'estree';

/** True if the node is `<Identifier>(...)` with a matching name. */
export function isCallTo(node: estree.Node, name: string): node is estree.CallExpression {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === name
  );
}

/** True if the node is `<obj>.<method>(...)` with the given method name. */
export function isMethodCall(node: estree.Node, method: string): node is estree.CallExpression {
  return (
    node.type === 'CallExpression' &&
    node.callee.type === 'MemberExpression' &&
    node.callee.property.type === 'Identifier' &&
    node.callee.property.name === method
  );
}

/** True if the node is `new GlideRecord(...)` etc. */
export function isNewOf(node: estree.Node, className: string): node is estree.NewExpression {
  return (
    node.type === 'NewExpression' &&
    node.callee.type === 'Identifier' &&
    node.callee.name === className
  );
}

/** Static-string argument value, or null if not a static string. */
export function staticStringArg(call: estree.CallExpression, index: number): string | null {
  const arg = call.arguments[index];
  if (arg && arg.type === 'Literal' && typeof arg.value === 'string') return arg.value;
  return null;
}

/** A small helper to get `context.getSourceCode().getText(node)` for messages. */
export function nodeText(context: Rule.RuleContext, node: estree.Node): string {
  try { return context.sourceCode.getText(node); } catch { return ''; }
}

/** Walk up parents until predicate returns true or we run out. */
export function findAncestor(
  node: Rule.Node,
  pred: (n: Rule.Node) => boolean
): Rule.Node | null {
  let cur: Rule.Node | null = (node as { parent?: Rule.Node }).parent ?? null;
  while (cur) {
    if (pred(cur)) return cur;
    cur = (cur as { parent?: Rule.Node }).parent ?? null;
  }
  return null;
}

/** True if the node is inside a `for | while | do-while` body. */
export function isInsideLoop(node: Rule.Node): boolean {
  return findAncestor(node, (n) =>
    n.type === 'ForStatement' ||
    n.type === 'ForInStatement' ||
    n.type === 'ForOfStatement' ||
    n.type === 'WhileStatement' ||
    n.type === 'DoWhileStatement'
  ) !== null;
}
