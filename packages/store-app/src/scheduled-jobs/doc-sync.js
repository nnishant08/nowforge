// Scheduled Job: NowForge Doc Sync
// Application: NowForge (x_nowfg_nowforge)
// Run: Daily, 03:00
// Active: true
//
// Walks every active scope and regenerates documentation. Each artifact's
// version field is bumped only when the content actually changed.

(function () {
    var scopes = new GlideRecord('sys_scope');
    scopes.addQuery('active', true);
    scopes.query();

    var total = 0;
    while (scopes.next()) {
        var scopeName = scopes.getValue('scope');
        try {
            var n = new x_nowfg_nowforge.NowForgeDocGenerator(scopeName).generateAll();
            total += n;
            gs.info('NowForge doc sync: ' + scopeName + ' → ' + n + ' doc(s)');
        } catch (e) {
            gs.error('NowForge doc sync failed for ' + scopeName + ': ' + e.message);
        }
    }
    gs.info('NowForge doc sync complete — ' + total + ' doc(s) total.');
})();
