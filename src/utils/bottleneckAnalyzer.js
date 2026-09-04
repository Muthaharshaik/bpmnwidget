const UNIT_SECONDS = {
    second: 1,
    minute: 60,
    hour: 3600,
    day: 86400,
    week: 604800
};

/**
 * Parse duration string "<amount> <unit>" (e.g. "12 Minute", "3 Hours") to total seconds.
 * Seconds is used as the common unit so sub-minute durations are not lost.
 */
export function parseDuration(durationString) {
    if (!durationString || durationString.trim() === "") return 0;

    const parts = durationString.trim().split(/\s+/);
    if (parts.length !== 2) return 0;

    const amount = parseFloat(parts[0]);
    if (!isFinite(amount) || amount <= 0) return 0;

    // Normalize "Hours" / "hour" / "HOUR" to the map key
    const unit = parts[1].toLowerCase().replace(/s$/, "");
    const multiplier = UNIT_SECONDS[unit];
    if (!multiplier) return 0;

    return amount * multiplier;
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
            totalSeconds: parseDuration(task.duration)
        }))
        .filter(task => task.totalSeconds > 0);

    if (tasksWithDuration.length === 0) {
        return;
    }

    //find highest duration
    let maxDuration = 0;
    let bottleneckTask = null;

    for (const task of tasksWithDuration) {
        if (task.totalSeconds > maxDuration) {
            maxDuration = task.totalSeconds;
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
