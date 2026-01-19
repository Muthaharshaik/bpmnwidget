export function extractTasks(modeler) {
    const elementRegistry = modeler.get("elementRegistry");

    return elementRegistry.getAll()
        .filter(el =>
            el.businessObject &&
            el.businessObject.$type &&
            el.businessObject.$type.endsWith("Task")
        )
        .map(el => {
            const bo = el.businessObject;
            const ext = bo.extensionElements?.values?.[0] || {};

            return {
                taskId: bo.id,
                name: bo.name || "",
                type: bo.$type,
                metrics: {
                    duration: ext.duration || null,
                    sla: ext.sla || null,
                    capacity: ext.capacity || null,
                    bottleneck: ext.bottleneck === "true"
                }
            };
        });
}
