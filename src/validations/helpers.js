// validations/helpers.js

export function getAllElements(modeler) {
    return modeler.get("elementRegistry").getAll();
}

export function isType(element, type) {
    return element?.businessObject?.$type === type;
}

export function isTask(element) {
    return element?.businessObject?.$type?.endsWith("Task");
}

export function isFlowNode(element) {
    const type = element?.businessObject?.$type || "";
    return (
        type.endsWith("Task") ||
        type.endsWith("Event") ||
        type.endsWith("Gateway") ||
        type.endsWith("SubProcess")
    );
}

export function getIncoming(element) {
    return element?.incoming || [];
}

export function getOutgoing(element) {
    return element?.outgoing || [];
}

export function isBoundaryEvent(element) {
    return !!element?.businessObject?.attachedToRef;
}
