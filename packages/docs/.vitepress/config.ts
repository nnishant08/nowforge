import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'NowForge',
  description: 'The complete developer toolkit for ServiceNow.',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'Home', link: 'https://nowforge.dev' },
      { text: 'Features', link: '/features/instance-identity' },
      { text: 'GitHub', link: 'https://github.com/nnishant08/nowforge' },
    ],
    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Install', link: '/getting-started/install' },
          { text: 'First steps', link: '/getting-started/first-steps' },
        ],
      },
      {
        text: 'Browser Extension',
        items: [
          { text: 'Instance Identity', link: '/features/instance-identity' },
          { text: 'Command Bar', link: '/features/command-bar' },
          { text: 'Field Intelligence', link: '/features/field-intelligence' },
          { text: 'Script Runner', link: '/features/script-runner' },
          { text: 'Update Set Dashboard', link: '/features/update-sets' },
          { text: 'Smart Navigation', link: '/features/navigation' },
          { text: 'UI Builder Companion', link: '/features/uib-companion' },
          { text: 'Flow Designer Inspector', link: '/features/flow-inspector' },
          { text: 'Script Quick Actions', link: '/features/script-actions' },
          { text: 'Change Indicator', link: '/features/change-indicator' },
        ],
      },
      {
        text: 'Pro Features',
        items: [
          { text: 'VS Code Extension', link: '/pro/vscode' },
          { text: 'AI Assistant', link: '/pro/ai' },
          { text: 'Instance Diff', link: '/pro/diff' },
          { text: 'Quality Scanner', link: '/pro/scanner' },
          { text: 'MCP Server', link: '/pro/mcp' },
        ],
      },
      {
        text: 'Team & Enterprise',
        items: [
          { text: 'Team Sync', link: '/team/sync' },
          { text: 'Plugin Marketplace', link: '/team/plugins' },
          { text: 'On-Instance App', link: '/enterprise/store-app' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Plugin Format', link: '/reference/plugin-format' },
          { text: 'REST API', link: '/reference/rest-api' },
          { text: 'Changelog', link: '/reference/changelog' },
        ],
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/nnishant08/nowforge' },
    ],
    footer: {
      message: 'Independent and not affiliated with ServiceNow, Inc.',
      copyright: 'MIT-licensed core',
    },
  },
});
