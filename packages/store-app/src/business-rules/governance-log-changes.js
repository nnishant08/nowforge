// Business Rule: NowForge Governance Logger
// Application: NowForge (x_nowfg_nowforge)
// Table: sys_update_xml
// When: after insert
// Active: true
// Order: 200
//
// Every captured update_xml row is mirrored to x_nowfg_governance_log so
// we get an audit trail independent of update sets being deleted.

(function executeRule(current, previous) {
    var gov = new x_nowfg_nowforge.NowForgeGovernance();
    var name = current.getValue('name'); // e.g. "sys_script_<sys_id>"
    var match = name.match(/^([a-z_]+)_([a-f0-9]{32})$/);
    var targetTable = match ? match[1] : '';
    var targetRecord = match ? match[2] : '';

    gov.log({
        action: current.action == 'INSERT_OR_UPDATE' ? 'script_modified' : 'script_deleted',
        targetTable: targetTable,
        targetRecord: targetRecord,
        targetName: current.getValue('target_name'),
        details: {
            updateSet: current.update_set ? current.update_set.getDisplayValue() : '',
            type: current.getValue('type'),
            action: current.getValue('action')
        }
    });
})(current, previous);
