export function updateTasks(modeler, updatedTasks) {
    const elementRegistry = modeler.get("elementRegistry");
    const modeling = modeler.get("modeling");
    const moddle = modeler.get("moddle");

    updatedTasks.forEach(task => {
        const element = elementRegistry.get(task.id);
        if (!element) return;

        const ext = moddle.create("bpmn:ExtensionElements", {
            values: [
                moddle.createAny(
                    "custom:taskMetrics",
                    "http://lowcodelabs/schema",
                    {
                        duration: task.metrics?.duration,
                        sla: task.metrics?.sla,
                        capacity: task.metrics?.capacity,
                        bottleneck: task.metrics?.bottleneck
                    }
                )
            ]
        });

        modeling.updateProperties(element, {
            extensionElements: ext
        });
    });
}
