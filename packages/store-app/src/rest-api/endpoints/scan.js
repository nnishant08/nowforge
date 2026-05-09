// Scripted REST Resource: POST /api/x_nowfg_nowforge/v1/scan
// Body: { "scope": "x_my_app" } OR { "updateSet": "<sys_id>" }

(function process(request, response) {
    var body = request.body && request.body.data ? request.body.data : {};
    var scanner = new x_nowfg_nowforge.NowForgeQualityScanner();
    var result;
    try {
        if (body.updateSet) {
            result = scanner.scanUpdateSet(String(body.updateSet));
        } else if (body.scope) {
            result = scanner.scanScope(String(body.scope), 'manual');
        } else {
            response.setStatus(400);
            response.setBody({ error: 'Either `scope` or `updateSet` is required.' });
            return;
        }
        response.setStatus(200);
        response.setBody({ result: result });
    } catch (e) {
        response.setStatus(500);
        response.setBody({ error: e.message });
    }
})(request, response);
