/**
 * Minimal line-based diff. Implements the LCS-classic dynamic-programming
 * approach. Output is a list of operations the UI can render side-by-side.
 *
 * Why not the `diff` npm package: this is ~50 lines of pure ES, zero deps,
 * and the line-level granularity is what we want for SN scripts.
 */

export type DiffOpKind = 'equal' | 'add' | 'remove' | 'change';

export interface DiffOp {
  kind: DiffOpKind;
  /** Lines from the "left" / "before" / instance A side. May be empty for `add`. */
  leftLines: string[];
  /** Lines from the "right" / "after" / instance B side. May be empty for `remove`. */
  rightLines: string[];
}

export function diffLines(a: string, b: string): DiffOp[] {
  const left = a.split('\n');
  const right = b.split('\n');

  // LCS table
  const m = left.length;
  const n = right.length;
  const lcs: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (left[i] === right[j]) lcs[i + 1][j + 1] = lcs[i][j] + 1;
      else lcs[i + 1][j + 1] = Math.max(lcs[i][j + 1], lcs[i + 1][j]);
    }
  }

  // Walk back to produce ops
  const ops: DiffOp[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (left[i - 1] === right[j - 1]) {
      pushOp(ops, { kind: 'equal', leftLines: [left[i - 1]], rightLines: [right[j - 1]] });
      i--; j--;
    } else if (lcs[i - 1][j] >= lcs[i][j - 1]) {
      pushOp(ops, { kind: 'remove', leftLines: [left[i - 1]], rightLines: [] });
      i--;
    } else {
      pushOp(ops, { kind: 'add', leftLines: [], rightLines: [right[j - 1]] });
      j--;
    }
  }
  while (i > 0) { pushOp(ops, { kind: 'remove', leftLines: [left[i - 1]], rightLines: [] }); i--; }
  while (j > 0) { pushOp(ops, { kind: 'add',    leftLines: [],            rightLines: [right[j - 1]] }); j--; }
  ops.reverse();
  return mergeAdjacent(ops);
}

function pushOp(ops: DiffOp[], op: DiffOp): void {
  ops.push(op);
}

/** Merge consecutive ops of the same kind so the UI shows fewer chunks. */
function mergeAdjacent(ops: DiffOp[]): DiffOp[] {
  if (ops.length === 0) return ops;
  const out: DiffOp[] = [{ ...ops[0] }];
  for (let k = 1; k < ops.length; k++) {
    const prev = out[out.length - 1];
    const cur = ops[k];
    if (prev.kind === cur.kind) {
      prev.leftLines = prev.leftLines.concat(cur.leftLines);
      prev.rightLines = prev.rightLines.concat(cur.rightLines);
    } else if ((prev.kind === 'remove' && cur.kind === 'add') ||
               (prev.kind === 'add' && cur.kind === 'remove')) {
      // Promote a remove+add pair into a single change op
      prev.kind = 'change';
      prev.leftLines = prev.leftLines.concat(cur.leftLines);
      prev.rightLines = prev.rightLines.concat(cur.rightLines);
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

/** Quick equality check before paying for full diff. */
export function quickEqual(a: string, b: string): boolean {
  return a === b;
}
