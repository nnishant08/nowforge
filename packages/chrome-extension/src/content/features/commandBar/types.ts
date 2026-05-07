import type { PageContext } from '../../../shared/messaging.js';

export type CommandCategory = 'navigation' | 'action' | 'search';

export interface ExecuteOptions {
  /** Cmd/Ctrl+Enter — open in a new tab where applicable. */
  newTab: boolean;
  /** The full input string the user typed (for parametric commands). */
  query: string;
}

export interface Command {
  id: string;
  label: string;
  description?: string;
  category: CommandCategory;
  /** Single emoji, rendered before the label. */
  icon: string;
  /** Slash form like `/inc`. Counts as a primary alias for matching. */
  slash?: string;
  /** Extra search aliases. */
  keywords?: string[];
  /** Right-aligned hint, e.g. "↵" or "⌘↵". Not a binding — just display. */
  shortcut?: string;
  /** Hide commands that don't apply to the current page (e.g. Copy sys_id off-form). */
  isAvailable?: (ctx: PageContext) => boolean;
  execute: (ctx: PageContext, opts: ExecuteOptions) => void | Promise<void>;
}
