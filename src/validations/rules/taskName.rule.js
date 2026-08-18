// validations/rules/taskName.rule.js

import { getAllElements, isTask, isLabel, getElementName } from "../helpers";

/**
 * Every task must carry a name — an unnamed box tells the reader nothing.
 * Reported once per unnamed task.
 */
export function taskNameRequiredRule(modeler) {
    const elements = getAllElements(modeler);
    const errors = [];

    elements.forEach(element => {
        if (isLabel(element)) return;
        if (!isTask(element)) return;

        if (!getElementName(element)) {
            errors.push({
                elementId: element.id,
                message: "Please name the task in the process map"
            });
        }
    });

    return errors;
}
