import { useState, useRef, createElement } from "react";
import BpmnModelerComponent from "./BpmnModeler";

/**
 * BpmnEditor Component
 * 
 * This is the main UI component that users interact with.
 * It includes:
 * - The BPMN canvas (via BpmnModelerComponent)
 * - Toolbar with Save and Cancel buttons
 * - Error display
 * - Loading state
 * 
 * Props:
 * - initialXml: Initial BPMN XML to load
 * - onSave: Callback function(xml) when user saves
 * - onCancel: Callback function when user cancels
 * - readOnly: If true, shows view-only mode
 * - height: Height of the editor in pixels
 */

export const BpmnEditor = ({ 
    initialXml, 
    onSave, 
    onCancel, 
    readOnly = false,
    height = 600
}) => {
    // State management
    const [error, setError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Ref to store modeler methods (exportXML, exportSVG, etc.)
    const modelerMethodsRef = useRef(null);

    /**
     * Handle modeler initialization
     * Called by BpmnModelerComponent when it's ready
     */
    const handleModelerReady = (methods) => {
        modelerMethodsRef.current = methods;
        setIsLoading(false);
    };

    /**
     * Handle errors from the modeler
     */
    const handleError = (err) => {
        setError(err.message || "An error occurred while loading the diagram");
        setIsLoading(false);
    };

    /**
     * Handle Save button click
     * Exports XML from modeler and calls parent's onSave callback
     */
    const handleSave = async () => {
        if (!modelerMethodsRef.current?.exportXML) {
            setError("Modeler not ready");
            return;
        }

        try {
            setIsSaving(true);
            setError(null);

            // Export the current diagram as XML
            const xml = await modelerMethodsRef.current.exportXML();

            // Call the parent's onSave callback with the XML
            if (onSave) {
                onSave(xml);
            }
        } catch (err) {
            console.error("Error saving BPMN diagram:", err);
            setError("Failed to save diagram. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    /**
     * Handle Cancel button click
     */
    const handleCancel = () => {
        if (onCancel) {
            onCancel();
        }
    };

    /**
     * Handle Zoom In
     */
    const handleZoomIn = () => {
        if (modelerMethodsRef.current?.getModeler) {
            const modeler = modelerMethodsRef.current.getModeler();
            const canvas = modeler.get("canvas");
            const currentZoom = canvas.zoom();
            canvas.zoom(currentZoom + 0.1);
        }
    };

    /**
     * Handle Zoom Out
     */
    const handleZoomOut = () => {
        if (modelerMethodsRef.current?.getModeler) {
            const modeler = modelerMethodsRef.current.getModeler();
            const canvas = modeler.get("canvas");
            const currentZoom = canvas.zoom();
            canvas.zoom(currentZoom - 0.1);
        }
    };

    /**
     * Handle Zoom to Fit
     */
    const handleZoomFit = () => {
        if (modelerMethodsRef.current?.getModeler) {
            const modeler = modelerMethodsRef.current.getModeler();
            const canvas = modeler.get("canvas");
            canvas.zoom("fit-viewport");
        }
    };

    /**
     * Handle Download as SVG
     */
    const handleDownloadSVG = async () => {
        if (!modelerMethodsRef.current?.exportSVG) {
            return;
        }

        try {
            const svg = await modelerMethodsRef.current.exportSVG();
            
            // Create a blob and download
            const blob = new Blob([svg], { type: "image/svg+xml" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "diagram.svg";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Error downloading SVG:", err);
            setError("Failed to download diagram");
        }
    };

    return (
        <div className="bpmn-editor-container">
            {/* Toolbar */}
            <div className="bpmn-toolbar">
                <div className="bpmn-toolbar-left">
                    <h3 className="bpmn-title">
                        {readOnly ? "View BPMN Diagram" : "Edit BPMN Diagram"}
                    </h3>
                </div>

                <div className="bpmn-toolbar-center">
                    {/* Zoom controls */}
                    <button
                        type="button"
                        className="bpmn-btn bpmn-btn-icon"
                        onClick={handleZoomIn}
                        title="Zoom In"
                        disabled={isLoading}
                    >
                        <span>+</span>
                    </button>
                    <button
                        type="button"
                        className="bpmn-btn bpmn-btn-icon"
                        onClick={handleZoomOut}
                        title="Zoom Out"
                        disabled={isLoading}
                    >
                        <span>−</span>
                    </button>
                    <button
                        type="button"
                        className="bpmn-btn bpmn-btn-icon"
                        onClick={handleZoomFit}
                        title="Fit to Screen"
                        disabled={isLoading}
                    >
                        <span>⊡</span>
                    </button>
                    <button
                        type="button"
                        className="bpmn-btn bpmn-btn-secondary"
                        onClick={handleDownloadSVG}
                        disabled={isLoading}
                    >
                    </button>
                </div>

                <div className="bpmn-toolbar-right">
                    {/* Action buttons */}
                    {onCancel && (
                        <button
                            type="button"
                            className="bpmn-btn bpmn-btn-secondary"
                            onClick={handleCancel}
                            disabled={isSaving}
                        >
                            Cancel
                        </button>
                    )}
                    {!readOnly && onSave && (
                        <button
                            type="button"
                            className="bpmn-btn bpmn-btn-primary"
                            onClick={handleSave}
                            disabled={isSaving || isLoading}
                        >
                            {isSaving ? "Saving..." : "Save"}
                        </button>
                    )}
                </div>
            </div>

            {/* Error display */}
            {error && (
                <div className="bpmn-error-banner">
                    <span className="bpmn-error-icon">⚠</span>
                    <span className="bpmn-error-text">{error}</span>
                    <button
                        type="button"
                        className="bpmn-error-close"
                        onClick={() => setError(null)}
                    >
                        ×
                    </button>
                </div>
            )}

            {/* Loading state */}
            {isLoading && (
                <div className="bpmn-loading">
                    <div className="bpmn-loading-spinner"></div>
                    <p>Loading BPMN Editor...</p>
                </div>
            )}

            {/* BPMN Canvas */}
            <div 
                className="bpmn-canvas-wrapper"
                style={{ height: `${height}px` }}
            >
                <BpmnModelerComponent
                    initialXml={initialXml}
                    onError={handleError}
                    readOnly={readOnly}
                    onModelerReady={handleModelerReady}
                />
            </div>
        </div>
    );
};

export default BpmnEditor;