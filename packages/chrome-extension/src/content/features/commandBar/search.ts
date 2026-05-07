import type { Command } from './types.js';

/**
 * Score a command against a query.
 *  100 — query is a prefix of label OR slash form
 *   60 — query appears anywhere in label
 *   50 — query is a prefix of any keyword
 *   40 — query appears anywhere in any keyword
 *   20 — fuzzy subsequence match in label
 *    0 — no match
 */
export function scoreCommand(command: Command, query: string): number {
  if (!query) return 0;
  const q = query.toLowerCase().trim();
  if (!q) return 0;

  const label = command.label.toLowerCase();
  const slash = (command.slash ?? '').toLowerCase();
  const keywords = (command.keywords ?? []).map((k) => k.toLowerCase());

  if (label.startsWith(q) || slash.startsWith(q)) return 100;
  if (label.includes(q)) return 60;
  if (keywords.some((k) => k.startsWith(q))) return 50;
  if (keywords.some((k) => k.includes(q))) return 40;
  if (fuzzyMatch(q, label)) return 20;
  return 0;
}

/** True if every char of `q` appears in `target` in order (not necessarily contiguous). */
export function fuzzyMatch(q: string, target: string): boolean {
  let i = 0;
  for (let j = 0; j < target.length && i < q.length; j++) {
    if (target.charCodeAt(j) === q.charCodeAt(i)) i++;
  }
  return i === q.length;
}

/**
 * Rank commands. Empty query → frecency order (usage count desc, stable).
 * Otherwise score each and break ties with a log-scaled usage boost so a
 * frequently-used command sneaks above a fresh one of the same raw score.
 */
export function rankCommands(
  commands: Command[],
  query: string,
  usageCounts: Record<string, number>
): Command[] {
  if (!query) {
    return [...commands].sort((a, b) => {
      const ua = usageCounts[a.id] ?? 0;
      const ub = usageCounts[b.id] ?? 0;
      return ub - ua;
    });
  }

  const scored = commands
    .map((c) => ({ c, base: scoreCommand(c, query) }))
    .filter((x) => x.base > 0);

  scored.sort((a, b) => {
    const sa = a.base + Math.log(1 + (usageCounts[a.c.id] ?? 0)) * 5;
    const sb = b.base + Math.log(1 + (usageCounts[b.c.id] ?? 0)) * 5;
    return sb - sa;
  });

  return scored.map((x) => x.c);
}
