import { SYSTEM_PROMPT } from './systemPrompt.js';

/**
 * Test plan format the AI returns. We deploy these as ATF Server-Side Script
 * steps inside a single ATF Test record (simpler than mapping each step to a
 * unique ATF step type).
 */
export interface AtfTestPlan {
  testName: string;
  description: string;
  testSteps: Array<{
    order: number;
    stepType: 'setup' | 'action' | 'assertion' | 'cleanup';
    description: string;
    details: Record<string, unknown>;
  }>;
  cleanup?: { description: string; action: string };
}

export interface ScriptContext {
  scriptType: 'Business Rule' | 'Client Script' | 'Script Include' | 'UI Action' | 'Fix Script' | 'Other';
  tableName: string;
  scriptName: string;
  conditions?: string;
  when?: string;
}

export function buildTestGenPrompt(script: string, context: ScriptContext): string {
  return `${SYSTEM_PROMPT}

Generate ATF (Automated Test Framework) test cases for this ServiceNow ${context.scriptType}.

Script context:
- Type: ${context.scriptType}${context.when ? ` (${context.when})` : ''}
- Table: ${context.tableName}
- Name: ${context.scriptName}
- Conditions: ${context.conditions ?? 'None'}

Script:
\`\`\`javascript
${script}
\`\`\`

Generate a test plan as JSON with this exact structure:

{
  "testName": "Test - <script name>",
  "description": "ATF test for <what the script does>",
  "testSteps": [
    {
      "order": 1,
      "stepType": "setup" | "action" | "assertion" | "cleanup",
      "description": "Plain-English description",
      "details": { "action": "create_record" | "update_record" | "assert_field_value" | ..., ... }
    }
  ],
  "cleanup": { "description": "Delete test records", "action": "delete_created_records" }
}

Generate tests for:
1. Happy path
2. Edge cases (empty values, boundary conditions)
3. Error / negative cases

Return ONLY valid JSON. No markdown fences. No explanation.`;
}

/**
 * Convert a generated AtfTestPlan into a single Server-Side Script that can
 * be dropped into an ATF "Run Server Side Script" step. This is the simplest
 * deployment path; mapping each step to a typed ATF step is a v2 follow-up.
 */
export function compilePlanToServerScript(plan: AtfTestPlan, table: string): string {
  const lines: string[] = [];
  lines.push(`// Generated ATF test: ${plan.testName}`);
  lines.push(`// ${plan.description}`);
  lines.push('');
  lines.push('var __created = [];');
  lines.push('try {');

  for (const step of plan.testSteps) {
    lines.push(`  // Step ${step.order} (${step.stepType}): ${step.description}`);
    const d = step.details as { action?: string; table?: string; values?: Record<string, unknown>; field?: string; value?: unknown; expected?: unknown };
    const t = d.table ?? table;

    if (step.stepType === 'setup' && d.action === 'create_record') {
      lines.push('  (function () {');
      lines.push(`    var gr = new GlideRecord('${t}');`);
      lines.push(`    gr.initialize();`);
      for (const [k, v] of Object.entries(d.values ?? {})) {
        lines.push(`    gr.setValue('${k}', ${JSON.stringify(v)});`);
      }
      lines.push(`    var sysId = gr.insert();`);
      lines.push(`    __created.push({ table: '${t}', sys_id: sysId });`);
      lines.push('  })();');
    } else if (step.stepType === 'action' && d.action === 'update_record') {
      lines.push('  (function () {');
      lines.push(`    var gr = new GlideRecord('${t}');`);
      lines.push(`    if (gr.get(__created[__created.length - 1].sys_id)) {`);
      lines.push(`      gr.setValue('${d.field}', ${JSON.stringify(d.value)});`);
      lines.push(`      gr.update();`);
      lines.push('    }');
      lines.push('  })();');
    } else if (step.stepType === 'assertion' && d.action === 'assert_field_value') {
      lines.push('  (function () {');
      lines.push(`    var gr = new GlideRecord('${t}');`);
      lines.push(`    if (gr.get(__created[__created.length - 1].sys_id)) {`);
      lines.push(`      var actual = gr.getDisplayValue('${d.field}');`);
      lines.push(`      gs.assert(actual == ${JSON.stringify(d.expected)},`);
      lines.push(`        'Expected ${d.field}=' + ${JSON.stringify(d.expected)} + ', got ' + actual);`);
      lines.push('    }');
      lines.push('  })();');
    } else {
      lines.push(`  // (Unrecognised step action: ${d.action ?? '?'})`);
    }
    lines.push('');
  }

  lines.push('} finally {');
  lines.push('  // Cleanup');
  lines.push('  for (var i = 0; i < __created.length; i++) {');
  lines.push('    var c = __created[i];');
  lines.push('    var gr = new GlideRecord(c.table);');
  lines.push('    if (gr.get(c.sys_id)) gr.deleteRecord();');
  lines.push('  }');
  lines.push('}');
  return lines.join('\n');
}
