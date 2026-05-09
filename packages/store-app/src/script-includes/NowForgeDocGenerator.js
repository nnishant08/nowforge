// Script Include: NowForgeDocGenerator
// Application: NowForge (x_nowfg_nowforge)
// Client callable: false
//
// Walks a scope and emits Markdown documentation per artifact (BR, Client
// Script, Script Include, Table, Scripted REST API). Each generated doc is
// stored in x_nowfg_doc_output, versioned, and queryable via REST.

var NowForgeDocGenerator = Class.create();
NowForgeDocGenerator.prototype = {
    initialize: function (scopeName) {
        this.scopeName = scopeName || gs.getCurrentScopeName();
        this.utils = new x_nowfg_nowforge.NowForgeUtils();
    },

    /** Generate everything we know how to document for the current scope. */
    generateAll: function () {
        var docs = []
            .concat(this._generateBusinessRules())
            .concat(this._generateClientScripts())
            .concat(this._generateScriptIncludes())
            .concat(this._generateTables())
            .concat(this._generateRestApis());
        for (var i = 0; i < docs.length; i++) this._save(docs[i]);
        return docs.length;
    },

    /** Generate docs for a single record (used after edits). */
    generateForRecord: function (table, sysId) {
        var gr = new GlideRecord(table);
        if (!gr.get(sysId)) return null;
        var doc = null;
        if (table === 'sys_script')          doc = this._formatBusinessRule(gr);
        else if (table === 'sys_script_client')  doc = this._formatClientScript(gr);
        else if (table === 'sys_script_include') doc = this._formatScriptInclude(gr);
        if (doc) { this._save(doc); return doc; }
        return null;
    },

    // ── Generators ──────────────────────────────────────────────────────

    _generateBusinessRules: function () {
        var out = [];
        var gr = new GlideRecord('sys_script');
        gr.addQuery('sys_scope', this._scopeId());
        gr.query();
        while (gr.next()) out.push(this._formatBusinessRule(gr));
        return out;
    },

    _formatBusinessRule: function (gr) {
        var md = '## Business Rule: ' + gr.getValue('name') + '\n\n';
        md += '- **Table:** `' + gr.getValue('collection') + '`\n';
        md += '- **When:** ' + gr.getValue('when') + ' ' + this._actionFlags(gr) + '\n';
        md += '- **Order:** ' + gr.getValue('order') + '\n';
        md += '- **Active:** ' + (gr.getValue('active') == 'true' ? 'Yes' : 'No') + '\n';
        var cond = gr.getValue('filter_condition');
        if (cond) md += '- **Condition:** `' + cond + '`\n';
        md += '\n### Script\n```javascript\n' + (gr.getValue('script') || '') + '\n```\n';
        var deps = this._findScriptIncludeRefs(gr.getValue('script') || '');
        if (deps.length > 0) {
            md += '\n### Dependencies\n' + deps.map(function (d) { return '- Script Include: `' + d + '`'; }).join('\n') + '\n';
        }
        return {
            doc_type: 'business_rule',
            target_table: 'sys_script',
            target_record: gr.getUniqueValue(),
            target_name: gr.getValue('name'),
            content: md
        };
    },

    _generateClientScripts: function () {
        var out = [];
        var gr = new GlideRecord('sys_script_client');
        gr.addQuery('sys_scope', this._scopeId());
        gr.query();
        while (gr.next()) out.push(this._formatClientScript(gr));
        return out;
    },

    _formatClientScript: function (gr) {
        var md = '## Client Script: ' + gr.getValue('name') + '\n\n';
        md += '- **Table:** `' + gr.getValue('table') + '`\n';
        md += '- **Type:** ' + gr.getValue('type') + '\n';
        if (gr.getValue('field_name')) md += '- **Field:** `' + gr.getValue('field_name') + '`\n';
        md += '- **Active:** ' + (gr.getValue('active') == 'true' ? 'Yes' : 'No') + '\n';
        md += '\n### Script\n```javascript\n' + (gr.getValue('script') || '') + '\n```\n';
        return {
            doc_type: 'client_script',
            target_table: 'sys_script_client',
            target_record: gr.getUniqueValue(),
            target_name: gr.getValue('name'),
            content: md
        };
    },

    _generateScriptIncludes: function () {
        var out = [];
        var gr = new GlideRecord('sys_script_include');
        gr.addQuery('sys_scope', this._scopeId());
        gr.query();
        while (gr.next()) out.push(this._formatScriptInclude(gr));
        return out;
    },

    _formatScriptInclude: function (gr) {
        var md = '## Script Include: ' + gr.getValue('name') + '\n\n';
        md += '- **API name:** `' + gr.getValue('api_name') + '`\n';
        md += '- **Client callable:** ' + (gr.getValue('client_callable') == 'true' ? 'Yes' : 'No') + '\n';
        md += '- **Active:** ' + (gr.getValue('active') == 'true' ? 'Yes' : 'No') + '\n';
        md += '\n### Script\n```javascript\n' + (gr.getValue('script') || '') + '\n```\n';
        return {
            doc_type: 'script_include',
            target_table: 'sys_script_include',
            target_record: gr.getUniqueValue(),
            target_name: gr.getValue('name'),
            content: md
        };
    },

    _generateTables: function () {
        var out = [];
        var gr = new GlideRecord('sys_db_object');
        gr.addQuery('sys_scope', this._scopeId());
        gr.query();
        while (gr.next()) {
            var tableName = gr.getValue('name');
            var md = '## Table: ' + tableName + '\n\n';
            md += '- **Label:** ' + gr.getValue('label') + '\n';
            if (gr.super_class && gr.super_class.name) {
                md += '- **Extends:** `' + gr.super_class.name + '`\n';
            }
            md += '\n### Fields\n\n| Field | Type | Max | Mandatory | Reference |\n|---|---|---|---|---|\n';
            var dict = new GlideRecord('sys_dictionary');
            dict.addQuery('name', tableName);
            dict.orderBy('element');
            dict.query();
            while (dict.next()) {
                if (!dict.getValue('element')) continue;
                md += '| `' + dict.getValue('element') + '` | ' +
                      dict.getValue('internal_type') + ' | ' +
                      (dict.getValue('max_length') || '—') + ' | ' +
                      (dict.getValue('mandatory') == 'true' ? '✔' : '—') + ' | ' +
                      (dict.getValue('reference') || '—') + ' |\n';
            }
            out.push({
                doc_type: 'table_schema',
                target_table: 'sys_db_object',
                target_record: gr.getUniqueValue(),
                target_name: tableName,
                content: md
            });
        }
        return out;
    },

    _generateRestApis: function () {
        var out = [];
        var gr = new GlideRecord('sys_ws_definition');
        gr.addQuery('sys_scope', this._scopeId());
        gr.query();
        while (gr.next()) {
            var md = '## REST API: ' + gr.getValue('name') + '\n\n';
            md += '- **Base path:** `/api/' + gr.getValue('namespace') + '/' + gr.getValue('service_id') + '`\n';
            md += '- **Active:** ' + (gr.getValue('active') == 'true' ? 'Yes' : 'No') + '\n\n';
            md += '### Endpoints\n\n';

            var op = new GlideRecord('sys_ws_operation');
            op.addQuery('web_service_definition', gr.getUniqueValue());
            op.query();
            while (op.next()) {
                md += '#### ' + op.getValue('http_method') + ' ' + op.getValue('relative_path') + '\n\n';
                if (op.getValue('short_description')) md += op.getValue('short_description') + '\n\n';
                md += '```javascript\n' + (op.getValue('operation_script') || '') + '\n```\n\n';
            }

            out.push({
                doc_type: 'rest_api',
                target_table: 'sys_ws_definition',
                target_record: gr.getUniqueValue(),
                target_name: gr.getValue('name'),
                content: md
            });
        }
        return out;
    },

    // ── Helpers ─────────────────────────────────────────────────────────

    _scopeId: function () {
        return this.utils.scopeIdFor(this.scopeName);
    },

    _actionFlags: function (gr) {
        var flags = [];
        if (gr.getValue('action_insert') == 'true') flags.push('insert');
        if (gr.getValue('action_update') == 'true') flags.push('update');
        if (gr.getValue('action_delete') == 'true') flags.push('delete');
        if (gr.getValue('action_query')  == 'true') flags.push('query');
        return flags.length ? '(' + flags.join(', ') + ')' : '';
    },

    _findScriptIncludeRefs: function (script) {
        var refs = [];
        var re = /\bnew\s+([A-Z][\w]*)\s*\(/g, m;
        while ((m = re.exec(script)) !== null) {
            // Crude — anything that looks like `new ClassName(`. Filter common ones out.
            var name = m[1];
            if (['Object', 'Date', 'Array', 'GlideRecord', 'GlideAggregate', 'GlideDateTime', 'GlideQuery', 'RegExp', 'String', 'Error'].indexOf(name) !== -1) continue;
            if (refs.indexOf(name) === -1) refs.push(name);
        }
        return refs;
    },

    _save: function (doc) {
        var existing = new GlideRecord('x_nowfg_doc_output');
        existing.addQuery('target_table', doc.target_table);
        existing.addQuery('target_record', doc.target_record);
        existing.setLimit(1);
        existing.query();
        if (existing.next()) {
            existing.setValue('content', doc.content);
            existing.setValue('generated_at', new GlideDateTime());
            existing.setValue('version', (parseInt(existing.getValue('version'), 10) || 1) + 1);
            existing.update();
            return existing.getUniqueValue();
        }
        var gr = new GlideRecord('x_nowfg_doc_output');
        gr.initialize();
        gr.setValue('doc_type', doc.doc_type);
        gr.setValue('target_table', doc.target_table);
        gr.setValue('target_record', doc.target_record);
        gr.setValue('target_name', doc.target_name);
        gr.setValue('content', doc.content);
        gr.setValue('scope', this._scopeId());
        gr.setValue('generated_at', new GlideDateTime());
        gr.setValue('version', 1);
        return gr.insert();
    },

    type: 'NowForgeDocGenerator'
};
