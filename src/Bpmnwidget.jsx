import { createElement, useCallback, useMemo } from "react";
import BpmnEditor from "./components/BpmnEditor";
import "./ui/Bpmnwidget.css";
import "./ui/bpmn-styles.css";

/**
 * Bpmnwidget - Main Widget Component
 * 
 * This is the entry point for the Mendix widget.
 * It connects Mendix properties to the React BpmnEditor component.
 * 
 * Mendix Props:
 * - bpmnXML: EditableValue<string> - The BPMN XML attribute from entity
 * - onSaveAction: ActionValue - Mendix action to execute on save
 * - onCancelAction: ActionValue - Mendix action to execute on cancel
 * - class: string - CSS class from Mendix
 * - style: object - Style object from Mendix
 * - tabIndex: number - Tab index for accessibility
 */

export function Bpmnwidget(props) {
    const {
        bpmnXML,
        previewImageAttr,
        bpmnName,
        onSaveAction,
        onCancelAction,
        taskDataJson,
        class: className,
        style,
        tabIndex
    } = props;

    /**
     * Get the current BPMN XML value from Mendix attribute
     * useMemo ensures we only recompute when bpmnXML changes
     */
    const currentXml = useMemo(() => {
        // Check if bpmnXML attribute is available and has a value
        if (bpmnXML && bpmnXML.status === "available" && bpmnXML.value) {
            return bpmnXML.value;
        }
        return null; // Return null for new diagrams
    }, [bpmnXML]);

    const currentBpmnName = bpmnName?.status === "available" ? bpmnName.value : null;

    /**
     * Handle Save
     * Called when user clicks Save button in BpmnEditor
     * 
     * Flow:
     * 1. Receive XML string from BpmnEditor
     * 2. Update Mendix attribute with new XML
     * 3. Execute Mendix onSaveAction
     */
    const handleSave = useCallback((xml, previewImage) => {
        // Update the Mendix attribute with new XML
        if (bpmnXML && bpmnXML.status === "available") {
            bpmnXML.setValue(xml);
        }

        if (previewImageAttr && previewImageAttr.status === "available") {
            previewImageAttr.setValue(previewImage);
        }
        // Execute the Mendix action (microflow/nanoflow)
        if (onSaveAction && onSaveAction.canExecute) {
            onSaveAction.execute();
        }
    }, [bpmnXML, previewImageAttr, onSaveAction]);

    /**
     * Handle Cancel
     * Called when user clicks Cancel button in BpmnEditor
     * 
     * Flow:
     * 1. Execute Mendix onCancelAction
     * 2. Usually closes the popup/page
     */
    const handleCancel = useCallback(() => {
        // Execute the Mendix action (typically closes popup)
        if (onCancelAction && onCancelAction.canExecute) {
            onCancelAction.execute();
        }
    }, [onCancelAction]);

    const handleTasksExtracted = useCallback((tasks) => {
        if (taskDataJson && taskDataJson.status === "available") {
            taskDataJson.setValue(JSON.stringify(tasks));
        }
    }, [taskDataJson]);

    /**
     * Loading state check
     * Don't render until Mendix data is ready
     */
    if (bpmnXML && bpmnXML.status === "loading") {
        return (
            <div className={`bpmn-widget ${className || ""}`} style={style}>
                <div className="bpmn-loading">
                    <div className="bpmn-loading-spinner"></div>
                    <p>Loading...</p>
                </div>
            </div>
        );
    }

    /**
     * Error state check
     * Show error if Mendix attribute is unavailable
     */
    if (bpmnXML && bpmnXML.status === "unavailable") {
         return null;
    }

    /**
     * Main render
     * Render the BpmnEditor component with props
     */
    return (
        <div 
            className={`bpmn-widget ${className || ""}`} 
            style={style}
            tabIndex={tabIndex}
        >
            <BpmnEditor
                initialXml={currentXml}
                onSave={handleSave}
                onCancel={handleCancel}
                bpmnFile={currentBpmnName}
                onTasksExtracted={handleTasksExtracted}
                taskDataJson={taskDataJson?.value}
            />
        </div>
    );
}

/**
 * Widget Preview Component (optional)
 * Used in Mendix Studio Pro to show a preview of the widget
 */
export function preview(props) {
    return (
        <div className="bpmn-widget-preview">
            <div style={{
                border: "1px solid #ccc",
                borderRadius: "4px",
                padding: "20px",
                textAlign: "center",
                backgroundColor: "#f5f5f5",
                minHeight: props.height || "400px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column"
            }}>
                <div style={{
                    fontSize: "48px",
                    marginBottom: "16px",
                    opacity: 0.5
                }}>
                    📊
                </div>
                <h3 style={{ margin: 0, color: "#666" }}>BPMN Widget</h3>
                <p style={{ margin: "8px 0 0 0", color: "#999", fontSize: "14px" }}>
                </p>
            </div>
        </div>
    );
}

/**
 * Get Preview Props
 * Transforms Studio Pro properties into preview-friendly format
 */
export function getPreviewCss() {
    return `
        .bpmn-widget-preview {
            width: 100%;
            height: 100%;
        }
    `;
}