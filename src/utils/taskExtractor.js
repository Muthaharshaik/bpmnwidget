export function extractTasks(modeler) {
  const elementRegistry = modeler.get("elementRegistry");

  return elementRegistry.getAll()
    .filter(el => el.businessObject?.$type?.endsWith("Task"))
    .map(el => {
      const bo = el.businessObject;

      const extElements = bo.extensionElements?.values || [];
      const taskMetrics = extElements.find(
        v => v.$type === "custom:taskMetrics"
      );

      return {
        taskId: bo.id,
        name: bo.name || "",
        type: bo.$type,
        duration: taskMetrics?.duration || ""  // ✅ This will work fine!
      };
    });
}