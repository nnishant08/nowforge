// Scripted REST Resource: GET /api/x_nowfg_nowforge/v1/dashboard
//
// Aggregated quality dashboard data: latest score, last 10 scans, top 10
// noisy scripts, issues-by-category. Used by both the on-instance UI page
// and the chrome extension's quality panel.

(function process(request, response) {
    // Last 10 scans
    var scans = [];
    var sgr = new GlideRecord('x_nowfg_quality_scan');
    sgr.orderByDesc('started_at');
    sgr.setLimit(10);
    sgr.query();
    while (sgr.next()) {
        scans.push({
            sysId: sgr.getUniqueValue(),
            startedAt: sgr.getValue('started_at'),
            completedAt: sgr.getValue('completed_at'),
            score: parseInt(sgr.getValue('score'), 10) || 0,
            grade: sgr.getValue('grade'),
            errorCount: parseInt(sgr.getValue('critical_count'), 10) || 0,
            warningCount: parseInt(sgr.getValue('warning_count'), 10) || 0
        });
    }

    // Issues by category — aggregate over the most recent scan
    var categoryCounts = {};
    var topRecords = {};
    var latestScanId = scans[0] ? scans[0].sysId : null;
    if (latestScanId) {
        var fr = new GlideRecord('x_nowfg_scan_result');
        fr.addQuery('scan', latestScanId);
        fr.query();
        while (fr.next()) {
            var cat = fr.rule.category ? fr.rule.category.toString() : 'other';
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

            var key = fr.getValue('target_table') + '|' + fr.getValue('target_record');
            if (!topRecords[key]) {
                topRecords[key] = {
                    table: fr.getValue('target_table'),
                    sysId: fr.getValue('target_record'),
                    name: fr.getValue('target_name'),
                    count: 0
                };
            }
            topRecords[key].count++;
        }
    }
    var topList = Object.keys(topRecords).map(function (k) { return topRecords[k]; })
        .sort(function (a, b) { return b.count - a.count; })
        .slice(0, 10);

    response.setStatus(200);
    response.setBody({
        result: {
            latestScore: scans[0] ? scans[0].score : null,
            latestGrade: scans[0] ? scans[0].grade : null,
            recentScans: scans,
            issuesByCategory: categoryCounts,
            topNoisyScripts: topList
        }
    });
})(request, response);
