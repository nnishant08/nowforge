import type { BuiltInSnippet } from './types.js';

export const BUILT_IN_SNIPPETS: BuiltInSnippet[] = [
  {
    name: 'Query active incidents',
    description: 'Print the first 10 active incidents (number + short description)',
    script: `var gr = new GlideRecord('incident');
gr.addActiveQuery();
gr.setLimit(10);
gr.query();
while (gr.next()) {
  gs.print(gr.number + ' - ' + gr.short_description);
}
`,
  },
  {
    name: 'Get current user info',
    description: 'Display the current session user, ID, and roles',
    script: `var user = gs.getUser();
gs.print('Name: ' + user.getFullName());
gs.print('ID: ' + user.getID());
gs.print('Roles: ' + user.getRoles());
`,
  },
  {
    name: 'Count records by table',
    description: 'Use GlideAggregate to count rows in a table',
    script: `var ga = new GlideAggregate('incident');
ga.addAggregate('COUNT');
ga.query();
if (ga.next()) {
  gs.print('Total incidents: ' + ga.getAggregate('COUNT'));
}
`,
  },
  {
    name: 'Find duplicate short descriptions',
    description: 'Detect duplicate incident short_description values',
    script: `var gr = new GlideRecord('incident');
gr.addEncodedQuery('short_descriptionISNOTEMPTY');
gr.query();
var seen = {};
while (gr.next()) {
  var key = gr.short_description.toString();
  if (seen[key]) gs.print('Duplicate: ' + gr.number + ' (' + key + ')');
  seen[key] = true;
}
`,
  },
  {
    name: 'List system properties',
    description: 'Print all system properties matching a name pattern',
    script: `var gr = new GlideRecord('sys_properties');
gr.addQuery('name', 'STARTSWITH', 'glide.ui');
gr.setLimit(20);
gr.query();
while (gr.next()) {
  gs.print(gr.name + ' = ' + gr.value);
}
`,
  },
];
