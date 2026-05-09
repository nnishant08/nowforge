/**
 * Plugin format. A single JSON document containing community-contributed
 * commands, quality rules, snippets, AI prompts, pipeline templates, and
 * Learning Mode tips. Each `contents` slot is optional; plugins may ship
 * any subset.
 */

export interface PluginAuthor {
  name: string;
  email?: string;
  url?: string;
}

export interface PluginCommandAction {
  /** Either navigate the active SN tab or run a snippet via the script runner. */
  type: 'navigate' | 'runScript';
  url?: string;
  script?: string;
}

export interface PluginCommand {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  /** Slash form, e.g. "/hrsd-cases". */
  slash?: string;
  keywords?: string[];
  action: PluginCommandAction;
}

export interface PluginQualityRule {
  ruleId: string;
  description: string;
  severity: 'error' | 'warning' | 'info';
  category: 'performance' | 'security' | 'upgradeability' | 'best-practice';
  /** A regex source (compiled with case-insensitive 'gi') that flags matches. */
  pattern: string;
  message: string;
}

export interface PluginSnippet {
  name: string;
  description: string;
  script: string;
  language?: string;
  category?: string;
}

export interface PluginAiPrompt {
  id: string;
  label: string;
  /** User-prompt template; ${script} and ${description} are substituted at runtime. */
  template: string;
}

export interface PluginPipelineTemplate {
  name: string;
  stages: Array<{
    name: string;
    instanceUrl: string;
    checks: Array<'scan' | 'lint' | 'atf' | 'diff'>;
    autoPromote: boolean;
  }>;
}

export interface PluginTip {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags?: string[];
}

export interface Plugin {
  /** Reverse-DNS-style id, e.g. "com.author.plugin-name". */
  id: string;
  name: string;
  version: string;
  author: PluginAuthor;
  description?: string;
  category: 'commands' | 'rules' | 'snippets' | 'ai' | 'pipelines' | 'tips' | 'mixed';
  tags?: string[];
  license?: string;
  /** Min compatible NowForge version. */
  minNowForgeVersion?: string;
  contents: {
    commands?: PluginCommand[];
    qualityRules?: PluginQualityRule[];
    snippets?: PluginSnippet[];
    aiPrompts?: PluginAiPrompt[];
    pipelineTemplates?: PluginPipelineTemplate[];
    tips?: PluginTip[];
  };
}

/** Result of validating a plugin JSON blob. */
export interface PluginValidationResult {
  ok: boolean;
  errors: string[];
}
