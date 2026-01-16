// validations/rules/endEvent.rule.js

import { getAllElements, isType } from "../helpers";

export function endEventRule(modeler) {
    const elements = getAllElements(modeler);
    const endEvents = elements.filter(e => isType(e, "bpmn:EndEvent"));

    if (endEvents.length === 0) {
        return [{
            elementId: null,
            message: "Process must have at least one End Event"
        }];
    }

    return [];
}
