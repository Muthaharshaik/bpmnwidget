import { useEffect } from "react";

/**
 * useTokenSimulation
 *
 * Production-safe hook to wire token simulation lifecycle
 * - No manual controls
 * - No direct modeler.get() crashes
 * - Pure bpmn.io behavior
 */
export function useTokenSimulation(modelerRef) {
  useEffect(() => {
    const modeler = modelerRef.current;
    if (!modeler) return;

    let eventBus;
    let canvas;
    let elementRegistry;

    try {
      eventBus = modeler.get("eventBus");
      canvas = modeler.get("canvas");
      elementRegistry = modeler.get("elementRegistry");
    } catch {
      return;
    }

    /** Clear all token markers */
    const clearMarkers = () => {
      elementRegistry.getAll().forEach(el => {
        canvas.removeMarker(el.id, "bpmn-token-active");
        canvas.removeMarker(el.id, "bpmn-token-flow");
      });
    };

    /** Token enters element */
    const onEnter = ({ element }) => {
      if (!element) return;

      if (element.waypoints) {
        canvas.addMarker(element.id, "bpmn-token-flow");
      } else {
        canvas.addMarker(element.id, "bpmn-token-active");
      }
    };

    /** Token leaves element */
    const onLeave = ({ element }) => {
      if (!element) return;

      canvas.removeMarker(element.id, "bpmn-token-active");
      canvas.removeMarker(element.id, "bpmn-token-flow");
    };

    /** Simulation reset */
    const onReset = () => {
      clearMarkers();
    };

    eventBus.on("tokenSimulation.enter", onEnter);
    eventBus.on("tokenSimulation.leave", onLeave);
    eventBus.on("tokenSimulation.reset", onReset);

    return () => {
      eventBus.off("tokenSimulation.enter", onEnter);
      eventBus.off("tokenSimulation.leave", onLeave);
      eventBus.off("tokenSimulation.reset", onReset);
    };
  }, [modelerRef]);
}
