/**
 * Custom Moddle Extension
 * Defines custom properties for BPMN elements
 */

export const customModdle = {
  name: "custom",
  uri: "http://custom-bpmn",
  prefix: "custom",
  xml: {
    tagAlias: "lowerCase"
  },
  types: [
    {
      name: "CustomTask",
      extends: ["bpmn:Task"],
      properties: [
        {
          name: "taskType",
          isAttr: true,
          type: "String"
        },
        {
          name: "priority",
          isAttr: true,
          type: "String"
        },
        {
          name: "estimatedHours",
          isAttr: true,
          type: "String"
        },
        {
          name: "assignee",
          isAttr: true,
          type: "String"
        },
        {
          name: "department",
          isAttr: true,
          type: "String"
        },
        {
          name: "status",
          isAttr: true,
          type: "String"
        },
        {
          name: "riskLevel",
          isAttr: true,
          type: "String"
        }
      ]
    },
    {
      name: "CustomServiceTask",
      extends: ["bpmn:ServiceTask"],
      properties: [
        {
          name: "apiEndpoint",
          isAttr: true,
          type: "String"
        },
        {
          name: "apiMethod",
          isAttr: true,
          type: "String"
        },
        {
          name: "timeout",
          isAttr: true,
          type: "String"
        }
      ]
    },
    {
      name: "CustomUserTask",
      extends: ["bpmn:UserTask"],
      properties: [
        {
          name: "formKey",
          isAttr: true,
          type: "String"
        },
        {
          name: "dueDate",
          isAttr: true,
          type: "String"
        }
      ]
    }
  ]
};