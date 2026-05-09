import { useEffect, useRef } from 'react';
import CodeMirror, { type ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { autocompletion } from '@codemirror/autocomplete';
import { githubLight, githubDark } from '@uiw/codemirror-theme-github';
import { hoverTooltip, EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, indentWithTab, history, historyKeymap } from '@codemirror/commands';
import { snowCompletions, findMethod, findTopLevel } from './completions.js';

export interface EditorProps {
  value: string;
  onChange: (next: string) => void;
  onCmdEnter: () => void;
  height: number;
}

// ── Hover tooltip provider ─────────────────────────────────────────────────
// On hover, find the token under the cursor. If it looks like `<ID>.<method>`
// or just an `<ID>` we recognise, render a small popup with the signature
// and JSDoc. This is the single biggest UX gap with VS Code/Monaco — fixing
// it makes CodeMirror feel professional.

const snowHover = hoverTooltip((view, pos) => {
  const text = view.state.doc.toString();

  // Find the word under the cursor
  let start = pos;
  let end = pos;
  while (start > 0 && /[\w$]/.test(text[start - 1] ?? '')) start--;
  while (end < text.length && /[\w$]/.test(text[end] ?? '')) end++;
  if (start === end) return null;
  const word = text.slice(start, end);

  // Check for `<base>.<word>` pattern: walk left from start past a possible "."
  // and another word.
  let base: string | null = null;
  if (start >= 2 && text[start - 1] === '.') {
    const baseEnd = start - 1;
    let baseStart = baseEnd;
    while (baseStart > 0 && /[\w$]/.test(text[baseStart - 1] ?? '')) baseStart--;
    base = text.slice(baseStart, baseEnd);
  }

  let title: string;
  let body: string;
  let detail: string | null = null;

  if (base) {
    const spec = findMethod(base, word);
    if (!spec) return null;
    title = `${base}.${spec.name}${spec.signature}`;
    body = spec.doc;
  } else {
    const top = findTopLevel(word);
    if (!top) return null;
    title = word;
    detail = top.kind;
    body = top.doc;
  }

  return {
    pos: start,
    end,
    above: true,
    create() {
      const dom = document.createElement('div');
      dom.className = 'sr-hover';

      const titleEl = document.createElement('div');
      titleEl.className = 'sr-hover__title';
      titleEl.textContent = title;
      dom.appendChild(titleEl);

      if (detail) {
        const detailEl = document.createElement('div');
        detailEl.className = 'sr-hover__detail';
        detailEl.textContent = detail;
        dom.appendChild(detailEl);
      }

      const bodyEl = document.createElement('div');
      bodyEl.className = 'sr-hover__body';
      bodyEl.textContent = body;
      dom.appendChild(bodyEl);

      return { dom };
    },
  };
}, { hideOnChange: true, hoverTime: 250 });

// ── Editor ─────────────────────────────────────────────────────────────────

export function Editor({ value, onChange, onCmdEnter, height }: EditorProps) {
  const ref = useRef<ReactCodeMirrorRef>(null);

  const isDark = typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-color-scheme: dark)').matches;

  useEffect(() => {
    const view = ref.current?.view;
    if (!view) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        onCmdEnter();
      }
    };

    view.dom.addEventListener('keydown', onKeyDown);
    return () => view.dom.removeEventListener('keydown', onKeyDown);
  }, [onCmdEnter]);

  return (
    <CodeMirror
      ref={ref}
      value={value}
      height={`${height}px`}
      theme={isDark ? githubDark : githubLight}
      extensions={[
        javascript({ jsx: false, typescript: false }),
        autocompletion({ override: [snowCompletions], closeOnBlur: false, defaultKeymap: true }),
        snowHover,
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.lineWrapping,
      ]}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: true,
        indentOnInput: true,
        tabSize: 4,
        // We're providing keymap + history ourselves, disable the basic set's
        // versions to avoid duplication.
        defaultKeymap: false,
        history: false,
      }}
      onChange={onChange}
      style={{
        fontSize: 13,
        fontFamily: "'Fira Code', 'Cascadia Code', SF Mono, Menlo, monospace",
      }}
    />
  );
}
