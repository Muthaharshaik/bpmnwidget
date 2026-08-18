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

export function isGateway(element) {
    return !!element?.businessObject?.$type?.endsWith("Gateway");
}

export function isSequenceFlow(element) {
    return element?.businessObject?.$type === "bpmn:SequenceFlow";
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

/**
 * External labels (e.g. "Gateway_1_label") are separate diagram elements that
 * share the businessObject of the shape they belong to. They must never be
 * validated on their own.
 */
export function isLabel(element) {
    return element?.type === "label" || !!element?.labelTarget;
}

const TYPE_LABELS = {
    "bpmn:StartEvent": "Start Event",
    "bpmn:EndEvent": "End Event",
    "bpmn:IntermediateThrowEvent": "Intermediate Event",
    "bpmn:IntermediateCatchEvent": "Intermediate Event",
    "bpmn:BoundaryEvent": "Boundary Event",
    "bpmn:Task": "Task",
    "bpmn:UserTask": "User Task",
    "bpmn:ServiceTask": "Service Task",
    "bpmn:ScriptTask": "Script Task",
    "bpmn:BusinessRuleTask": "Business Rule Task",
    "bpmn:SendTask": "Send Task",
    "bpmn:ReceiveTask": "Receive Task",
    "bpmn:ManualTask": "Manual Task",
    "bpmn:CallActivity": "Call Activity",
    "bpmn:SubProcess": "Sub Process",
    "bpmn:ExclusiveGateway": "Exclusive Gateway",
    "bpmn:InclusiveGateway": "Inclusive Gateway",
    "bpmn:ParallelGateway": "Parallel Gateway",
    "bpmn:EventBasedGateway": "Event Based Gateway",
    "bpmn:ComplexGateway": "Complex Gateway",
    "bpmn:SequenceFlow": "Sequence Flow",
    "bpmn:MessageFlow": "Message Flow",
    "bpmn:DataObjectReference": "Data Object",
    "bpmn:DataStoreReference": "Data Store",
    "bpmn:Participant": "Pool",
    "bpmn:Lane": "Lane",
    "bpmn:TextAnnotation": "Annotation",
    "bpmn:Group": "Group"
};

/**
 * Human readable element type, e.g. "bpmn:ExclusiveGateway" → "Exclusive Gateway"
 */
export function getTypeLabel(element) {
    const type = element?.businessObject?.$type || element?.type || "";
    if (TYPE_LABELS[type]) return TYPE_LABELS[type];

    return (
        type
            .replace(/^bpmn:/, "")
            .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
            .trim() || "Element"
    );
}

export function getElementName(element) {
    const name = element?.businessObject?.name;
    return typeof name === "string" ? name.trim() : "";
}

/**
 * What the validation panel shows for an element: its name when it has one,
 * otherwise a readable type so the user never sees a raw technical id.
 */
export function getElementLabel(element) {
    if (!element) return "";

    const name = getElementName(element);
    if (name) return name;

    return `Unnamed ${getTypeLabel(element)}`;
}
