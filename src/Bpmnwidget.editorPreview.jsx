import { createElement } from "react";

/**
 * Bpmnwidget.editorPreview.jsx
 * 
 * This component shows a preview of the widget in Mendix Studio Pro.
 * It's used at design time (not runtime) to give developers a visual
 * representation of what the widget will look like.
 * 
 * This is NOT the actual widget - it's just a placeholder preview.
 */

export function preview(props) {
    const { class: className } = props;

    // Get readable property values for display
    const mode = "Edit Mode";
    const editorHeight = 600;

    return (
        <div 
            className={`bpmn-widget-preview ${className || ""}`}
            style={{
                width: "100%",
                height: `${editorHeight}px`,
                minHeight: "300px"
            }}
        >
            <div style={{
                border: "2px dashed #d0d0d0",
                borderRadius: "8px",
                padding: "32px",
                textAlign: "center",
                backgroundColor: "#f9f9f9",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: "16px"
            }}>
                {/* Icon */}
                <div style={{
                    fontSize: "64px",
                    opacity: 0.4,
                    lineHeight: 1
                }}>
                    📊
                </div>

                {/* Title */}
                <div style={{
                    fontSize: "24px",
                    fontWeight: 600,
                    color: "#333",
                    marginBottom: "8px"
                }}>
                    BPMN Widget
                </div>

                {/* Description */}
                <div style={{
                    fontSize: "14px",
                    color: "#666",
                    maxWidth: "400px",
                    lineHeight: 1.5
                }}>
                    Business Process Model and Notation editor for creating and editing process diagrams.
                </div>

                {/* Mode Badge */}
                <div style={{
                    display: "inline-block",
                    padding: "6px 16px",
                    backgroundColor: "#fff3e0",
                    color: "#f57c00",
                    borderRadius: "16px",
                    fontSize: "13px",
                    fontWeight: 500,
                    marginTop: "8px"
                }}>
                    {mode}
                </div>

                {/* Configuration hints */}
                <div style={{
                    marginTop: "24px",
                    padding: "16px",
                    backgroundColor: "#fff",
                    borderRadius: "4px",
                    border: "1px solid #e0e0e0",
                    fontSize: "12px",
                    color: "#666",
                    textAlign: "left",
                    maxWidth: "500px"
                }}>
                    <div style={{ 
                        fontWeight: 600, 
                        marginBottom: "8px",
                        color: "#333"
                    }}>
                        ⚙️ Configuration Required:
                    </div>
                    <ul style={{
                        margin: 0,
                        paddingLeft: "20px",
                        lineHeight: 1.8
                    }}>
                        <li>
                            <strong>BPMN XML:</strong> Select a string attribute to store diagram
                        </li>
                        <li>
                            <strong>On Save:</strong> Configure action to save the diagram
                        </li>
                        <li>
                            <strong>On Cancel:</strong> Configure action to close the editor
                        </li>
                    </ul>
                </div>

                {/* Dimensions info */}
                <div style={{
                    fontSize: "11px",
                    color: "#999",
                    marginTop: "16px"
                }}>
                    Preview Height: {editorHeight}px
                </div>
            </div>
        </div>
    );
}

/**
 * Get custom CSS for the preview
 * This is injected into Studio Pro's preview pane
 */
export function getPreviewCss() {
    return `
        .bpmn-widget-preview {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
        
        .bpmn-widget-preview * {
            box-sizing: border-box;
        }
    `;
}

/**
 * Get the display name shown in Studio Pro's widget list
 */
export function getCustomCaption(props) {
    return "BPMN Widget";
}