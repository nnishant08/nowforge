// Scripted REST Resource: GET /api/x_nowfg_nowforge/v1/scan/{scan_sys_id}

(function process(request, response) {
    var scanId = request.pathParams.scan_sys_id;
    if (!scanId) {
        response.setStatus(400);
        response.setBody({ error: 'scan_sys_id required in path' });
        return;
    }

    var scan = new GlideRecord('x_nowfg_quality_scan');
    if (!scan.get(scanId)) {
        response.setStatus(404);
        response.setBody({ error: 'Scan not found' });
        return;
    }

    var findings = [];
    var fr = new GlideRecord('x_nowfg_scan_result');
    fr.addQuery('scan', scanId);
    fr.orderBy('severity');
    fr.query();
    while (fr.next()) {
        findings.push({
            ruleId: fr.rule.rule_id ? fr.rule.rule_id.toString() : '',
            ruleName: fr.rule.name ? fr.rule.name.toString() : '',
            targetTable: fr.getValue('target_table'),
            targetRecord: fr.getValue('target_record'),
            targetName: fr.getValue('target_name'),
            line: parseInt(fr.getValue('line_number'), 10) || 0,
            message: fr.getValue('message'),
            severity: fr.getValue('severity'),
            autoFixable: fr.getValue('auto_fixable') == 'true'
        });
    }

    response.setStatus(200);
    response.setBody({
        result: {
            scanSysId: scanId,
            scanType: scan.getValue('scan_type'),
            score: parseInt(scan.getValue('score'), 10) || 0,
            grade: scan.getValue('grade'),
            criticalCount: parseInt(scan.getValue('critical_count'), 10) || 0,
            warningCount: parseInt(scan.getValue('warning_count'), 10) || 0,
            infoCount: parseInt(scan.getValue('info_count'), 10) || 0,
            startedAt: scan.getValue('started_at'),
            completedAt: scan.getValue('completed_at'),
            findings: findings
        }
    });
})(request, response);
