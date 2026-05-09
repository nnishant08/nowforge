import { TIPS, type LearningTip } from './tips.js';

/**
 * Fuzzy/keyword search over the tips database. Returns the top matches
 * scored by tag/keyword overlap. The Command Bar uses this for the
 * "How do I..." command.
 */

export function searchTips(query: string, limit = 5): LearningTip[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const tokens = q.split(/\s+/).filter(Boolean);

  const scored = TIPS.map((tip) => {
    const haystack = (
      tip.question + ' ' +
      tip.answer + ' ' +
      tip.tags.join(' ') + ' ' +
      tip.category
    ).toLowerCase();

    let score = 0;
    for (const t of tokens) {
      if (tip.question.toLowerCase().includes(t)) score += 10;
      if (tip.tags.some((tag) => tag === t)) score += 8;
      if (tip.tags.some((tag) => tag.includes(t))) score += 4;
      if (haystack.includes(t)) score += 2;
    }
    return { tip, score };
  });

  return scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.tip);
}
