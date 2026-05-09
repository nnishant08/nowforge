/** Generate a starter GlideRecord query template for a given table. */
export function generateGlideRecordTemplate(table: string): string {
  return `var gr = new GlideRecord('${table}');
gr.addQuery('active', true);
gr.setLimit(10);
gr.query();
while (gr.next()) {
  gs.print(gr.getValue('number') + ' - ' + gr.getValue('short_description'));
}
`;
}
