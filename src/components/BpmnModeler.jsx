import { useEffect, useRef, useCallback, createElement } from "react";
import BpmnModeler from "bpmn-js/lib/Modeler";

/**
 * BpmnModeler Component
 * 
 * This component wraps the bpmn-js Modeler library.
 * It handles the initialization, rendering, and interaction with the BPMN diagram.
 * 
 * Props:
 * - initialXml: The initial BPMN XML to load (optional)
 * - onError: Callback function when an error occurs
 * - readOnly: If true, makes the diagram read-only
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
  <bpmn:process id="Process_1" isExecutable="false">
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
    readOnly = false,
    onModelerReady 
}) => {
    // Ref to hold the DOM container for the BPMN canvas
    const containerRef = useRef(null);
    
    // Ref to hold the modeler instance (persists across re-renders)
    const modelerRef = useRef(null);

    /**
     * Initialize the BPMN Modeler
     * This runs once when the component mounts
     */
    useEffect(() => {
        if (!containerRef.current) return;

        // Create a new BPMN Modeler instance
        const modeler = new BpmnModeler({
            container: containerRef.current,
            keyboard: {
                bindTo: document
            },
            // Additional options can be added here
            // For example: height, width, additionalModules, etc.
        });

        // Store the modeler instance in ref
        modelerRef.current = modeler;

        // Load the initial diagram
        const xmlToLoad = initialXml || DEFAULT_BPMN_XML;
        
        modeler.importXML(xmlToLoad)
            .then(({ warnings }) => {
                if (warnings.length) {
                    console.warn("BPMN Import Warnings:", warnings);
                }

                // Get the canvas and zoom to fit the diagram
                const canvas = modeler.get("canvas");
                canvas.zoom("fit-viewport");

                // If read-only mode, disable editing
                if (readOnly) {
                    const modeling = modeler.get("modeling");
                    if (modeling) {
                        // This prevents editing in read-only mode
                        modeler.get("eventBus").on("element.click", 100000, (event) => {
                            return false;
                        });
                    }
                }

                // Notify parent component that modeler is ready
                if (onModelerReady) {
                    onModelerReady(modeler);
                }
            })
            .catch((err) => {
                console.error("Error importing BPMN diagram:", err);
                if (onError) {
                    onError(err);
                }
            });

        // Cleanup function: destroy modeler when component unmounts
        return () => {
            if (modelerRef.current) {
                modelerRef.current.destroy();
            }
        };
    }, []); // Empty dependency array = runs once on mount

    /**
     * Update diagram when initialXml changes (if needed)
     * This effect handles updates to the diagram after initial load
     */
    useEffect(() => {
        if (!modelerRef.current || !initialXml) return;

        modelerRef.current.importXML(initialXml)
            .then(() => {
                const canvas = modelerRef.current.get("canvas");
                canvas.zoom("fit-viewport");
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
     * Method to export diagram as SVG image
     * Useful for generating previews or thumbnails
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

    // Expose methods to parent component via ref
    useEffect(() => {
        if (onModelerReady && modelerRef.current) {
            onModelerReady({
                exportXML,
                exportSVG,
                getModeler: () => modelerRef.current
            });
        }
    }, [exportXML, exportSVG, onModelerReady]);

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