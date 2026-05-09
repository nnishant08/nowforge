// Scheduled Job: NowForge Nightly Scan
// Application: NowForge (x_nowfg_nowforge)
// Run: Daily, 02:00
// Active: true
//
// Walks each application scope and runs a full quality scan + doc regen.

(function () {
    var scopes = new GlideRecord('sys_scope');
    scopes.addQuery('active', true);
    scopes.query();

    var scanner = new x_nowfg_nowforge.NowForgeQualityScanner();
    var totalScanned = 0;
    while (scopes.next()) {
        var scopeName = scopes.getValue('scope');
        try {
            var r = scanner.scanScope(scopeName, 'scheduled');
            totalScanned++;
            gs.info('NowForge nightly scan: ' + scopeName + ' → ' + r.score + ' (' + r.grade + ')');
        } catch (e) {
            gs.error('NowForge nightly scan failed for ' + scopeName + ': ' + e.message);
        }
    }
    gs.info('NowForge nightly scan complete — ' + totalScanned + ' scope(s).');
})();
