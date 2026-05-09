// Seed script — run once after creating x_nowfg_quality_rule.
// Inserts the built-in rules as records. Each `check_script` is a function
// expression returning an array of findings.
//
// Run from System Definition → Scripts - Background.

(function () {
    var RULES = [
        {
            ruleId: 'no-eval',
            name: 'No eval()',
            description: 'eval() and new Function() are blocked by SN code review and are security risks.',
            category: 'security',
            severity: 'error',
            check: function (script) {
                var issues = [], re = /\b(eval\s*\(|new\s+Function\s*\()/g, m;
                while ((m = re.exec(script)) !== null) {
                    issues.push({
                        line: script.substring(0, m.index).split('\n').length,
                        message: 'Avoid eval() / new Function() — security risk and SN scanners reject it.',
                        severity: 'error'
                    });
                }
                return issues;
            }
        },
        {
            ruleId: 'no-packages',
            name: 'No Packages.* usage',
            description: 'Packages.* is deprecated and breaks in scoped applications.',
            category: 'upgradeability',
            severity: 'error',
            check: function (script) {
                var issues = [], re = /\bPackages\b/g, m;
                while ((m = re.exec(script)) !== null) {
                    issues.push({
                        line: script.substring(0, m.index).split('\n').length,
                        message: 'Packages.* is deprecated and unavailable in scoped apps.',
                        severity: 'error'
                    });
                }
                return issues;
            }
        },
        {
            ruleId: 'no-current-update-in-before',
            name: 'No current.update() in before BR',
            description: 'Calling current.update() in a before BR causes infinite recursion.',
            category: 'best-practice',
            severity: 'error',
            check: function (script, ctx) {
                if (ctx.scriptType !== 'business_rule' || ctx.when !== 'before') return [];
                var issues = [], re = /\bcurrent\s*\.\s*update\s*\(/g, m;
                while ((m = re.exec(script)) !== null) {
                    issues.push({
                        line: script.substring(0, m.index).split('\n').length,
                        message: 'current.update() in a Before BR causes infinite recursion. Just modify field values.',
                        severity: 'error'
                    });
                }
                return issues;
            }
        },
        {
            ruleId: 'no-synchronous-ajax',
            name: 'No GlideAjax.getXMLWait()',
            description: 'getXMLWait blocks the UI thread.',
            category: 'performance',
            severity: 'error',
            check: function (script) {
                var issues = [], re = /\.getXMLWait\s*\(/g, m;
                while ((m = re.exec(script)) !== null) {
                    issues.push({
                        line: script.substring(0, m.index).split('\n').length,
                        message: 'getXMLWait() blocks the UI. Use getXMLAnswer(callback) instead.',
                        severity: 'error'
                    });
                }
                return issues;
            }
        },
        {
            ruleId: 'no-client-gliderecord',
            name: 'No GlideRecord in client scripts',
            description: 'Client-side GlideRecord is slow and exposes record data unnecessarily.',
            category: 'performance',
            severity: 'error',
            check: function (script, ctx) {
                if (ctx.scriptType !== 'client_script') return [];
                var issues = [], re = /\bnew\s+GlideRecord\s*\(/g, m;
                while ((m = re.exec(script)) !== null) {
                    issues.push({
                        line: script.substring(0, m.index).split('\n').length,
                        message: 'GlideRecord in client scripts is slow and deprecated. Use GlideAjax.',
                        severity: 'error'
                    });
                }
                return issues;
            }
        },
        {
            ruleId: 'require-query-condition',
            name: 'GlideRecord.query() needs conditions',
            description: 'Catches full table scans.',
            category: 'performance',
            severity: 'warning',
            check: function (script) {
                var issues = [];
                var declRe = /\b(\w+)\s*=\s*new\s+GlideRecord\s*\(/g, m;
                while ((m = declRe.exec(script)) !== null) {
                    var varName = m[1];
                    var after = script.slice(m.index);
                    var queryIdx = after.search(new RegExp('\\b' + varName + '\\s*\\.\\s*query\\s*\\('));
                    if (queryIdx === -1) continue;
                    var between = after.slice(0, queryIdx);
                    if (
                        !new RegExp('\\b' + varName + '\\s*\\.\\s*addQuery\\s*\\(').test(between) &&
                        !new RegExp('\\b' + varName + '\\s*\\.\\s*addEncodedQuery\\s*\\(').test(between) &&
                        !new RegExp('\\b' + varName + '\\s*\\.\\s*addActiveQuery\\s*\\(').test(between) &&
                        !new RegExp('\\b' + varName + '\\s*\\.\\s*get\\s*\\(').test(between)
                    ) {
                        issues.push({
                            line: script.substring(0, m.index + queryIdx).split('\n').length,
                            message: varName + '.query() with no conditions — full table scan.',
                            severity: 'warning'
                        });
                    }
                }
                return issues;
            }
        },
        {
            ruleId: 'use-gs-nil',
            name: 'Prefer gs.nil()',
            description: 'Use gs.nil() instead of comparing to null/empty.',
            category: 'best-practice',
            severity: 'warning',
            check: function (script) {
                var issues = [], re = /\b(\w+)\s*(==|===|!=|!==)\s*(null|undefined|"")/g, m;
                while ((m = re.exec(script)) !== null) {
                    issues.push({
                        line: script.substring(0, m.index).split('\n').length,
                        message: 'Use gs.nil(' + m[1] + ') instead of comparing to ' + m[3] + '.',
                        severity: 'warning'
                    });
                }
                return issues;
            }
        },
        {
            ruleId: 'no-hardcoded-sysid',
            name: 'No hardcoded sys_ids',
            description: 'sys_ids differ across instances — use system properties.',
            category: 'upgradeability',
            severity: 'warning',
            check: function (script) {
                var issues = [], re = /['"]([a-f0-9]{32})['"]/gi, m;
                while ((m = re.exec(script)) !== null) {
                    issues.push({
                        line: script.substring(0, m.index).split('\n').length,
                        message: "Hardcoded sys_id '" + m[1].slice(0, 8) + "…' will break across instances.",
                        severity: 'warning'
                    });
                }
                return issues;
            }
        },
        {
            ruleId: 'try-catch-rest',
            name: 'Wrap REST calls in try/catch',
            description: 'RESTMessageV2.execute() can throw.',
            category: 'best-practice',
            severity: 'warning',
            check: function (script) {
                var issues = [], re = /\b(?:RESTMessageV2|SOAPMessageV2)[\s\S]{0,200}?\.execute\s*\(/g, m;
                while ((m = re.exec(script)) !== null) {
                    var win = script.slice(Math.max(0, m.index - 200), m.index);
                    if (!/\btry\s*\{/.test(win)) {
                        issues.push({
                            line: script.substring(0, m.index).split('\n').length,
                            message: 'Wrap REST execute() in try/catch.',
                            severity: 'warning'
                        });
                    }
                }
                return issues;
            }
        },
        {
            ruleId: 'no-gs-print-in-prod',
            name: 'gs.print is for background scripts',
            description: 'Use gs.info/debug/warn/error in production code.',
            category: 'best-practice',
            severity: 'info',
            check: function (script) {
                var issues = [], re = /\bgs\s*\.\s*print\s*\(/g, m;
                while ((m = re.exec(script)) !== null) {
                    issues.push({
                        line: script.substring(0, m.index).split('\n').length,
                        message: 'Use gs.info/debug/warn/error instead of gs.print in production scripts.',
                        severity: 'info'
                    });
                }
                return issues;
            }
        }
    ];

    var inserted = 0;
    for (var i = 0; i < RULES.length; i++) {
        var r = RULES[i];
        var existing = new GlideRecord('x_nowfg_quality_rule');
        existing.addQuery('rule_id', r.ruleId);
        existing.query();
        if (existing.next()) continue;

        var gr = new GlideRecord('x_nowfg_quality_rule');
        gr.initialize();
        gr.setValue('name', r.name);
        gr.setValue('rule_id', r.ruleId);
        gr.setValue('description', r.description);
        gr.setValue('category', r.category);
        gr.setValue('severity', r.severity);
        gr.setValue('active', true);
        gr.setValue('custom', false);
        gr.setValue('check_script', r.check.toString());
        gr.insert();
        inserted++;
    }
    gs.info('NowForge: seeded ' + inserted + ' quality rule(s).');
})();
