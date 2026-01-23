import { useEffect, useRef, useCallback, createElement } from "react";
import BpmnModeler from "bpmn-js/lib/Modeler";
import { CreateAppendAnythingModule } from 'bpmn-js-create-append-anything';
import ColorPickerModule  from 'bpmn-js-color-picker';
import { validateDiagram as runValidation } from "../validations";
import TokenSimulationModeler from "bpmn-js-token-simulation/lib/modeler";
import { useTokenSimulation } from "../hooks/useTokenSimulation";
import { extractTasks } from "../utils/taskExtractor";
import { updateTasks } from "../utils/taskUpdater";
import { customModdle } from "../utils/customModdle";
import { BpmnPropertiesPanelModule, BpmnPropertiesProviderModule} from "bpmn-js-properties-panel";






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
    onError,
    onModelerReady,
    editorActionsRef,
    onValidate,
    isSimulationMode
}) => {
    const containerRef = useRef(null);
    const modelerRef = useRef(null);
    const lastImportedXmlRef = useRef(null);

    /**
     * Token simulation hook
     */
    useTokenSimulation(modelerRef);

    const fitAndCenter = useCallback((modeler) => {
    if (!modeler) return;

    const canvas = modeler.get("canvas");
    const elementRegistry = modeler.get("elementRegistry");

    // 1️⃣ Fit diagram to viewport
    canvas.zoom("fit-viewport");

    // 2️⃣ Enforce minimum zoom (CRITICAL FIX)
    const MIN_ZOOM = 0.5;
    let zoom = canvas.zoom();

    if (zoom < MIN_ZOOM) {
        canvas.zoom(MIN_ZOOM);
        zoom = MIN_ZOOM;
    }

    // 3️⃣ Collect diagram elements
    const elements = elementRegistry.getAll().filter(e => e.x != null);
    if (!elements.length) return;

    const minX = Math.min(...elements.map(e => e.x));
    const minY = Math.min(...elements.map(e => e.y));
    const maxX = Math.max(...elements.map(e => e.x + e.width));
    const maxY = Math.max(...elements.map(e => e.y + e.height));

    // 4️⃣ Re-read viewbox AFTER zoom correction
    const viewbox = canvas.viewbox();

    // 5️⃣ Center diagram
    canvas.viewbox({
        x: minX + (maxX - minX) / 2 - viewbox.width / 2,
        y: minY + (maxY - minY) / 2 - viewbox.height / 2,
        width: viewbox.width,
        height: viewbox.height
    });
    }, []);



    /**
     * Initialize the BPMN Modeler (runs once on mount)
     */
    useEffect(() => {
        if (!containerRef.current) return;

        const modeler = new BpmnModeler({
            container: containerRef.current,
            propertiesPanel: {
                parent: '#js-properties-panel'
            },
            additionalModules: [
                CreateAppendAnythingModule,
                ColorPickerModule,
                TokenSimulationModeler,
                BpmnPropertiesPanelModule, 
                BpmnPropertiesProviderModule
            ],
            moddleExtensions: {
                custom: customModdle
            }
        });

        modelerRef.current = modeler;

        const xmlToLoad = initialXml || DEFAULT_BPMN_XML;
        lastImportedXmlRef.current = xmlToLoad;
        
        modeler.importXML(xmlToLoad)
            .then(({ warnings }) => {
                if (warnings.length) {
                    console.warn("BPMN Import Warnings:", warnings);
                }

                const canvas = modeler.get("canvas");
                const eventBus = modeler.get("eventBus");

                // Listen for subprocess drill-down navigation
                eventBus.on('root.set', function() {
                });

                fitAndCenter(modeler)

                // Notify parent that modeler is ready
                if (onModelerReady) {
                    onModelerReady({
                        exportXML,
                        exportSVG,
                        validateDiagram,
                        focusElement,
                        applyValidationMarkers,
                        fitAndCenter: () => fitAndCenter(modelerRef.current),
                        getModeler: () => modelerRef.current,
                        extractTasks: () => extractTasks(modelerRef.current),
                        updateTasks: (tasks) => updateTasks(modelerRef.current, tasks)
                    });
                }
            })
            .catch((err) => {
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
    }, []); // Empty deps = runs once

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

        try {
            const keyboard = modelerRef.current.get('keyboard');
            
            console.info('Keyboard module active');
            
            // Add custom keyboard shortcuts if needed
            keyboard.addListener(({ keyEvent, target }) => {

            //Ignore typing in inputs / text areas
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

            // IMPORTANT: get actions from editor
            const actions = editorActionsRef?.current;
            if (!actions) return false;

            // Download BPMN
            if (isCmdOrCtrl && key === "s") {
                keyEvent.preventDefault();
                actions.downloadBPMN?.();
                return true;
            }

            // Download PDF
            if (isCmdOrCtrl && key === "d") {
                keyEvent.preventDefault();
                actions.downloadPDF?.();
                return true;
            }

            // Download SVG
            if (isCmdOrCtrl && key === "i") {
                keyEvent.preventDefault();
                actions.downloadSVG?.();
                return true;
            }

            return false; // let BPMN handle everything else
        });

            
        } catch (error) {
            console.error(' Keyboard module error:', error);
        }
    }, []);

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

        modelerRef.current.importXML(xmlToLoad)
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
        .catch((err) => {
            console.error("Error updating BPMN diagram:", err);
            onError?.(err);
        });
    }, [initialXml, onError]);

    

    useEffect(() => {
        if (!modelerRef.current) return;

        const modeler = modelerRef.current;
        const canvas = modeler.get("canvas");

        if (isSimulationMode) {
            fitAndCenter(modeler)
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

            modelerRef.current.saveXML({ format: true })
                .then(({ xml }) => {
                    resolve(xml);
                })
                .catch((err) => {
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

    const focusElement = useCallback((elementId) => {
        if (!modelerRef.current || !elementId) return;

        const canvas = modelerRef.current.get("canvas");
        const elementRegistry = modelerRef.current.get("elementRegistry");

        const element = elementRegistry.get(elementId);
        if (!element) return;

        const viewbox = canvas.viewbox();

        canvas.viewbox({
            x: element.x + element.width / 2 - viewbox.width / 2,
            y: element.y + element.height / 2 - viewbox.height / 2,
            width: viewbox.width,
            height: viewbox.height
        });

        canvas.addMarker(elementId, "bpmn-focus");
        setTimeout(() => {
            canvas.removeMarker(elementId, "bpmn-focus");
        }, 1200);
    }, []);



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

            modelerRef.current.saveSVG()
                .then(({ svg }) => {
                        resolve(svg);
                })
                .catch((err) => {
                    console.error("Error exporting BPMN SVG:", err);
                    reject(err);
                });
        });
    }, []);

        return (
            <div style={{ display: 'flex', height: '100%' }}>
                <div 
                    ref={containerRef} 
                    className="bpmn-modeler-container"
                    style={{ flex: 1 }}
                />
                <div 
                    id="js-properties-panel" 
                    style={{ width: '300px', overflow: 'auto', border:'1.2px solid lightgrey', margin:'4px' }}
                />
            </div>
        );
};

export default BpmnModelerComponent;