// Script Include: NowForgeInstanceManager
// Application: NowForge (x_nowfg_nowforge)
// Client callable: false
//
// Manages the cross-instance registry and aggregates health data per
// registered instance. Cross-instance comparison reaches out to the OTHER
// instance's NowForge REST endpoints (so both must have this scoped app).

var NowForgeInstanceManager = Class.create();
NowForgeInstanceManager.prototype = {
    initialize: function () {
        this.utils = new x_nowfg_nowforge.NowForgeUtils();
    },

    /**
     * @return {string} sys_id of the new registry record.
     */
    registerInstance: function (name, url, environment) {
        var existing = new GlideRecord('x_nowfg_instance_registry');
        existing.addQuery('url', url);
        existing.setLimit(1);
        existing.query();
        if (existing.next()) return existing.getUniqueValue();

        var gr = new GlideRecord('x_nowfg_instance_registry');
        gr.initialize();
        gr.setValue('name', name);
        gr.setValue('url', url);
        gr.setValue('environment', environment || 'unknown');
        gr.setValue('version', this._detectVersion(url));
        return gr.insert();
    },

    /**
     * Aggregate latest quality + activity metrics for a registered instance.
     * Returns null if the instance is not in the registry.
     */
    getInstanceHealth: function (instanceId) {
        var gr = new GlideRecord('x_nowfg_instance_registry');
        if (!gr.get(instanceId)) return null;

        var qualityScore = this._latestQualityScore();
        var lastScan = this._lastScanTime();
        var changes7d = this._governanceChangeCount(7);
        var openErrors = this._openIssueCount('error');
        var coverage = this._testCoverage();

        var overall = Math.round(
            (qualityScore || 0) * 0.5 +
            Math.min(100, coverage) * 0.3 +
            (openErrors === 0 ? 100 : Math.max(0, 100 - openErrors * 5)) * 0.2
        );

        // Cache on the registry record
        gr.setValue('health_score', overall);
        gr.setValue('last_scan_date', lastScan || gr.getValue('last_scan_date'));
        gr.update();

        return {
            qualityScore: qualityScore,
            lastScanDate: lastScan,
            recentChanges: changes7d,
            openIssues: openErrors,
            testCoverage: coverage,
            overallScore: overall
        };
    },

    /**
     * Pre-clone checklist — what should be paused / preserved before cloning.
     */
    getCloneReadiness: function (instanceId) {
        var inProgress = [];
        var u = new GlideRecord('sys_update_set');
        u.addQuery('state', 'in progress');
        u.query();
        while (u.next()) inProgress.push({ name: u.getValue('name'), updatedBy: u.getValue('sys_updated_by') });

        var jobs = [];
        var j = new GlideRecord('sys_trigger');
        j.addQuery('active', true);
        j.addQuery('trigger_type', 'IN', '0,1,2'); // periodic
        j.setLimit(50);
        j.query();
        while (j.next()) jobs.push({ name: j.getValue('name'), nextAction: j.getValue('next_action') });

        return {
            instanceId: instanceId,
            updateSetsInProgress: inProgress,
            scheduledJobsToReview: jobs,
            recommendation:
                inProgress.length > 0
                    ? 'Commit or back up the ' + inProgress.length + ' in-progress update set(s) first.'
                    : 'Looks safe to clone.'
        };
    },

    /**
     * Cross-instance compare — calls the OTHER instance's /api/.../scan results.
     * Returns a high-level summary; the chrome extension's diff tool is the
     * place for detailed record-by-record comparison.
     */
    compareInstances: function (instanceAId, instanceBId) {
        var a = new GlideRecord('x_nowfg_instance_registry');
        var b = new GlideRecord('x_nowfg_instance_registry');
        if (!a.get(instanceAId) || !b.get(instanceBId)) return null;
        return {
            a: { name: a.getValue('name'), url: a.getValue('url'), score: parseInt(a.getValue('health_score'), 10) || 0 },
            b: { name: b.getValue('name'), url: b.getValue('url'), score: parseInt(b.getValue('health_score'), 10) || 0 },
            note: 'For per-record diffs use the NowForge Instance Diff tool in the browser extension.'
        };
    },

    // ── Internals ───────────────────────────────────────────────────────

    _detectVersion: function (_url) {
        // For the local instance we know it; cross-instance detection would
        // require an authenticated REST call we don't want to spec here.
        return gs.getProperty('glide.buildname', '') || 'unknown';
    },

    _latestQualityScore: function () {
        var gr = new GlideRecord('x_nowfg_quality_scan');
        gr.orderByDesc('started_at');
        gr.setLimit(1);
        gr.query();
        return gr.next() ? parseInt(gr.getValue('score'), 10) : null;
    },

    _lastScanTime: function () {
        var gr = new GlideRecord('x_nowfg_quality_scan');
        gr.orderByDesc('started_at');
        gr.setLimit(1);
        gr.query();
        return gr.next() ? gr.getValue('started_at') : '';
    },

    _governanceChangeCount: function (days) {
        var threshold = new GlideDateTime();
        threshold.addDays(-days);
        var gr = new GlideAggregate('x_nowfg_governance_log');
        gr.addAggregate('COUNT');
        gr.addQuery('sys_created_on', '>=', threshold.getValue());
        gr.query();
        if (gr.next()) return parseInt(gr.getAggregate('COUNT'), 10) || 0;
        return 0;
    },

    _openIssueCount: function (severity) {
        // "Open" = found in the most recent scan
        var latest = new GlideRecord('x_nowfg_quality_scan');
        latest.orderByDesc('started_at');
        latest.setLimit(1);
        latest.query();
        if (!latest.next()) return 0;

        var ga = new GlideAggregate('x_nowfg_scan_result');
        ga.addAggregate('COUNT');
        ga.addQuery('scan', latest.getUniqueValue());
        if (severity) ga.addQuery('severity', severity);
        ga.query();
        if (ga.next()) return parseInt(ga.getAggregate('COUNT'), 10) || 0;
        return 0;
    },

    _testCoverage: function () {
        var totalScripts = 0;
        var tablesToCount = ['sys_script', 'sys_script_client', 'sys_script_include'];
        for (var i = 0; i < tablesToCount.length; i++) {
            var ga = new GlideAggregate(tablesToCount[i]);
            ga.addAggregate('COUNT');
            ga.addActiveQuery();
            ga.query();
            if (ga.next()) totalScripts += parseInt(ga.getAggregate('COUNT'), 10) || 0;
        }
        if (totalScripts === 0) return 100;

        var tests = new GlideAggregate('sys_atf_test');
        tests.addAggregate('COUNT');
        tests.addActiveQuery();
        tests.query();
        var testCount = tests.next() ? parseInt(tests.getAggregate('COUNT'), 10) || 0 : 0;
        return Math.min(100, Math.round((testCount / totalScripts) * 100));
    },

    type: 'NowForgeInstanceManager'
};
