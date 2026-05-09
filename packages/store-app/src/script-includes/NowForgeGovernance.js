// Script Include: NowForgeGovernance
// Application: NowForge (x_nowfg_nowforge)
// Client callable: false
//
// Governance / audit-log helpers. Used by the governance-log-changes
// business rule and the /governance/* REST endpoints.

var NowForgeGovernance = Class.create();
NowForgeGovernance.prototype = {
    initialize: function () {
        this.utils = new x_nowfg_nowforge.NowForgeUtils();
    },

    /** Append a governance log entry. */
    log: function (entry) {
        if (gs.getProperty('x_nowfg_nowforge.governance.log_all_changes', 'true') != 'true') return;
        var gr = new GlideRecord('x_nowfg_governance_log');
        gr.initialize();
        gr.setValue('action', entry.action || 'script_modified');
        gr.setValue('user', entry.user || gs.getUserID());
        gr.setValue('instance_url', entry.instanceUrl || gs.getProperty('glide.servlet.uri'));
        if (entry.targetTable)  gr.setValue('target_table', entry.targetTable);
        if (entry.targetRecord) gr.setValue('target_record', entry.targetRecord);
        if (entry.targetName)   gr.setValue('target_name', entry.targetName);
        if (entry.details)      gr.setValue('details', JSON.stringify(entry.details));
        gr.setValue('risk_level', entry.riskLevel || this.calculateRisk(entry.targetTable));
        return gr.insert();
    },

    /** Determine risk level based on the target table. */
    calculateRisk: function (table) {
        if (!table) return 'low';
        var critical = this.utils.propAsList(
            'x_nowfg_nowforge.governance.high_risk_tables',
            'sys_security_acl,sys_script,sys_properties,sys_user_role,sys_user_grmember'
        );
        if (critical.indexOf(table) !== -1) return 'high';
        if (table.indexOf('sys_') === 0) return 'medium';
        return 'low';
    },

    /** Recent activity for the governance dashboard. */
    activityFeed: function (limit, filters) {
        limit = limit || 50;
        filters = filters || {};
        var rows = [];
        var gr = new GlideRecord('x_nowfg_governance_log');
        if (filters.user)      gr.addQuery('user', filters.user);
        if (filters.riskLevel) gr.addQuery('risk_level', filters.riskLevel);
        if (filters.from)      gr.addQuery('sys_created_on', '>=', filters.from);
        if (filters.to)        gr.addQuery('sys_created_on', '<=', filters.to);
        gr.orderByDesc('sys_created_on');
        gr.setLimit(limit);
        gr.query();
        while (gr.next()) {
            rows.push({
                sysId: gr.getUniqueValue(),
                action: gr.getValue('action'),
                user: gr.user.user_name ? gr.user.user_name.toString() : '',
                instanceUrl: gr.getValue('instance_url'),
                targetTable: gr.getValue('target_table'),
                targetName: gr.getValue('target_name'),
                riskLevel: gr.getValue('risk_level'),
                createdAt: gr.getValue('sys_created_on')
            });
        }
        return rows;
    },

    /** Aggregate risk counts for a date range. */
    riskSummary: function (days) {
        days = days || 30;
        var threshold = new GlideDateTime();
        threshold.addDays(-days);
        var summary = { critical: 0, high: 0, medium: 0, low: 0 };
        var ga = new GlideAggregate('x_nowfg_governance_log');
        ga.addAggregate('COUNT');
        ga.addQuery('sys_created_on', '>=', threshold.getValue());
        ga.groupBy('risk_level');
        ga.query();
        while (ga.next()) {
            summary[ga.getValue('risk_level')] = parseInt(ga.getAggregate('COUNT'), 10) || 0;
        }
        return summary;
    },

    /** Compliance export — returns rows suitable for CSV serialisation. */
    complianceExport: function (from, to) {
        var rows = [];
        var gr = new GlideRecord('x_nowfg_governance_log');
        if (from) gr.addQuery('sys_created_on', '>=', from);
        if (to)   gr.addQuery('sys_created_on', '<=', to);
        gr.orderBy('sys_created_on');
        gr.query();
        while (gr.next()) {
            rows.push({
                timestamp: gr.getValue('sys_created_on'),
                user: gr.user.user_name ? gr.user.user_name.toString() : '',
                action: gr.getValue('action'),
                table: gr.getValue('target_table'),
                target: gr.getValue('target_name'),
                risk: gr.getValue('risk_level'),
                instance: gr.getValue('instance_url')
            });
        }
        return rows;
    },

    type: 'NowForgeGovernance'
};
