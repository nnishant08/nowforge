// Business Rule: NowForge Quality Gate
// Application: NowForge (x_nowfg_nowforge)
// Table: sys_update_set
// When: before update
// Order: 100
// Active: true
// Filter condition: state changes to "complete"
//
// Runs the on-instance quality scanner against the update set being committed.
// If the system property `x_nowfg_nowforge.quality_gate.block_on_errors` is true
// and any 'error' findings exist, the commit is aborted.

(function executeRule(current, previous) {
    if (current.state != 'complete' || previous.state == 'complete') return;

    var scanner = new x_nowfg_nowforge.NowForgeQualityScanner();
    var results;
    try {
        results = scanner.scanUpdateSet(current.getUniqueValue());
    } catch (e) {
        gs.error('NowForge Quality Gate failed to run: ' + e.message);
        return; // don't block on scanner failure
    }

    var blockOnErrors = gs.getProperty('x_nowfg_nowforge.quality_gate.block_on_errors', 'true') == 'true';
    var minScore = parseInt(gs.getProperty('x_nowfg_nowforge.quality_gate.min_score', '0'), 10) || 0;

    var failsErrorCheck = blockOnErrors && results.criticalCount > 0;
    var failsScoreCheck = minScore > 0 && results.score < minScore;

    if (failsErrorCheck || failsScoreCheck) {
        current.state = 'in progress';
        var msg = 'NowForge Quality Gate: ' +
            'score ' + results.score + ' (' + results.grade + '), ' +
            results.criticalCount + ' error(s), ' + results.warningCount + ' warning(s). ' +
            'Open the NowForge Quality Dashboard to fix.';
        gs.addErrorMessage(msg);
        current.setAbortAction(true);
        return;
    }

    if (results.criticalCount > 0) {
        gs.addWarningMessage('NowForge: ' + results.criticalCount +
            ' error(s) found but quality gate is in warn-only mode.');
    } else {
        gs.addInfoMessage('NowForge: passed with score ' + results.score + ' (' + results.grade + ').');
    }
})(current, previous);
