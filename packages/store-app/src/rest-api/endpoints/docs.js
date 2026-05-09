// Scripted REST Resources for /api/x_nowfg_nowforge/v1/docs
//
// POST   /docs/generate       — { "scope": "x_my_app" } → regenerate all docs for a scope
// GET    /docs                — list all docs (paginated)
// GET    /docs/{sys_id}       — fetch a single doc
// GET    /docs/export         — bundle all docs as a JSON array (use this from the chrome extension)

(function process(request, response) {
    var path = request.pathParams || {};
    var method = request.httpMethod || 'GET';

    // POST /docs/generate
    if (method === 'POST' && (request.uri || '').indexOf('/generate') !== -1) {
        var body = request.body && request.body.data ? request.body.data : {};
        var scope = body.scope || gs.getCurrentScopeName();
        var n = new x_nowfg_nowforge.NowForgeDocGenerator(scope).generateAll();
        response.setStatus(200);
        response.setBody({ result: { generated: n } });
        return;
    }

    // GET /docs/{sys_id}
    if (method === 'GET' && path.doc_sys_id) {
        var gr = new GlideRecord('x_nowfg_doc_output');
        if (!gr.get(path.doc_sys_id)) {
            response.setStatus(404);
            response.setBody({ error: 'Not found' });
            return;
        }
        response.setStatus(200);
        response.setBody({ result: {
            sysId: gr.getUniqueValue(),
            docType: gr.getValue('doc_type'),
            targetName: gr.getValue('target_name'),
            content: gr.getValue('content'),
            version: parseInt(gr.getValue('version'), 10) || 1,
            generatedAt: gr.getValue('generated_at')
        }});
        return;
    }

    // GET /docs (list)
    if (method === 'GET') {
        var docs = [];
        var limit = parseInt(request.queryParams.limit ? request.queryParams.limit[0] : '200', 10) || 200;
        var lr = new GlideRecord('x_nowfg_doc_output');
        if (request.queryParams.scope) lr.addQuery('scope.scope', request.queryParams.scope[0]);
        if (request.queryParams.doc_type) lr.addQuery('doc_type', request.queryParams.doc_type[0]);
        lr.orderByDesc('generated_at');
        lr.setLimit(limit);
        lr.query();
        while (lr.next()) {
            docs.push({
                sysId: lr.getUniqueValue(),
                docType: lr.getValue('doc_type'),
                targetName: lr.getValue('target_name'),
                version: parseInt(lr.getValue('version'), 10) || 1,
                generatedAt: lr.getValue('generated_at')
            });
        }
        response.setStatus(200);
        response.setBody({ result: docs });
        return;
    }

    response.setStatus(405);
    response.setBody({ error: 'Method not allowed' });
})(request, response);
