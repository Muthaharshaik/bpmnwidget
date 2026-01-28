/**
 * Custom Palette Provider
 * Adds custom entries to the BPMN palette
 */
export default class CustomPalette {
    constructor(bpmnFactory, create, elementFactory, palette, translate, modeling) {
        this.bpmnFactory = bpmnFactory;
        this.create = create;
        this.elementFactory = elementFactory;
        this.translate = translate;
        this.modeling = modeling;

        palette.registerProvider(this);
    }

    getPaletteEntries(element) {
        const { bpmnFactory, create, elementFactory, translate, modeling } = this;

        function createTask(taskType, priority) {
            return function (event) {
                const businessObject = bpmnFactory.create("bpmn:Task");

                // Set custom properties
                businessObject.set("custom:taskType", taskType);
                businessObject.set("custom:priority", priority);

                const shape = elementFactory.createShape({
                    type: "bpmn:Task",
                    businessObject: businessObject
                });

                create.start(event, shape);
            };
        }

        function createServiceTask(apiMethod) {
            return function (event) {
                const businessObject = bpmnFactory.create("bpmn:ServiceTask");

                // Set custom properties
                businessObject.set("custom:apiMethod", apiMethod);
                businessObject.set("custom:taskType", "api");

                const shape = elementFactory.createShape({
                    type: "bpmn:ServiceTask",
                    businessObject: businessObject
                });

                create.start(event, shape);
            };
        }

        return {
            "create.high-priority-task": {
                group: "activity",
                className: "bpmn-icon-task red",
                title: translate("Create High Priority Task"),
                action: {
                    dragstart: createTask("manual", "high"),
                    click: createTask("manual", "high")
                }
            },
            "create.api-task": {
                group: "activity",
                className: "bpmn-icon-service-task",
                title: translate("Create API Service Task"),
                action: {
                    dragstart: createServiceTask("GET"),
                    click: createServiceTask("GET")
                }
            },
            "create.review-task": {
                group: "activity",
                className: "bpmn-icon-user-task",
                title: translate("Create Review Task"),
                action: {
                    dragstart: createTask("review", "medium"),
                    click: createTask("review", "medium")
                }
            },
            "create.approval-task": {
                group: "activity",
                className: "bpmn-icon-manual-task",
                title: translate("Create Approval Task"),
                action: {
                    dragstart: createTask("approval", "high"),
                    click: createTask("approval", "high")
                }
            }
        };
    }
}

CustomPalette.$inject = ["bpmnFactory", "create", "elementFactory", "palette", "translate", "modeling"];
