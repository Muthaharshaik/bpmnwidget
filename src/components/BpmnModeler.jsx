import { useEffect, useRef, useCallback, createElement } from "react";
import BpmnModeler from "bpmn-js/lib/Modeler";
import { getBBox } from "diagram-js/lib/util/Elements";
import { CreateAppendAnythingModule } from "bpmn-js-create-append-anything";
import ColorPickerModule from "bpmn-js-color-picker";
import { validateDiagram as runValidation } from "../validations";
import TokenSimulationModeler from "bpmn-js-token-simulation/lib/modeler";
import { useTokenSimulation } from "../hooks/useTokenSimulation";
import { extractTasks } from "../utils/taskExtractor";
import { updateTasks } from "../utils/taskUpdater";
import { customModdle } from "../utils/customModdle";
import { BpmnPropertiesPanelModule, BpmnPropertiesProviderModule } from "bpmn-js-properties-panel";
import CustomModules from "../custom";
import ReadOnlyModule from "../custom/ReadOnlyModule";
import EmbeddedComments from 'bpmn-js-embedded-comments';



/**
 * BpmnModeler Component
 *
 * This component wraps the bpmn-js Modeler library.
 * It handles the initialization, rendering, and interaction with the BPMN diagram.
 *
 * Props:
 * - initialXml: The initial BPMN XML to load (optional)
 * - onError: Callback function when an error occurs
 * - onModelerReady: Callback when modeler is initialized
 */

// Default empty BPMN diagram template
const DEFAULT_BPMN_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" 
                  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" 
                  id="Definitions_1" 
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Main_Process" isExecutable="true">
    <bpmn:startEvent id="StartEvent_1"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="173" y="102" width="36" height="36"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

export const BpmnModelerComponent = ({
    initialXml,
    showComments,
    onError,
    onModelerReady,
    editorActionsRef,
    onValidate,
    isSimulationMode,
    isReadOnly,
    onTaskAction
}) => {
    const containerRef = useRef(null);
    const modelerRef = useRef(null);
    const lastImportedXmlRef = useRef(null);
    const onTaskActionRef = useRef(onTaskAction);
    // Element currently highlighted from the validation panel
    const focusedElementRef = useRef(null);

    /**
     * Token simulation hook
     */
    useTokenSimulation(modelerRef);

    const fitAndCenter = useCallback(modeler => {
        if (!modeler) return;

        const canvas = modeler.get("canvas");
        const elementRegistry = modeler.get("elementRegistry");

        // Fit diagram to viewport
        canvas.zoom("fit-viewport");

        // Enforce minimum zoom (CRITICAL FIX)
        const MIN_ZOOM = 0.5;
        let zoom = canvas.zoom();

        if (zoom < MIN_ZOOM) {
            canvas.zoom(MIN_ZOOM);
            zoom = MIN_ZOOM;
        }

        // Collect diagram elements
        const elements = elementRegistry.getAll().filter(e => e.x != null);
        if (!elements.length) return;

        const minX = Math.min(...elements.map(e => e.x));
        const minY = Math.min(...elements.map(e => e.y));
        const maxX = Math.max(...elements.map(e => e.x + e.width));
        const maxY = Math.max(...elements.map(e => e.y + e.height));

        // Re-read viewbox AFTER zoom correction
        const viewbox = canvas.viewbox();

        // 5️⃣ Center diagram
        canvas.viewbox({
            x: minX + (maxX - minX) / 2 - viewbox.width / 2,
            y: minY + (maxY - minY) / 2 - viewbox.height / 2,
            width: viewbox.width,
            height: viewbox.height
        });
    }, []);

    useEffect(() => {
        onTaskActionRef.current = onTaskAction;
    }, [onTaskAction]);
    /**
     * Initialize the BPMN Modeler (runs once on mount)
     */
    useEffect(() => {
        if (!containerRef.current) return;

        if (modelerRef.current) {
            modelerRef.current.destroy();
            modelerRef.current = null;
        }

        const additionalModules = [
            CreateAppendAnythingModule,
            ColorPickerModule,
            TokenSimulationModeler,
            BpmnPropertiesPanelModule,
            BpmnPropertiesProviderModule,
            CustomModules
        ]

        if (showComments) additionalModules.push(EmbeddedComments);

        // Disables all modeling (move, resize, rename, delete, create) while
        // keeping selection, pan, zoom and token simulation usable.
        if (isReadOnly) additionalModules.push(ReadOnlyModule);

        const modeler = new BpmnModeler({
            container: containerRef.current,
            propertiesPanel: {
                parent: "#js-properties-panel"
            },
            additionalModules,
            moddleExtensions: {
                custom: customModdle
            },
            ...(showComments && {
            embeddedComments: {
                editable: !isReadOnly,
                overlayConfig: {
                show: { minZoom: 0.5 }
                }
            }
            })
        });

        modelerRef.current = modeler;

        const xmlToLoad = initialXml || DEFAULT_BPMN_XML;
        lastImportedXmlRef.current = xmlToLoad;

        modeler
            .importXML(xmlToLoad)
            .then(({ warnings }) => {
                if (warnings.length) {
                    console.warn("BPMN Import Warnings:", warnings);
                }

                const canvas = modeler.get("canvas");
                const eventBus = modeler.get("eventBus");

                // Listen for subprocess drill-down navigation
                eventBus.on("root.set", function () {});

                fitAndCenter(modeler);
                eventBus.on("element.click", ({ element }) => {
                    const type = element?.businessObject?.$type || "";
                    if (type.endsWith("Task")) {
                        onTaskActionRef.current?.(element.businessObject.id); // ← always fresh
                    }
                });

                // Notify parent that modeler is ready
                if (onModelerReady) {
                    onModelerReady({
                        exportXML,
                        exportSVG,
                        validateDiagram,
                        focusElement,
                        clearFocus,
                        applyValidationMarkers,
                        fitAndCenter: () => fitAndCenter(modelerRef.current),
                        getModeler: () => modelerRef.current,
                        extractTasks: () => extractTasks(modelerRef.current),
                        updateTasks: tasks => updateTasks(modelerRef.current, tasks)
                    });
                }
            })
            .catch(err => {
                console.error("Error importing BPMN diagram:", err);
                if (onError) {
                    onError(err);
                }
            });

        // Cleanup on unmount
        return () => {
            if (modelerRef.current) {
                modelerRef.current.destroy();
            }
        };
    }, [showComments,isReadOnly]); // Empty deps = runs once

    
    // /* =====================================================
    //     🔥 LISTEN FOR COMMENT CHANGES
    //     ===================================================== */
    // useEffect(() => {
    //     if (!modelerRef.current) return;

    //     const eventBus = modelerRef.current.get("eventBus");

    //     const handler = ({ elementId }) => {
    //     injectDeleteButtons(elementId);
    //     };

    //     eventBus.on("comments.updated", handler);

    //     return () => {
    //     eventBus.off("comments.updated", handler);
    //     };
    // }, [injectDeleteButtons]);


    useEffect(() => {
        if (!modelerRef.current) return;

        const modeler = modelerRef.current;
        const eventBus = modeler.get("eventBus");

        const runAutoValidation = async () => {
            const { errors, warnings } = await runValidation(modeler);
            onValidate?.(errors, warnings);
        };

        // Trigger on any modeling change
        eventBus.on("commandStack.changed", runAutoValidation);

        return () => {
            eventBus.off("commandStack.changed", runAutoValidation);
        };
    }, []);


    /**
     * Setup keyboard shortcuts AFTER modeler is initialized
     */
    useEffect(() => {
        if (!modelerRef.current) return;

        let keyboard;

        try {
            keyboard = modelerRef.current.get("keyboard");
            if (!keyboard) return;

            console.log("Keyboard module active");

            const handler = ({ keyEvent, target }) => {
                // Ignore typing in inputs / text areas
                if (
                    target &&
                    (target.tagName === "INPUT" ||
                    target.tagName === "TEXTAREA" ||
                    target.isContentEditable)
                ) {
                    return false;
                }

                const isCmdOrCtrl = keyEvent.ctrlKey || keyEvent.metaKey;
                if (!isCmdOrCtrl) return false;

                const key = keyEvent.key.toLowerCase();
                const actions = editorActionsRef?.current;
                if (!actions) return false;

                // Ctrl + S → Download BPMN
                if (key === "s") {
                    keyEvent.preventDefault();
                    actions.downloadBPMN?.();
                    return true;
                }

                // Ctrl + D → Download PDF
                if (key === "d") {
                    keyEvent.preventDefault();
                    actions.downloadPDF?.();
                    return true;
                }

                // Ctrl + I → Download SVG
                if (key === "i") {
                    keyEvent.preventDefault();
                    actions.downloadSVG?.();
                    return true;
                }

                return false;
            };

            keyboard.addListener(handler);

            return () => {
                keyboard.removeListener(handler); // 🔥 IMPORTANT
            };
        } catch (error) {
            console.error("Keyboard module error:", error);
        }
    }, [showComments]); // ✅ correct dependency


    /**
     * Handle XML updates (for file opens and diagram switches)
     * CRITICAL: Only re-import if XML actually changed
     */
    useEffect(() => {
        if (!modelerRef.current) return;
        if (!initialXml) return;

        // Skip if XML hasn't changed (prevents unwanted re-imports)
        if (initialXml === lastImportedXmlRef.current || initialXml === undefined) {
            return;
        }

        console.log("Importing new diagram XML");
        const xmlToLoad = initialXml || DEFAULT_BPMN_XML;
        lastImportedXmlRef.current = initialXml;

        modelerRef.current
            .importXML(xmlToLoad)
            .then(async () => {
                const modeler = modelerRef.current;
                // RESET TOKEN SIMULATION ON NEW DIAGRAM
                try {
                    modeler.get("tokenSimulation")?.reset();
                } catch {
                    // tokenSimulation may not be available yet – safe to ignore
                }
                fitAndCenter(modeler);
                const canvas = modeler.get("canvas");
                const elementRegistry = modeler.get("elementRegistry");

                // 1️⃣ CLEAR markers from previous diagram
                elementRegistry.getAll().forEach(e => {
                    canvas.removeMarker(e.id, "bpmn-error");
                    canvas.removeMarker(e.id, "bpmn-warning");
                });

                // 2️⃣ RUN validation for the NEW diagram
                const { errors, warnings } = await runValidation(modeler);

                // 3️⃣ APPLY new markers
                errors.forEach(e => {
                    if (e.elementId) {
                        canvas.addMarker(e.elementId, "bpmn-error");
                    }
                });

                warnings.forEach(w => {
                    if (w.elementId) {
                        canvas.addMarker(w.elementId, "bpmn-warning");
                    }
                });

                // 4️⃣ UPDATE editor validation panel
                onValidate?.(errors, warnings);
            })
            .catch(err => {
                console.error("Error updating BPMN diagram:", err);
                onError?.(err);
            });
    }, [initialXml, onError]);

    useEffect(() => {
        if (!modelerRef.current) return;

        const modeler = modelerRef.current;
        const canvas = modeler.get("canvas");

        if (isSimulationMode) {
            fitAndCenter(modeler);
        }
    }, [isSimulationMode]);

    useEffect(() => {
        if (!modelerRef.current) return;
        if (isSimulationMode) return; // Don't attach during simulation
        
        // Re-attach properties panel to the (potentially new) DOM element
        const propertiesPanel = modelerRef.current.get('propertiesPanel');
        if (propertiesPanel) {
            propertiesPanel.attachTo('#js-properties-panel');
        }
    }, [isSimulationMode]);
    /**
     * Method to export the current diagram as XML
     * This will be called by the parent component (BpmnEditor) when saving
     */
    const exportXML = useCallback(() => {
        return new Promise((resolve, reject) => {
            if (!modelerRef.current) {
                reject(new Error("Modeler not initialized"));
                return;
            }

            modelerRef.current
                .saveXML({ format: true })
                .then(({ xml }) => {
                    resolve(xml);
                })
                .catch(err => {
                    console.error("Error exporting BPMN XML:", err);
                    reject(err);
                });
        });
    }, []);

    const validateDiagram = useCallback(() => {
        if (!modelerRef.current) {
            throw new Error("Modeler not initialized");
        }
        return runValidation(modelerRef.current);
    }, []);

    const applyValidationMarkers = useCallback((errors = [], warnings = []) => {
        if (!modelerRef.current) return;

        const canvas = modelerRef.current.get("canvas");
        const elementRegistry = modelerRef.current.get("elementRegistry");

        // 1️⃣ Clear existing markers
        elementRegistry.getAll().forEach(e => {
            canvas.removeMarker(e.id, "bpmn-error");
            canvas.removeMarker(e.id, "bpmn-warning");
        });

        // 2️⃣ Add error markers
        errors.forEach(e => {
            if (e.elementId) {
                canvas.addMarker(e.elementId, "bpmn-error");
            }
        });

        // 3️⃣ Add warning markers
        warnings.forEach(w => {
            if (w.elementId) {
                canvas.addMarker(w.elementId, "bpmn-warning");
            }
        });
    }, []);

    /**
     * Remove the highlight left behind by the last focusElement call.
     */
    const clearFocus = useCallback(() => {
        const elementId = focusedElementRef.current;
        if (!elementId || !modelerRef.current) return;

        focusedElementRef.current = null;

        const canvas = modelerRef.current.get("canvas");
        if (canvas.findRoot(elementId)) {
            canvas.removeMarker(elementId, "bpmn-focus");
        }
    }, []);

    /**
     * Bring an element into view without disturbing the diagram more than
     * necessary:
     *   • already comfortably visible → the canvas does not move at all
     *   • otherwise                   → the element is centered in the viewport
     *
     * canvas.scrollToElement() is deliberately not used here: it pushes the
     * element into the top-left corner whenever the padding does not fit the
     * viewport, which happens on the short canvas left by the open bottom panel.
     */
    const revealElement = useCallback((canvas, element, forceCenter) => {
        const viewbox = canvas.viewbox();
        const zoom = canvas.zoom();
        const bbox = getBBox(element);

        // A margin so the element never sits right on the viewport edge
        const padX = Math.min(80, viewbox.width * 0.15);
        const padY = Math.min(80, viewbox.height * 0.15);

        const isComfortablyVisible =
            bbox.x >= viewbox.x + padX &&
            bbox.y >= viewbox.y + padY &&
            bbox.x + bbox.width <= viewbox.x + viewbox.width - padX &&
            bbox.y + bbox.height <= viewbox.y + viewbox.height - padY;

        if (!forceCenter && isComfortablyVisible) return;

        const dx = bbox.x + bbox.width / 2 - (viewbox.x + viewbox.width / 2);
        const dy = bbox.y + bbox.height / 2 - (viewbox.y + viewbox.height / 2);

        canvas.scroll({ dx: -dx * zoom, dy: -dy * zoom });
    }, []);

    /**
     * Reveal an element on the canvas: drill into the right root (sub process /
     * pool), bring it into view, select it and keep it highlighted until the
     * next focus. Used when clicking a validation error / warning.
     */
    const focusElement = useCallback(elementId => {
        if (!modelerRef.current || !elementId) return;

        const canvas = modelerRef.current.get("canvas");
        const elementRegistry = modelerRef.current.get("elementRegistry");
        const selection = modelerRef.current.get("selection");

        const element = elementRegistry.get(elementId);
        if (!element) return;

        clearFocus();

        // The element may live on another plane (sub process, pool)
        const root = canvas.findRoot(element);
        const rootChanged = root && root !== canvas.getRootElement();
        if (rootChanged) {
            canvas.setRootElement(root);
        }

        if (root !== element) {
            revealElement(canvas, element, rootChanged);
        }

        focusedElementRef.current = elementId;
        canvas.addMarker(elementId, "bpmn-focus");

        // Selecting also opens the properties panel on that element.
        selection?.select(element);
    }, [clearFocus, revealElement]);

    /**
     * Export current diagram as SVG with full diagram bounds
     * This ensures the entire diagram is captured, not just visible viewport
     */
    const exportSVG = useCallback(() => {
        return new Promise((resolve, reject) => {
            if (!modelerRef.current) {
                reject(new Error("Modeler not initialized"));
                return;
            }

            modelerRef.current
                .saveSVG()
                .then(({ svg }) => {
                    resolve(svg);
                })
                .catch(err => {
                    console.error("Error exporting BPMN SVG:", err);
                    reject(err);
                });
        });
    }, []);

    return <div ref={containerRef} className="bpmn-modeler-container" data-readonly={isReadOnly}></div>;
};

export default BpmnModelerComponent;
