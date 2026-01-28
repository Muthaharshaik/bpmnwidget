// src/utils/customModdle.js

export const customModdle = {
    name: "custom",
    uri: "http://lowcodelabs/schema",
    prefix: "custom",

    types: [
        /**
         * ===============================
         * ATTRIBUTE-BASED EXTENSIONS
         * (Business properties on tasks)
         * ===============================
         */

        {
            name: "CustomTask",
            extends: ["bpmn:Task"],
            properties: [
                { name: "taskType", type: "String", isAttr: true },
                { name: "priority", type: "String", isAttr: true },
                { name: "riskLevel", type: "String", isAttr: true },
                { name: "estimatedHours", type: "String", isAttr: true },
                { name: "assignee", type: "String", isAttr: true },
                { name: "department", type: "String", isAttr: true },
                { name: "status", type: "String", isAttr: true }
            ]
        },

        {
            name: "CustomServiceTask",
            extends: ["bpmn:ServiceTask"],
            properties: [
                { name: "apiEndpoint", type: "String", isAttr: true },
                { name: "apiMethod", type: "String", isAttr: true },
                { name: "timeout", type: "String", isAttr: true }
            ]
        },

        {
            name: "CustomUserTask",
            extends: ["bpmn:UserTask"],
            properties: [
                { name: "formKey", type: "String", isAttr: true },
                { name: "dueDate", type: "String", isAttr: true }
            ]
        },

        /**
         * ===============================
         * EXTENSION ELEMENTS
         * (Metrics / analytics / SLA)
         * ===============================
         */

        {
            name: "taskMetrics",
            superClass: ["Element"],
            properties: [
                {
                    name: "duration",
                    type: "String",
                    isAttr: true
                }
            ]
        }
    ]
};
