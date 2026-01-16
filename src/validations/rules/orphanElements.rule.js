// validations/rules/orphanElements.rule.js

import {
    getAllElements,
    isFlowNode,
    getIncoming,
    getOutgoing,
    isType,
    isBoundaryEvent
} from "../helpers";

export function orphanElementsRule(modeler) {
    const elements = getAllElements(modeler);
    const errors = [];

    elements.forEach(element => {
        if (!isFlowNode(element)) return;
        if (isType(element, "bpmn:StartEvent")) return;
        if (isType(element, "bpmn:EndEvent")) return;
        if (isBoundaryEvent(element)) return;

        const incoming = getIncoming(element);
        const outgoing = getOutgoing(element);

        if (incoming.length === 0 && outgoing.length === 0) {
            errors.push({
                elementId: element.id,
                message: "Element is not connected to the process flow"
            });
        }
    });

    return errors;
}
