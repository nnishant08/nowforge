/**
 * Capture and track field values on a SN form.
 *
 * Strategy: read all visible form-field inputs at "settled" time (initial
 * load + 1s delay so business rules finish running), and compare against
 * current values on every change/input event from the form's container.
 */

export type FormInputEl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

export interface CapturedField {
  name: string;
  /** Display label, e.g. "Assigned to". */
  label: string;
  /** The original value at capture time. */
  originalValue: string;
  /** The original display value (best-effort). */
  originalDisplay: string;
}

export interface FieldChange {
  name: string;
  label: string;
  oldValue: string;
  oldDisplay: string;
  newValue: string;
  newDisplay: string;
  /** True if this is a journal field (work_notes, comments) — we treat these specially. */
  isJournal: boolean;
}

/** Field names we never want to track (auto-updated by the platform). */
const SKIP_FIELDS = new Set([
  'sys_updated_on', 'sys_updated_by', 'sys_created_on', 'sys_created_by',
  'sys_mod_count', 'sys_id', 'sys_class_name', 'sys_domain', 'sys_domain_path',
  'sys_tags', 'sys_overrides',
]);

/** Field names that are append-only journals — comparison is "did the user type". */
const JOURNAL_FIELDS = new Set(['work_notes', 'comments', 'comments_and_work_notes', 'additional_comments']);

/** Strip the "<table>." prefix off a SN field input's name attribute. */
function stripTablePrefix(name: string): string {
  return name.replace(/^[a-z_][a-z0-9_]*\./, '');
}

function isFormFieldInput(el: Element): boolean {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) {
    return false;
  }
  const name = el.getAttribute('name') ?? '';
  if (!name) return false;
  if (name.startsWith('sys_display.')) return false;
  if (name.startsWith('sys_select.')) return false;
  if (name.startsWith('sys_original.')) return false;
  if (el.id?.startsWith('IO:')) return false;
  if (el instanceof HTMLInputElement) {
    if (el.type === 'hidden' && !el.classList.contains('cat_item_option')) return false;
    if (el.type === 'button' || el.type === 'submit' || el.type === 'reset') return false;
  }
  const cleaned = stripTablePrefix(name);
  if (!/^[a-z_][a-z0-9_]*$/i.test(cleaned)) return false;
  if (SKIP_FIELDS.has(cleaned)) return false;
  return true;
}

/** Find the form root that holds the record's fields. */
function findFormRoot(): HTMLElement | null {
  return (
    document.getElementById('main_form') ??
    document.querySelector<HTMLElement>('form#sys_form') ??
    document.querySelector<HTMLElement>('form[name*="form" i]') ??
    null
  );
}

/** Find a label for the given field input, best-effort. */
function findFieldLabel(input: FormInputEl): string {
  const id = input.id;
  if (id) {
    const lbl = document.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(id)}"]`);
    if (lbl?.textContent?.trim()) return lbl.textContent.trim();
  }
  // Walk up to the row and look for a .label-text span
  const row = input.closest('tr');
  if (row) {
    const span = row.querySelector('.label-text, .label_text');
    if (span?.textContent?.trim()) return span.textContent.trim();
  }
  // Fall back to the cleaned field name
  return stripTablePrefix(input.getAttribute('name') ?? '');
}

/** Read the corresponding sys_display.<name> field's value if it exists (for references). */
function readDisplayValue(input: FormInputEl): string {
  const name = input.getAttribute('name') ?? '';
  const cleaned = stripTablePrefix(name);
  // Try sys_display.<table>.<field> first, then plain sys_display.<field>
  const tableMatch = name.match(/^([a-z_][a-z0-9_]*)\./);
  const candidates = tableMatch
    ? [`sys_display.${tableMatch[1]}.${cleaned}`, `sys_display.${cleaned}`]
    : [`sys_display.${cleaned}`];
  for (const sel of candidates) {
    const el = document.querySelector<HTMLInputElement>(`[name="${CSS.escape(sel)}"]`);
    if (el?.value) return el.value;
  }
  return input.value;
}

/** Capture all current field values. */
export function captureFields(): Map<string, CapturedField> {
  const root = findFormRoot();
  if (!root) return new Map();

  const captured = new Map<string, CapturedField>();
  const inputs = Array.from(root.querySelectorAll<FormInputEl>('input, select, textarea'));
  for (const input of inputs) {
    if (!isFormFieldInput(input)) continue;
    const fullName = input.getAttribute('name')!;
    const cleaned = stripTablePrefix(fullName);
    if (captured.has(cleaned)) continue; // first occurrence wins
    captured.set(cleaned, {
      name: cleaned,
      label: findFieldLabel(input),
      originalValue: input.value,
      originalDisplay: readDisplayValue(input),
    });
  }
  return captured;
}

/** Compare current field values to captured originals and return all changes. */
export function diffAgainst(captured: Map<string, CapturedField>): FieldChange[] {
  const root = findFormRoot();
  if (!root || captured.size === 0) return [];

  const seen = new Set<string>();
  const changes: FieldChange[] = [];
  const inputs = Array.from(root.querySelectorAll<FormInputEl>('input, select, textarea'));

  for (const input of inputs) {
    if (!isFormFieldInput(input)) continue;
    const fullName = input.getAttribute('name')!;
    const cleaned = stripTablePrefix(fullName);
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);

    const orig = captured.get(cleaned);
    if (!orig) continue;

    const isJournal = JOURNAL_FIELDS.has(cleaned);
    const newValue = input.value;

    if (isJournal) {
      // Journal fields are append-only — anything non-empty is a "change"
      if (newValue.trim().length > 0) {
        changes.push({
          name: cleaned,
          label: orig.label,
          oldValue: '',
          oldDisplay: '',
          newValue,
          newDisplay: newValue,
          isJournal: true,
        });
      }
      continue;
    }

    if (newValue !== orig.originalValue) {
      changes.push({
        name: cleaned,
        label: orig.label,
        oldValue: orig.originalValue,
        oldDisplay: orig.originalDisplay || orig.originalValue,
        newValue,
        newDisplay: readDisplayValue(input) || newValue,
        isJournal: false,
      });
    }
  }
  return changes;
}

/** Set a field's value back to the captured original and dispatch change events. */
export function revertField(name: string, originalValue: string): boolean {
  const root = findFormRoot();
  if (!root) return false;
  const input = root.querySelector<FormInputEl>(`[name$=".${CSS.escape(name)}"], [name="${CSS.escape(name)}"]`);
  if (!input) return false;
  input.value = originalValue;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

/** Walks form root checks — exported so the indicator can know "is this a record form?" */
export function isRecordForm(): boolean {
  return findFormRoot() !== null;
}
