// validations/rules/taskOutgoing.rule.js

import { getAllElements, isTask, getOutgoing } from "../helpers";

export function taskMultipleOutgoingRule(modeler) {
    const elements = getAllElements(modeler);
    const warnings = [];

    elements.forEach(element => {
        if (!isTask(element)) return;

        const outgoing = getOutgoing(element)
            .filter(f => f.businessObject.$type === "bpmn:SequenceFlow");

        const unconditional = outgoing.filter(
            f => !f.businessObject.conditionExpression
        );

        if (unconditional.length > 1) {
            warnings.push({
                elementId: element.id,
                message:
                    "Task has multiple unconditional outgoing flows. Consider using a Gateway."
            });
        }
    });

    return warnings;
}
