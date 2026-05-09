// Script Include: NowForgeQualityScanner
// Application: NowForge (x_nowfg_nowforge)
// Client callable: false
//
// Server-side scanner. Walks through scripts in a scope or update set,
// runs every active rule from x_nowfg_quality_rule, persists findings
// to x_nowfg_scan_result, and rolls up a score into x_nowfg_quality_scan.
//
// Each rule's `check_script` is a function that takes (scriptContent, context)
// and returns an array of { line, message, severity, autoFixable }. We `eval`
// the check script string — they're admin-authored records, treated as code.

var NowForgeQualityScanner = Class.create();
NowForgeQualityScanner.prototype = {
    initialize: function () {
        this.utils = new x_nowfg_nowforge.NowForgeUtils();
    },

    // ── Public entry points ─────────────────────────────────────────────

    /**
     * Scan all scripts in a scope.
     * @param {string} scopeName e.g. "x_my_app" or "global"
     * @param {string} scanType "manual" | "scheduled" | "commit-gate" | "pipeline"
     * @return {object} { scanSysId, score, grade, criticalCount, warningCount, infoCount }
     */
    scanScope: function (scopeName, scanType) {
        var scopeId = this.utils.scopeIdFor(scopeName);
        var scan = this._createScanRecord(scanType || 'manual', scopeId, '');
        var results = this._runRulesAgainstScripts(this._collectScriptsInScope(scopeId));
        return this._completeScan(scan, results);
    },

    /**
     * Scan only the scripts in a specific update set.
     * Used by the commit-gate business rule.
     * @param {string} updateSetId
     */
    scanUpdateSet: function (updateSetId) {
        var scan = this._createScanRecord('commit-gate', '', updateSetId);
        var results = this._runRulesAgainstScripts(this._collectScriptsInUpdateSet(updateSetId));
        return this._completeScan(scan, results);
    },

    // ── Collectors ──────────────────────────────────────────────────────

    _collectScriptsInScope: function (scopeId) {
        var maxPer = parseInt(gs.getProperty('x_nowfg_nowforge.scan.max_records_per_table', '500'), 10) || 500;
        var scripts = [];
        var configs = [
            { table: 'sys_script',         field: 'script', whenField: 'when' },
            { table: 'sys_script_client',  field: 'script', whenField: 'type' },
            { table: 'sys_script_include', field: 'script' },
            { table: 'sys_script_fix',     field: 'script' },
            { table: 'sys_ui_action',      field: 'script' },
            { table: 'sys_ui_policy',      field: 'script' }
        ];
        for (var i = 0; i < configs.length; i++) {
            var c = configs[i];
            var gr = new GlideRecord(c.table);
            if (scopeId) gr.addQuery('sys_scope', scopeId);
            gr.addActiveQuery();
            gr.setLimit(maxPer);
            gr.query();
            while (gr.next()) {
                scripts.push({
                    table: c.table,
                    sysId: gr.getUniqueValue(),
                    name: gr.getValue('name') || gr.getDisplayValue(),
                    script: gr.getValue(c.field) || '',
                    when: c.whenField ? gr.getValue(c.whenField) : ''
                });
            }
        }
        return scripts;
    },

    _collectScriptsInUpdateSet: function (updateSetId) {
        var scripts = [];
        var ux = new GlideRecord('sys_update_xml');
        ux.addQuery('update_set', updateSetId);
        ux.query();
        while (ux.next()) {
            var name = ux.getValue('name'); // e.g. "sys_script_<sys_id>"
            var match = name.match(/^([a-z_]+)_([a-f0-9]{32})$/);
            if (!match) continue;
            var table = match[1];
            if (this._isScriptTable(table)) {
                var rec = new GlideRecord(table);
                if (rec.get(match[2])) {
                    scripts.push({
                        table: table,
                        sysId: rec.getUniqueValue(),
                        name: rec.getValue('name') || rec.getDisplayValue(),
                        script: rec.getValue('script') || '',
                        when: rec.getValue('when') || rec.getValue('type') || ''
                    });
                }
            }
        }
        return scripts;
    },

    _isScriptTable: function (table) {
        return [
            'sys_script', 'sys_script_client', 'sys_script_include',
            'sys_script_fix', 'sys_ui_action', 'sys_ui_policy'
        ].indexOf(table) !== -1;
    },

    // ── Rule engine ─────────────────────────────────────────────────────

    _runRulesAgainstScripts: function (scripts) {
        var rules = this._loadActiveRules();
        var findings = [];
        for (var i = 0; i < scripts.length; i++) {
            var ctx = this._buildContext(scripts[i]);
            for (var j = 0; j < rules.length; j++) {
                var rule = rules[j];
                var ruleFindings = this._runRule(rule, scripts[i].script, ctx);
                for (var k = 0; k < ruleFindings.length; k++) {
                    findings.push({
                        ruleSysId: rule.sysId,
                        target: scripts[i],
                        line: ruleFindings[k].line,
                        message: ruleFindings[k].message,
                        severity: ruleFindings[k].severity || rule.severity,
                        autoFixable: !!ruleFindings[k].autoFixable
                    });
                }
            }
        }
        return findings;
    },

    _loadActiveRules: function () {
        var rules = [];
        var gr = new GlideRecord('x_nowfg_quality_rule');
        gr.addActiveQuery();
        gr.query();
        while (gr.next()) {
            rules.push({
                sysId: gr.getUniqueValue(),
                ruleId: gr.getValue('rule_id'),
                severity: gr.getValue('severity'),
                checkScript: gr.getValue('check_script')
            });
        }
        return rules;
    },

    _buildContext: function (script) {
        var scriptType =
            script.table === 'sys_script' ? 'business_rule' :
            script.table === 'sys_script_client' ? 'client_script' :
            script.table === 'sys_script_include' ? 'script_include' :
            script.table === 'sys_ui_action' ? 'ui_action' :
            script.table === 'sys_ui_policy' ? 'ui_policy' : 'other';
        return {
            scriptType: scriptType,
            tableRecord: script.table,
            sysId: script.sysId,
            name: script.name,
            when: script.when
        };
    },

    _runRule: function (rule, scriptContent, context) {
        // The check_script is a self-invoking function; we eval it with the
        // expected closure variables in scope. Errors in one rule must not
        // poison the rest of the scan.
        try {
            // eslint-disable-next-line no-eval
            var fn = eval('(' + rule.checkScript + ')');
            if (typeof fn === 'function') {
                var r = fn(scriptContent, context);
                return Array.isArray(r) ? r : [];
            }
            // Otherwise the check_script was already invoked (IIFE) — use returned value
            if (Array.isArray(fn)) return fn;
            return [];
        } catch (err) {
            gs.warn('NowForge rule "' + rule.ruleId + '" threw: ' + err.message);
            return [];
        }
    },

    // ── Persistence ─────────────────────────────────────────────────────

    _createScanRecord: function (scanType, scopeId, updateSetId) {
        var gr = new GlideRecord('x_nowfg_quality_scan');
        gr.initialize();
        gr.setValue('scan_type', scanType);
        if (scopeId) gr.setValue('scope', scopeId);
        if (updateSetId) gr.setValue('update_set', updateSetId);
        gr.setValue('status', 'running');
        gr.setValue('started_at', new GlideDateTime());
        gr.setValue('triggered_by', gs.getUserID());
        return gr.insert();
    },

    _completeScan: function (scanId, findings) {
        var counts = { error: 0, warning: 0, info: 0 };
        for (var i = 0; i < findings.length; i++) {
            counts[findings[i].severity] = (counts[findings[i].severity] || 0) + 1;
            this._saveFinding(scanId, findings[i]);
        }
        var score = 100 - (counts.error * 15) - (counts.warning * 5) - (counts.info * 2);
        if (score < 0) score = 0;
        var grade = this.utils.gradeFor(score);

        var gr = new GlideRecord('x_nowfg_quality_scan');
        if (gr.get(scanId)) {
            gr.setValue('status', 'completed');
            gr.setValue('completed_at', new GlideDateTime());
            gr.setValue('total_issues', findings.length);
            gr.setValue('critical_count', counts.error);
            gr.setValue('warning_count', counts.warning);
            gr.setValue('info_count', counts.info);
            gr.setValue('score', score);
            gr.setValue('grade', grade);
            gr.update();
        }

        return {
            scanSysId: scanId,
            score: score,
            grade: grade,
            criticalCount: counts.error,
            warningCount: counts.warning,
            infoCount: counts.info,
            totalIssues: findings.length
        };
    },

    _saveFinding: function (scanId, f) {
        var gr = new GlideRecord('x_nowfg_scan_result');
        gr.initialize();
        gr.setValue('scan', scanId);
        if (f.ruleSysId) gr.setValue('rule', f.ruleSysId);
        gr.setValue('target_table', f.target.table);
        gr.setValue('target_record', f.target.sysId);
        gr.setValue('target_name', f.target.name);
        gr.setValue('line_number', f.line);
        gr.setValue('message', f.message);
        gr.setValue('severity', f.severity);
        gr.setValue('auto_fixable', f.autoFixable);
        gr.insert();
    },

    type: 'NowForgeQualityScanner'
};
