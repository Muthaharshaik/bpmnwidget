import { useEffect, useRef, useCallback, createElement } from "react";
import BpmnModeler from "bpmn-js/lib/Modeler";
import { CreateAppendAnythingModule } from 'bpmn-js-create-append-anything';
import ColorPickerModule  from 'bpmn-js-color-picker';
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
  <bpmn:process id="Main_Process" isExecutable="false">
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
    onModelerReady 
}) => {
    const containerRef = useRef(null);
    const modelerRef = useRef(null);
    const lastImportedXmlRef = useRef(null);

    /**
     * Initialize the BPMN Modeler (runs once on mount)
     */
    useEffect(() => {
        if (!containerRef.current) return;

        const modeler = new BpmnModeler({
            container: containerRef.current,
            additionalModules: [
                CreateAppendAnythingModule,
                ColorPickerModule
            ]
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

                canvas.zoom("fit-viewport");

                // Notify parent that modeler is ready
                if (onModelerReady) {
                    onModelerReady({
                        exportXML,
                        exportSVG,
                        getModeler: () => modelerRef.current
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

    /**
     * Handle XML updates (for file opens and diagram switches)
     * CRITICAL: Only re-import if XML actually changed
     */
    useEffect(() => {
        if (!modelerRef.current) return;
        if (!initialXml) return;
        
        // Skip if XML hasn't changed (prevents unwanted re-imports)
        if (initialXml === lastImportedXmlRef.current) {
            return;
        }

        console.log("Importing new diagram XML");
        lastImportedXmlRef.current = initialXml;

        modelerRef.current.importXML(initialXml)
            .then(({ warnings }) => {
                if (warnings.length) {
                    console.warn("BPMN Import Warnings:", warnings);
                }
                
            // Just import - no zoom manipulation
            // Let the diagram render at its saved position
            
            })
            .catch((err) => {
                console.error("Error updating BPMN diagram:", err);
                if (onError) {
                    onError(err);
                }
            });
    }, [initialXml, onError]);
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
            <div 
                ref={containerRef} 
                className="bpmn-modeler-container"
            style={{ 
                width: "100%", 
                height: "100%",
                backgroundColor: "#ffffff"
            }}
            />
    );
};

export default BpmnModelerComponent;