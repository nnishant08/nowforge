import noCurrentUpdateInBefore from './rules/no-current-update-in-before.js';
import useGsNil from './rules/use-gs-nil.js';
import noQueryInLoop from './rules/no-query-in-loop.js';
import noEval from './rules/no-eval.js';
import noClientGliderecord from './rules/no-client-gliderecord.js';
import noHardcodedSysid from './rules/no-hardcoded-sysid.js';
import noSynchronousAjax from './rules/no-synchronous-ajax.js';
import noPackagesUsage from './rules/no-packages-usage.js';

const rules = {
  'no-current-update-in-before': noCurrentUpdateInBefore,
  'use-gs-nil':                  useGsNil,
  'no-query-in-loop':            noQueryInLoop,
  'no-eval':                     noEval,
  'no-client-gliderecord':       noClientGliderecord,
  'no-hardcoded-sysid':          noHardcodedSysid,
  'no-synchronous-ajax':         noSynchronousAjax,
  'no-packages-usage':           noPackagesUsage,
};

const recommendedRules = {
  'nowforge/no-current-update-in-before': 'error',
  'nowforge/use-gs-nil':                  'warn',
  'nowforge/no-query-in-loop':            'error',
  'nowforge/no-eval':                     'error',
  'nowforge/no-client-gliderecord':       'error',
  'nowforge/no-hardcoded-sysid':          'warn',
  'nowforge/no-synchronous-ajax':         'error',
  'nowforge/no-packages-usage':           'error',
} as const;

const strictRules = {
  ...recommendedRules,
  'nowforge/no-hardcoded-sysid': 'error',
  'nowforge/use-gs-nil':         'error',
} as const;

export = {
  rules,
  configs: {
    recommended: {
      plugins: ['nowforge'],
      rules: recommendedRules,
    },
    strict: {
      plugins: ['nowforge'],
      rules: strictRules,
    },
  },
};
