// validations/rules/gatewayOutgoing.rule.js

import {
    getAllElements,
    isGateway,
    isLabel,
    getIncoming,
    getOutgoing,
    isSequenceFlow
} from "../helpers";

/**
 * A decision point splits the flow, so it needs at least two outgoing
 * sequence flows.
 *
 * Merge / join gateways are exempt: bringing several branches back together
 * into a single continuation is a valid pattern, not a decision.
 */
export function gatewayOutgoingRule(modeler) {
    const elements = getAllElements(modeler);
    const errors = [];

    elements.forEach(element => {
        if (isLabel(element)) return;
        if (!isGateway(element)) return;

        const outgoing = getOutgoing(element).filter(isSequenceFlow);
        if (outgoing.length >= 2) return;

        const incoming = getIncoming(element).filter(isSequenceFlow);

        // Join gateway: many in, one out
        if (incoming.length > 1 && outgoing.length === 1) return;

        errors.push({
            elementId: element.id,
            message: "Decision point must have at least two outgoing sequence flows"
        });
    });

    return errors;
}
