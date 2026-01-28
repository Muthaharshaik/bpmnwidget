import { is } from "bpmn-js/lib/util/ModelUtil";

/**
 * Custom Context Pad Provider
 * Adds custom actions to the context pad (appears when clicking an element)
 */
export default class CustomContextPad {
    constructor(config, contextPad, create, elementFactory, injector, translate, modeling, bpmnFactory) {
        this.create = create;
        this.elementFactory = elementFactory;
        this.translate = translate;
        this.modeling = modeling;
        this.bpmnFactory = bpmnFactory;

        if (config.autoPlace !== false) {
            this.autoPlace = injector.get("autoPlace", false);
        }

        contextPad.registerProvider(this);
    }

    getContextPadEntries(element) {
        const { autoPlace, create, elementFactory, translate, modeling, bpmnFactory } = this;

        function appendTask(taskType, priority) {
            return function (event, element) {
                const businessObject = bpmnFactory.create("bpmn:Task");

                businessObject.set("custom:taskType", taskType);
                businessObject.set("custom:priority", priority);

                const shape = elementFactory.createShape({
                    type: "bpmn:Task",
                    businessObject: businessObject
                });

                if (autoPlace) {
                    autoPlace.append(element, shape);
                } else {
                    create.start(event, shape, element);
                }
            };
        }

        function setPriority(priority) {
            return function (event, element) {
                modeling.updateProperties(element, {
                    "custom:priority": priority
                });
            };
        }

        function setRiskLevel(riskLevel) {
            return function (event, element) {
                modeling.updateProperties(element, {
                    "custom:riskLevel": riskLevel
                });
            };
        }

        const actions = {};

        // Only show for tasks
        if (is(element, "bpmn:Task") || is(element, "bpmn:ServiceTask") || is(element, "bpmn:UserTask")) {
            // Set priority actions
            actions["set-priority-high"] = {
                group: "custom",
                className: "bpmn-icon-intermediate-event-none",
                title: translate("Set High Priority"),
                action: {
                    click: setPriority("high")
                }
            };

            actions["set-priority-low"] = {
                group: "custom",
                className: "bpmn-icon-intermediate-event-none",
                title: translate("Set Low Priority"),
                action: {
                    click: setPriority("low")
                }
            };

            // Set risk level actions
            actions["set-risk-high"] = {
                group: "custom",
                className: "bpmn-icon-intermediate-event-none",
                title: translate("Set High Risk"),
                action: {
                    click: setRiskLevel("high")
                }
            };
        }

        // Append custom tasks
        if (is(element, "bpmn:FlowNode")) {
            if (!is(element, "bpmn:EndEvent")) {
                actions["append-review-task"] = {
                    group: "model",
                    className: "bpmn-icon-user-task",
                    title: translate("Append Review Task"),
                    action: {
                        click: appendTask("review", "medium"),
                        dragstart: appendTask("review", "medium")
                    }
                };

                actions["append-approval-task"] = {
                    group: "model",
                    className: "bpmn-icon-manual-task",
                    title: translate("Append Approval Task"),
                    action: {
                        click: appendTask("approval", "high"),
                        dragstart: appendTask("approval", "high")
                    }
                };
            }
        }

        return actions;
    }
}

CustomContextPad.$inject = [
    "config",
    "contextPad",
    "create",
    "elementFactory",
    "injector",
    "translate",
    "modeling",
    "bpmnFactory"
];
