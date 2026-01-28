/**
 * Parse duration string "HH:MM" to total minutes
 */
export function parseDuration(durationString) {
    if (!durationString || durationString.trim() === "") return 0;

    const parts = durationString.split(":");
    if (parts.length !== 2) return 0;

    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;

    return hours * 60 + minutes;
}

/**
 * Apply red color to tasks with highest duration
 */
export function applyBottleneckColors(modeler, tasks) {
    const canvas = modeler.get("canvas");
    const elementRegistry = modeler.get("elementRegistry");

    // Clear existing bottleneck markers
    elementRegistry.getAll().forEach(element => {
        if (element.businessObject?.$type?.endsWith("Task")) {
            canvas.removeMarker(element.id, "bottleneck-high");
        }
    });

    // Find tasks with durations
    const tasksWithDuration = tasks
        .map(task => ({
            ...task,
            totalMinutes: parseDuration(task.duration)
        }))
        .filter(task => task.totalMinutes > 0);

    if (tasksWithDuration.length === 0) {
        return;
    }

    //find highest duration
    let maxDuration = 0;
    let bottleneckTask = null;

    for (const task of tasksWithDuration) {
        if (task.totalMinutes > maxDuration) {
            maxDuration = task.totalMinutes;
            bottleneckTask = task;
        }
    }

    if (bottleneckTask) {
        const element = elementRegistry.get(bottleneckTask.taskId);
        if (element) {
            canvas.addMarker(element.id, "bottleneck-high");
        }
    }
}

/**
 * Clear bottleneck colors
 */
export function clearBottleneckColors(modeler) {
    const canvas = modeler.get("canvas");
    const elementRegistry = modeler.get("elementRegistry");

    elementRegistry.getAll().forEach(element => {
        if (element.businessObject?.$type?.endsWith("Task")) {
            canvas.removeMarker(element.id, "bottleneck-high");
        }
    });
}
