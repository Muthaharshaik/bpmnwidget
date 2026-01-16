// validations/index.js

import { validationConfig } from "./validationConfig";

import { startEventRule } from "./rules/startEvent.rule";
import { endEventRule } from "./rules/endEvent.rule";
import { orphanElementsRule } from "./rules/orphanElements.rule";
import { taskMultipleOutgoingRule } from "./rules/taskOutgoing.rule";

const ruleRegistry = {
    "start-event-required": startEventRule,
    "end-event-required": endEventRule,
    "no-orphan-elements": orphanElementsRule,
    "task-multiple-outgoing": taskMultipleOutgoingRule
};

export function validateDiagram(modeler, config = validationConfig) {
  const seen = new Set();
  const results = [];

  for (const ruleId in config) {
    const severity = config[ruleId];
    if (severity === "off") continue;

    const ruleFn = ruleRegistry[ruleId];
    if (!ruleFn) continue;

    const violations = ruleFn(modeler) || [];

    violations.forEach(v => {
      const key = `${ruleId}-${v.elementId || "global"}`;
      if (seen.has(key)) return;

      seen.add(key);

      results.push({
        ruleId,
        severity,
        elementId: v.elementId || null,
        message: v.message
      });
    });
  }

  return {
    errors: results.filter(r => r.severity === "error"),
    warnings: results.filter(r => r.severity === "warning"),
    all: results
  };
}
