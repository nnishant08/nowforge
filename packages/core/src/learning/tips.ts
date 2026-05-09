/**
 * Curated tips database for Learning Mode. Plain TypeScript so consumers
 * can search/filter without parsing JSON at runtime, and so the entries
 * can use string templating for examples.
 *
 * Add entries liberally — the value of this feature is the breadth of
 * coverage. Each entry has tags for fuzzy search and links to the official
 * SN dev docs.
 */

export interface LearningTip {
  id: string;
  question: string;
  answer: string;
  tags: string[];
  links?: string[];
  category: string;
}

export const TIPS: LearningTip[] = [
  // ── Querying ────────────────────────────────────────────────────────────
  {
    id: 'query-records',
    question: 'How do I query records in ServiceNow?',
    category: 'Querying',
    tags: ['gliderecord', 'query', 'server-side', 'beginner'],
    answer:
      'Use GlideRecord on the server:\n\n' +
      "var gr = new GlideRecord('incident');\n" +
      "gr.addQuery('active', true);\n" +
      'gr.setLimit(10);\n' +
      'gr.query();\n' +
      'while (gr.next()) {\n' +
      '  gs.info(gr.number);\n' +
      '}',
    links: ['https://developer.servicenow.com/dev.do#!/reference/api/latest/server/GlideRecord'],
  },
  {
    id: 'glidequery-modern',
    question: 'How is GlideQuery different from GlideRecord?',
    category: 'Querying',
    tags: ['glidequery', 'modern', 'chainable'],
    answer:
      'GlideQuery (Yokohama+) is the modern chainable alternative:\n\n' +
      "new GlideQuery('incident')\n" +
      "  .where('active', true)\n" +
      "  .select('number', 'short_description')\n" +
      '  .limit(10)\n' +
      "  .forEach(function (r) { gs.info(r.number); });",
  },
  {
    id: 'glideaggregate',
    question: 'How do I count records or aggregate data?',
    category: 'Querying',
    tags: ['glideaggregate', 'count', 'sum'],
    answer:
      "Use GlideAggregate:\n\n" +
      "var ga = new GlideAggregate('incident');\n" +
      "ga.addAggregate('COUNT');\n" +
      'ga.query();\n' +
      "if (ga.next()) gs.info('Total: ' + ga.getAggregate('COUNT'));",
  },

  // ── Mutations ───────────────────────────────────────────────────────────
  {
    id: 'create-record',
    question: 'How do I create a record server-side?',
    category: 'Mutations',
    tags: ['gliderecord', 'insert', 'create'],
    answer:
      "var gr = new GlideRecord('incident');\n" +
      'gr.initialize();\n' +
      "gr.short_description = 'Created from script';\n" +
      "gr.priority = 3;\n" +
      'var sysId = gr.insert(); // returns the new sys_id',
  },
  {
    id: 'update-record',
    question: 'How do I update a record?',
    category: 'Mutations',
    tags: ['gliderecord', 'update'],
    answer:
      "var gr = new GlideRecord('incident');\n" +
      "if (gr.get(sysId)) {\n" +
      "  gr.priority = 1;\n" +
      "  gr.update();\n" +
      "}",
  },

  // ── Business Rules ──────────────────────────────────────────────────────
  {
    id: 'br-when-types',
    question: 'When should I use a Before vs After Business Rule?',
    category: 'Business Rules',
    tags: ['business rule', 'before', 'after', 'async'],
    answer:
      '• Before — modify field values that should be saved with the record. Don\'t call current.update().\n' +
      '• After — react to a change after the record is saved (notifications, related-record updates).\n' +
      '• Async — heavy work that doesn\'t need to block the user (event queue is a good alternative).\n' +
      '• Display — set form values when a form is loaded.',
  },
  {
    id: 'br-current-update',
    question: 'Why does current.update() in a Before BR cause a loop?',
    category: 'Business Rules',
    tags: ['business rule', 'before', 'recursion'],
    answer:
      'A Before BR fires *during* a save. Calling current.update() triggers another save, which fires the same BR again. Just modify field values directly — they\'ll commit automatically.',
  },

  // ── Client Scripts ──────────────────────────────────────────────────────
  {
    id: 'cs-no-gliderecord',
    question: 'Why shouldn\'t I use GlideRecord in client scripts?',
    category: 'Client Scripts',
    tags: ['client script', 'glideajax', 'security'],
    answer:
      'Client-side GlideRecord is slow, exposes record data, and is deprecated. Use GlideAjax to call a client-callable Script Include:\n\n' +
      "var ga = new GlideAjax('MyScriptInclude');\n" +
      "ga.addParam('sysparm_name', 'doSomething');\n" +
      'ga.getXMLAnswer(function (answer) { /* use answer */ });',
  },
  {
    id: 'cs-types',
    question: 'What types of Client Scripts are there?',
    category: 'Client Scripts',
    tags: ['client script', 'onload', 'onchange', 'onsubmit'],
    answer:
      '• onLoad — runs when the form opens.\n' +
      '• onChange — runs when a specific field changes (specify field_name).\n' +
      '• onSubmit — runs before save; return false to abort.\n' +
      '• onCellEdit — runs on inline list edit.',
  },

  // ── Script Includes ─────────────────────────────────────────────────────
  {
    id: 'si-basic',
    question: 'How do I write a Script Include?',
    category: 'Script Includes',
    tags: ['script include', 'reusable'],
    answer:
      "var MyHelper = Class.create();\n" +
      'MyHelper.prototype = {\n' +
      "  initialize: function () {},\n" +
      "  greet: function (name) { return 'Hello, ' + name; },\n" +
      "  type: 'MyHelper'\n" +
      '};',
  },
  {
    id: 'si-client-callable',
    question: 'How do I make a Script Include callable from a client script?',
    category: 'Script Includes',
    tags: ['script include', 'glideajax', 'AbstractAjaxProcessor'],
    answer:
      "var MyAjax = Class.create();\n" +
      "MyAjax.prototype = Object.extendsObject(AbstractAjaxProcessor, {\n" +
      "  doSomething: function () {\n" +
      "    var name = this.getParameter('sysparm_name');\n" +
      "    return 'Hello, ' + name;\n" +
      "  },\n" +
      "  type: 'MyAjax'\n" +
      "});\n" +
      '\n' +
      'Set "Client callable" = true on the Script Include record.',
  },

  // ── REST ────────────────────────────────────────────────────────────────
  {
    id: 'rest-outbound',
    question: 'How do I call an external REST API from ServiceNow?',
    category: 'REST',
    tags: ['rest', 'restmessagev2', 'integration'],
    answer:
      'try {\n' +
      '  var r = new sn_ws.RESTMessageV2();\n' +
      "  r.setHttpMethod('GET');\n" +
      "  r.setEndpoint('https://api.example.com/x');\n" +
      "  r.setRequestHeader('Accept', 'application/json');\n" +
      '  var resp = r.execute();\n' +
      "  gs.info('Status: ' + resp.getStatusCode());\n" +
      '  gs.info(resp.getBody());\n' +
      "} catch (e) { gs.error('REST failed: ' + e.message); }",
  },
  {
    id: 'rest-scripted',
    question: 'How do I expose a Scripted REST API?',
    category: 'REST',
    tags: ['scripted rest', 'sys_ws_operation'],
    answer:
      "Inside a Scripted REST Resource script:\n\n" +
      "(function (request, response) {\n" +
      "  var body = request.body.data;\n" +
      "  // do something with body\n" +
      "  response.setStatus(201);\n" +
      "  response.setBody({ ok: true });\n" +
      "})(request, response);",
  },

  // ── Best Practices ──────────────────────────────────────────────────────
  {
    id: 'best-gs-nil',
    question: 'How do I correctly check for empty/null values?',
    category: 'Best Practices',
    tags: ['gs.nil', 'null', 'empty'],
    answer:
      'Use gs.nil() — it handles all SN edge cases (Java null vs JS null, empty strings, GlideElement nil):\n\n' +
      "if (gs.nil(gr.assigned_to)) {\n" +
      "  gs.info('Unassigned');\n" +
      "}",
  },
  {
    id: 'best-setlimit',
    question: 'When should I use setLimit()?',
    category: 'Best Practices',
    tags: ['setlimit', 'performance'],
    answer:
      'Always when checking existence:\n\n' +
      "var gr = new GlideRecord('incident');\n" +
      "gr.addQuery('number', 'INC0010001');\n" +
      'gr.setLimit(1); // tells SQL we only want 1 row\n' +
      'gr.query();\n' +
      "if (gr.next()) gs.info('Found');",
  },
  {
    id: 'best-no-hardcoded-sysid',
    question: 'Why shouldn\'t I hardcode sys_ids?',
    category: 'Best Practices',
    tags: ['sys_id', 'system properties'],
    answer:
      'sys_ids differ between instances. Hardcoded ones break in test/prod. Use a system property or look the record up by name:\n\n' +
      "var groupName = gs.getProperty('x_my_app.default_group');\n" +
      "var gr = new GlideRecord('sys_user_group');\n" +
      "if (gr.get('name', groupName)) gs.info(gr.sys_id.toString());",
  },

  // ── Update Sets ─────────────────────────────────────────────────────────
  {
    id: 'updateset-default',
    question: 'Why shouldn\'t I work in the Default update set?',
    category: 'Update Sets',
    tags: ['update set', 'deployment'],
    answer:
      'Changes in Default aren\'t bundled — they leak into other developers\' captures, can\'t be promoted cleanly, and are a nightmare to undo. Always create a named update set before making changes.',
  },
];

/** Default Learning Mode setting. */
export const LEARNING_MODE_DEFAULT = true;
