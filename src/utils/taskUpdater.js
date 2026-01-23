export function updateTasks(modeler, updatedTasks) {
  const elementRegistry = modeler.get("elementRegistry");
  const modeling = modeler.get("modeling");
  const moddle = modeler.get("moddle");

  updatedTasks.forEach(task => {
    const element = elementRegistry.get(task.taskId);
    if (!element) return;

    const bo = element.businessObject;
    let extensionElements = bo.extensionElements;

    if (!extensionElements) {
      extensionElements = moddle.create("bpmn:ExtensionElements", {
        values: []
      });
    }

    let taskMetrics = extensionElements.values.find(
      v => v.$type === "custom:taskMetrics"
    );

    if (!taskMetrics) {
      taskMetrics = moddle.create("custom:taskMetrics", {
        duration: ""
      });
      extensionElements.values.push(taskMetrics);
    }

    // Clean and set duration
    const cleanDuration = (task.duration && task.duration !== "[object Object]") 
      ? String(task.duration) 
      : "";
    
    taskMetrics.duration = cleanDuration;

    modeling.updateProperties(element, {
      extensionElements
    });
  });
}