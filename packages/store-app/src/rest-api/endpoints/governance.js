// Scripted REST Resources for /api/x_nowfg_nowforge/v1/governance
//
// GET /governance/activity?limit=50&user=...&risk_level=high
// GET /governance/risk-summary?days=30
// GET /governance/coverage
// GET /governance/export?from=YYYY-MM-DD&to=YYYY-MM-DD
// GET /governance/trends?period=30d

(function process(request, response) {
    var method = request.httpMethod || 'GET';
    var path = request.uri || '';
    var qp = request.queryParams || {};
    var gov = new x_nowfg_nowforge.NowForgeGovernance();

    if (method !== 'GET') { response.setStatus(405); response.setBody({ error: 'Method not allowed' }); return; }

    if (path.indexOf('/activity') !== -1) {
        var limit = parseInt(qp.limit ? qp.limit[0] : '50', 10) || 50;
        var filters = {
            user: qp.user ? qp.user[0] : '',
            riskLevel: qp.risk_level ? qp.risk_level[0] : '',
            from: qp.from ? qp.from[0] : '',
            to: qp.to ? qp.to[0] : ''
        };
        response.setStatus(200);
        response.setBody({ result: gov.activityFeed(limit, filters) });
        return;
    }

    if (path.indexOf('/risk-summary') !== -1) {
        var days = parseInt(qp.days ? qp.days[0] : '30', 10) || 30;
        response.setStatus(200);
        response.setBody({ result: gov.riskSummary(days) });
        return;
    }

    if (path.indexOf('/coverage') !== -1) {
        var manager = new x_nowfg_nowforge.NowForgeInstanceManager();
        var coverage = manager._testCoverage();
        response.setStatus(200);
        response.setBody({ result: { coveragePercent: coverage } });
        return;
    }

    if (path.indexOf('/trends') !== -1) {
        var period = qp.period ? qp.period[0] : '30d';
        var rows = [];
        var thr = new GlideDateTime();
        thr.addDays(-parseInt(period, 10) || -30);
        var gr = new GlideRecord('x_nowfg_quality_scan');
        gr.addQuery('started_at', '>=', thr.getValue());
        gr.orderBy('started_at');
        gr.query();
        while (gr.next()) {
            rows.push({
                at: gr.getValue('started_at'),
                score: parseInt(gr.getValue('score'), 10) || 0,
                grade: gr.getValue('grade')
            });
        }
        response.setStatus(200);
        response.setBody({ result: rows });
        return;
    }

    if (path.indexOf('/export') !== -1) {
        var from = qp.from ? qp.from[0] : '';
        var to   = qp.to   ? qp.to[0]   : '';
        var rows2 = gov.complianceExport(from, to);
        // Return as JSON; the chrome extension converts to CSV client-side.
        response.setStatus(200);
        response.setBody({ result: rows2 });
        return;
    }

    response.setStatus(404);
    response.setBody({ error: 'Unknown governance path' });
})(request, response);
