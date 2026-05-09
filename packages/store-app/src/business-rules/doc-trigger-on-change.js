// Business Rule: NowForge Doc Trigger
// Application: NowForge (x_nowfg_nowforge)
// Tables: sys_script | sys_script_client | sys_script_include
// When: after insert, after update
// Order: 1000
// Active: true
// Filter: x_nowfg_nowforge.docs.auto_regenerate = true (read at runtime)
//
// Re-runs the doc generator for the changed record. Single-record only —
// the full sweep is the responsibility of the nightly scheduled job.

(function executeRule(current, previous) {
    if (gs.getProperty('x_nowfg_nowforge.docs.auto_regenerate', 'true') != 'true') return;

    var scopeName = current.sys_scope.scope ? current.sys_scope.scope.toString() : gs.getCurrentScopeName();
    var generator = new x_nowfg_nowforge.NowForgeDocGenerator(scopeName);
    try {
        generator.generateForRecord(current.getTableName(), current.getUniqueValue());
    } catch (e) {
        gs.warn('NowForge doc trigger failed: ' + e.message);
    }
})(current, previous);
