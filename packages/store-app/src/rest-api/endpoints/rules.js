// Scripted REST Resources for /api/x_nowfg_nowforge/v1/rules
//
// GET /rules                — list all
// PUT /rules/{rule_sys_id}  — update active/severity

(function process(request, response) {
    var method = request.httpMethod || 'GET';
    var sysId = request.pathParams.rule_sys_id;

    if (method === 'GET') {
        var out = [];
        var gr = new GlideRecord('x_nowfg_quality_rule');
        gr.orderBy('category'); gr.orderBy('rule_id');
        gr.query();
        while (gr.next()) {
            out.push({
                sysId: gr.getUniqueValue(),
                ruleId: gr.getValue('rule_id'),
                name: gr.getValue('name'),
                description: gr.getValue('description'),
                category: gr.getValue('category'),
                severity: gr.getValue('severity'),
                active: gr.getValue('active') == 'true',
                custom: gr.getValue('custom') == 'true'
            });
        }
        response.setStatus(200);
        response.setBody({ result: out });
        return;
    }

    if (method === 'PUT') {
        if (!sysId) { response.setStatus(400); response.setBody({ error: 'rule_sys_id required' }); return; }
        var body = request.body && request.body.data ? request.body.data : {};
        var gr2 = new GlideRecord('x_nowfg_quality_rule');
        if (!gr2.get(sysId)) { response.setStatus(404); response.setBody({ error: 'Rule not found' }); return; }
        if (body.active !== undefined) gr2.setValue('active', !!body.active);
        if (body.severity)             gr2.setValue('severity', String(body.severity));
        gr2.update();
        response.setStatus(200);
        response.setBody({ result: { sysId: gr2.getUniqueValue() } });
        return;
    }

    response.setStatus(405);
    response.setBody({ error: 'Method not allowed' });
})(request, response);
