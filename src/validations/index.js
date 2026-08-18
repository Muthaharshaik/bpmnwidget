// validations/index.js

import { validationConfig } from "./validationConfig";
import { getElementLabel, getTypeLabel, isLabel } from "./helpers";

import { startEventRule } from "./rules/startEvent.rule";
import { endEventRule } from "./rules/endEvent.rule";
import { orphanElementsRule } from "./rules/orphanElements.rule";
import { taskMultipleOutgoingRule } from "./rules/taskOutgoing.rule";
import { taskNameRequiredRule } from "./rules/taskName.rule";
import { gatewayOutgoingRule } from "./rules/gatewayOutgoing.rule";

const ruleRegistry = {
    "start-event-required": startEventRule,
    "end-event-required": endEventRule,
    "task-name-required": taskNameRequiredRule,
    "gateway-min-outgoing": gatewayOutgoingRule,
    "no-orphan-elements": orphanElementsRule,
    "task-multiple-outgoing": taskMultipleOutgoingRule
};

export function validateDiagram(modeler, config = validationConfig) {
  const seen = new Set();
  const results = [];
  const elementRegistry = modeler?.get?.("elementRegistry");

  for (const ruleId in config) {
    const severity = config[ruleId];
    if (severity === "off") continue;

    const ruleFn = ruleRegistry[ruleId];
    if (!ruleFn) continue;

    const violations = ruleFn(modeler) || [];

    violations.forEach(v => {
      // Report against the shape itself, never against its external label
      let element = v.elementId ? elementRegistry?.get(v.elementId) : null;
      if (element && isLabel(element)) {
        element = element.labelTarget || element;
      }

      const elementId = element?.id || v.elementId || null;

      const key = `${ruleId}-${elementId || "global"}`;
      if (seen.has(key)) return;

      seen.add(key);

      results.push({
        ruleId,
        severity,
        elementId,
        // Name shown in the validation panel — falls back to a readable type
        elementName: element ? getElementLabel(element) : null,
        elementType: element ? getTypeLabel(element) : null,
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
