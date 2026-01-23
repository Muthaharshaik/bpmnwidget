// src/utils/customModdle.js
export const customModdle = {
  name: "custom",
  uri: "http://lowcodelabs/schema",
  prefix: "custom",
  types: [
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