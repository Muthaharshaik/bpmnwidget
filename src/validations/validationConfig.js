// validations/validationConfig.js

// Severity per rule: "error" | "warning" | "off".
// Errors block saving, warnings do not.
export const validationConfig = {
    "start-event-required": "error",
    "end-event-required": "error",
    "task-name-required": "error",
    "gateway-min-outgoing": "error",
    "no-orphan-elements": "warning",
    "task-multiple-outgoing": "warning"
};
