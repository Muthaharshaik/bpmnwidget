// validations/rules/startEvent.rule.js

import { getAllElements, isType } from "../helpers";

export function startEventRule(modeler) {
    const elements = getAllElements(modeler);
    const startEvents = elements.filter(e => isType(e, "bpmn:StartEvent"));

    if (startEvents.length === 0) {
        return [{
            elementId: null,
            message: "Process must have at least one Start Event"
        }];
    }

    return [];
}
