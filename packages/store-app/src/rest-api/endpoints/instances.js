// Scripted REST Resources for /api/x_nowfg_nowforge/v1/instances
//
// GET    /instances                          — list registered instances
// POST   /instances                          — register one
// GET    /instances/{id}/health              — health summary
// GET    /instances/{id}/clone-readiness     — pre-clone checklist
// POST   /instances/compare                  — compare two by id

(function process(request, response) {
    var method = request.httpMethod || 'GET';
    var p = request.pathParams || {};
    var manager = new x_nowfg_nowforge.NowForgeInstanceManager();

    if (method === 'GET' && !p.instance_sys_id) {
        var rows = [];
        var gr = new GlideRecord('x_nowfg_instance_registry');
        gr.orderBy('environment');
        gr.query();
        while (gr.next()) {
            rows.push({
                sysId: gr.getUniqueValue(),
                name: gr.getValue('name'),
                url: gr.getValue('url'),
                environment: gr.getValue('environment'),
                version: gr.getValue('version'),
                healthScore: parseInt(gr.getValue('health_score'), 10) || 0,
                lastScanDate: gr.getValue('last_scan_date')
            });
        }
        response.setStatus(200);
        response.setBody({ result: rows });
        return;
    }

    if (method === 'POST' && (request.uri || '').indexOf('/compare') !== -1) {
        var body = request.body && request.body.data ? request.body.data : {};
        if (!body.a || !body.b) { response.setStatus(400); response.setBody({ error: '`a` and `b` instance ids required' }); return; }
        response.setStatus(200);
        response.setBody({ result: manager.compareInstances(String(body.a), String(body.b)) });
        return;
    }

    if (method === 'POST') {
        var body2 = request.body && request.body.data ? request.body.data : {};
        if (!body2.name || !body2.url) { response.setStatus(400); response.setBody({ error: 'name + url required' }); return; }
        var id = manager.registerInstance(String(body2.name), String(body2.url), body2.environment ? String(body2.environment) : 'unknown');
        response.setStatus(200);
        response.setBody({ result: { sysId: id } });
        return;
    }

    if (method === 'GET' && p.instance_sys_id) {
        var path = request.uri || '';
        if (path.indexOf('/clone-readiness') !== -1) {
            response.setStatus(200);
            response.setBody({ result: manager.getCloneReadiness(p.instance_sys_id) });
            return;
        }
        if (path.indexOf('/health') !== -1) {
            response.setStatus(200);
            response.setBody({ result: manager.getInstanceHealth(p.instance_sys_id) });
            return;
        }
    }

    response.setStatus(405);
    response.setBody({ error: 'Method not allowed for this path' });
})(request, response);
