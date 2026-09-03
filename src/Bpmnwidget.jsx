import { createElement, useCallback, useMemo } from "react";
import BpmnEditor from "./components/BpmnEditor";
import { BpmnDiff } from "./components/BpmnDiff";
import "./ui/Bpmnwidget.css";
import "./ui/bpmn-styles.css";

/**
 * Bpmnwidget - Main Widget Component
 *
 * This is the entry point for the Mendix widget.
 * It connects Mendix properties to the React BpmnEditor component.
 *
 * The widget has two modes, set by the Mode property:
 * - editor  : the modelling canvas (default)
 * - compare : read-only side-by-side comparison of BPMN XML vs Compare XML.
 *             Meant for a dedicated comparison page, opened by the microflow
 *             behind Display > Show Comparison.
 *
 * Mendix Props:
 * - bpmnXML: EditableValue<string> - The BPMN XML attribute from entity
 * - compareXML: EditableValue<string> - XML of the version selected in the dropdown
 * - onSaveAction: ActionValue - Mendix action to execute on save
 * - onCancelAction: ActionValue - Mendix action to execute on cancel
 * - onCompareAction: ActionValue - Mendix action that opens the comparison page
 * - readOnly: boolean - Forces the diagram into read-only mode, same effect as a lock by another user
 * - class: string - CSS class from Mendix
 * - style: object - Style object from Mendix
 * - tabIndex: number - Tab index for accessibility
 */

export function Bpmnwidget(props) {
    const {
        mode,
        bpmnXML,
        previewImageAttr,
        bpmnName,
        onSaveAction,
        onCancelAction,
        taskDataJson,
        currentUserEmail,
        lockedUserEmail,
        selectedTaskId,
        onTaskClickAction,
        onCompareAction,
        compareXML,
        compareVersionName,
        currentVersionName,
        readOnly,
        class: className,
        style,
        tabIndex
    } = props;

    const isCompareMode = mode === "compare";

    //Check if locked by another user
    const isLockedByAnotherUser = useMemo(() => {
        if (currentUserEmail?.status === "loading" || 
            lockedUserEmail?.status === "loading") {
            return true;
        }

        if (!lockedUserEmail?.value || !lockedUserEmail.value.trim()) {
            return true; // No checkout = read-only
        }
        
        if (!currentUserEmail?.value || !currentUserEmail.value.trim()) {
            return true;
        }
        
        const currentEmail = currentUserEmail.value.toLowerCase().trim();
        const lockedEmail = lockedUserEmail.value.toLowerCase().trim();
        
        return currentEmail !== lockedEmail;
    }, [currentUserEmail?.value, currentUserEmail?.status, 
        lockedUserEmail?.value, lockedUserEmail?.status]);

    // Read-only when the widget is configured read-only OR the diagram is locked by another user
    const isReadOnly = useMemo(() => readOnly === true || isLockedByAnotherUser, [readOnly, isLockedByAnotherUser]);

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
     * Compare mode only: XML of the version the user picked in the dropdown.
     * Whitespace counts as empty, so a blank version does not get imported.
     */
    const compareXml = useMemo(() => {
        if (compareXML && compareXML.status === "available" && compareXML.value && compareXML.value.trim()) {
            return compareXML.value;
        }
        return null;
    }, [compareXML]);

    // displayValue so numeric version attributes render as well as strings
    const compareVersionLabel = compareVersionName?.status === "available" ? compareVersionName.displayValue : null;
    const currentVersionLabel = currentVersionName?.status === "available" ? currentVersionName.displayValue : null;

    /**
     * Handle Show Comparison
     * Hands control to Mendix; the configured microflow is expected to open the
     * comparison page, which hosts this same widget with Mode = Compare.
     */
    const handleCompare = useCallback(() => {
        if (onCompareAction && onCompareAction.canExecute) {
            onCompareAction.execute();
        }
    }, [onCompareAction]);

    const handleTaskAction = useCallback(
        (taskId) => {
            if (selectedTaskId?.status === "available") {
                selectedTaskId.setValue(taskId);
            }
            if (onTaskClickAction?.canExecute) {
                onTaskClickAction.execute();
            }
        },
        [selectedTaskId, onTaskClickAction]
   );

    /**
     * Handle Save
     * Called when user clicks Save button in BpmnEditor
     *
     * Flow:
     * 1. Receive XML string from BpmnEditor
     * 2. Update Mendix attribute with new XML
     * 3. Execute Mendix onSaveAction
     */
    const handleSave = useCallback(
        (xml, previewImage) => {
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
        },
        [bpmnXML, previewImageAttr, onSaveAction]
    );

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

    const handleTasksExtracted = useCallback(
        tasks => {
            if (taskDataJson && taskDataJson.status === "available") {
                taskDataJson.setValue(JSON.stringify(tasks));
            }
        },
        [taskDataJson]
    );

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
     * Compare mode
     * Used on the dedicated comparison page. The editor, toolbar and modeler are
     * never created here, so the page is read-only by construction: it only
     * compares BPMN XML (current) against Compare XML (selected version).
     */
    if (isCompareMode) {
        return (
            <div className={`bpmn-widget ${className || ""}`} style={style} tabIndex={tabIndex}>
                <BpmnDiff
                    xmlA={currentXml}
                    xmlB={compareXml}
                    labelA={currentVersionLabel}
                    labelB={compareVersionLabel}
                    diagramName={currentBpmnName}
                />
            </div>
        );
    }

    /**
     * Main render
     * Render the BpmnEditor component with props
     */
    return (
        <div className={`bpmn-widget ${className || ""}`} style={style} tabIndex={tabIndex}>
            <BpmnEditor
                initialXml={currentXml}
                onSave={handleSave}
                onCancel={handleCancel}
                bpmnFile={currentBpmnName}
                onTasksExtracted={handleTasksExtracted}
                taskDataJson={taskDataJson?.value}
                isReadOnly={isReadOnly}
                onTaskAction={handleTaskAction}
                onCompare={onCompareAction ? handleCompare : undefined}
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
            <div
                style={{
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
                }}
            >
                <div
                    style={{
                        fontSize: "48px",
                        marginBottom: "16px",
                        opacity: 0.5
                    }}
                >
                    📊
                </div>
                <h3 style={{ margin: 0, color: "#666" }}>BPMN Widget</h3>
                <p style={{ margin: "8px 0 0 0", color: "#999", fontSize: "14px" }}></p>
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
