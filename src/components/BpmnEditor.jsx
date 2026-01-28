import { createElement, useState, useRef, useEffect, useCallback } from "react";
import BpmnModelerComponent from "./BpmnModeler";
import folderIcon from "../assets/folder-closed.svg";
import plusIcon from "../assets/zoom-in.svg";
import minusIcon from "../assets/zoom-out.svg";
import resetIcon from "../assets/move-diagonal.svg";
import downloadIcon from "../assets/download.svg";
import keyboardIcon from "../assets/keyboard.svg";
import downIcon from "../assets/chevron-down.svg";
import companyLogo from "../assets/LCL-brand-clr-logo.png";
import watermarkImg from "../assets/LCL-brand-clr-icon.png";
import jsPDF from "jspdf";
import { applyBottleneckColors, clearBottleneckColors } from "../utils/bottleneckAnalyzer";

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
 */

export const BpmnEditor = ({ initialXml, onSave, onCancel, bpmnFile, onTasksExtracted, taskDataJson }) => {
    // State management
    const [error, setError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isImporting, setIsImporting] = useState(false);
    const [open, setOpen] = useState(false);
    const [currentXml, setCurrentXml] = useState(initialXml);
    const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
    const [isSimulationMode, setIsSimulationMode] = useState(false);
    const [validationResults, setValidationResults] = useState({ errors: [], warnings: [] });
    const [isBottleneckMode, setIsBottleneckMode] = useState(false);
    const [expandedPanel, setExpandedPanel] = useState(null);

    // Refs
    const fileInputRef = useRef(null);
    const modelerMethodsRef = useRef(null);
    const lastLoadedXmlRef = useRef(initialXml);
    const editorActionsRef = useRef(null);
    const lastAppliedTaskJsonRef = useRef(null);
    const logoImgRef = useRef(null);
    const watermarkImgRef = useRef(null);

    /**
     * Only reload diagram if we're opening a genuinely different diagram
     * This prevents unwanted re-imports when user is editing
     */
    useEffect(() => {
        if (initialXml && initialXml !== lastLoadedXmlRef.current && initialXml.trim().length > 100) {
            console.log("New diagram detected, reloading editor");
            setCurrentXml(initialXml);
            lastLoadedXmlRef.current = initialXml;
        }
    }, [initialXml]);

    /**
     * Close dropdown menu when clicking outside
     */
    useEffect(() => {
        const handleClickOutside = event => {
            const downloadWrapper = event.target.closest(".download-wrapper");
            if (!downloadWrapper && open) {
                setOpen(false);
            }
        };

        if (open) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [open]);

    /**
     * Handle modeler initialization
     */
    const handleModelerReady = async methods => {
        modelerMethodsRef.current = methods;
        setIsLoading(false);

        const modeler = methods.getModeler();
        const eventBus = modeler.get("eventBus");

        // ✅ TOKEN SIMULATION TOGGLE (THIS IS THE KEY)
        const onToggleMode = event => {
            console.info("Simulation mode toggled:", event.active);
            setIsSimulationMode(!!event.active);
        };

        eventBus.on("tokenSimulation.toggleMode", onToggleMode);
        // 🔁 AUTO-RUN VALIDATION ON LOAD
        try {
            const { errors, warnings } = await methods.validateDiagram();

            setValidationResults({ errors, warnings });
            methods.applyValidationMarkers(errors, warnings);

            // ✅ SAFE POINT: XML fully ready
            if (onTasksExtracted && methods.extractTasks) {
                const tasks = methods.extractTasks();
                onTasksExtracted(tasks);
            }

            // Optional: show blocking message immediately
            if (errors.length > 0) {
                setError("Please fix validation errors.");
            }
        } catch (e) {
            console.error("Auto validation failed", e);
        }
    };

    useEffect(() => {
        const el = document.documentElement;

        if (isSimulationMode) {
            if (el.requestFullscreen) el.requestFullscreen();
        } else {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
        }
    }, [isSimulationMode]);

    useEffect(() => {
        const img = new Image();
        img.src = companyLogo;
        logoImgRef.current = img;
    }, []);

    useEffect(() => {
        const img = new Image();
        img.src = watermarkImg;
        watermarkImgRef.current = img;
    }, []);
    /**
     * Handle errors from the modeler
     */
    const handleError = err => {
        setError(err.message || "An error occurred while loading the diagram");
        setIsLoading(false);
    };

    /**
     * Handle Save button click
     * Exports XML from modeler and calls parent's onSave callback
     */
    const handleSave = async () => {
        if (!modelerMethodsRef.current) {
            setError("Modeler not ready");
            return;
        }

        try {
            setIsSaving(true);
            setError(null);

            // VALIDATION FIRST
            const { errors, warnings } = await modelerMethodsRef.current.validateDiagram();

            setValidationResults({ errors, warnings });
            modelerMethodsRef.current.applyValidationMarkers(errors, warnings);
            if (errors.length > 0) {
                setError("Please fix validation errors before saving.");
                return;
            }

            if (onTasksExtracted && modelerMethodsRef.current.extractTasks) {
                const tasks = modelerMethodsRef.current.extractTasks();
                onTasksExtracted(tasks);
            }

            // ✅ SAFE TO SAVE
            const xml = await modelerMethodsRef.current.exportXML();
            const svg = await modelerMethodsRef.current.exportSVG();

            const base64SVG = btoa(unescape(encodeURIComponent(svg)));
            const dataURL = `data:image/svg+xml;base64,${base64SVG}`;

            onSave?.(xml, dataURL);
        } catch (err) {
            console.error(err);
            setError("Failed to save diagram");
        } finally {
            setIsSaving(false);
        }
    };

    useEffect(() => {
        if (!modelerMethodsRef.current) return;
        if (!taskDataJson) return;
        if (taskDataJson === lastAppliedTaskJsonRef.current) return;

        try {
            const tasks = JSON.parse(taskDataJson);
            if (modelerMethodsRef.current?.updateTasks) {
                modelerMethodsRef.current.updateTasks(tasks);
            }

            lastAppliedTaskJsonRef.current = taskDataJson;
        } catch (e) {
            console.error("Invalid task master data JSON", e);
        }
    }, [taskDataJson]);

    /**
     * Handle Cancel button click
     */
    const handleCancel = () => {
        if (onCancel) {
            onCancel();
        }
    };

    const MIN_ZOOM = 0.5;
    const MAX_ZOOM = 2.5;

    const handleZoomIn = () => {
        if (!modelerMethodsRef.current?.getModeler) return;

        const modeler = modelerMethodsRef.current.getModeler();
        const canvas = modeler.get("canvas");

        canvas.zoom(Math.min(canvas.zoom() + 0.1, MAX_ZOOM));
    };

    const handleZoomOut = () => {
        if (!modelerMethodsRef.current?.getModeler) return;

        const modeler = modelerMethodsRef.current.getModeler();
        const canvas = modeler.get("canvas");

        canvas.zoom(Math.max(canvas.zoom() - 0.1, MIN_ZOOM));
    };

    /**
     * Handle Zoom to Fit
     */
    const handleZoomFit = () => {
        modelerMethodsRef.current?.fitAndCenter?.();
    };

    const handlePropertiesClick = () => {
        setExpandedPanel(prev => (prev === "properties" ? null : "properties"));
    };

    const handleValidationClick = () => {
        setExpandedPanel(prev => (prev === "validation" ? null : "validation"));
    };

    /**
     * Sanitize the file names
     */
    const sanitizeFilename = name => {
        if (!name || !name.trim()) {
            return null;
        }
        return name.trim();
    };

    /**
     * Function to handle bottleneck analysis
     */
    const handleBottleneckAnalysis = () => {
        if (!modelerMethodsRef.current?.extractTasks || !modelerMethodsRef.current?.getModeler) {
            return;
        }
        const modeler = modelerMethodsRef.current.getModeler();
        if (isBottleneckMode) {
            //turnoff the bottleneck mode
            clearBottleneckColors(modeler);
            setIsBottleneckMode(false);
        } else {
            const tasks = modelerMethodsRef.current.extractTasks();
            const tasksWithDuration = tasks.filter(t => t.duration && t.duration.trim() !== "");
            if (tasksWithDuration.length === 0) {
                alert("No tasks with duration found, please add duration to the tasks first");
                return;
            }
            applyBottleneckColors(modeler, tasks);
            setIsBottleneckMode(true);
        }
    };

    /**
     * Function to focus on task when it is clicked.
     */
    const handleTaskFocus = taskId => {
        if (modelerMethodsRef.current?.focusElement) {
            modelerMethodsRef.current.focusElement(taskId);
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

            const blob = new Blob([svg], { type: "image/svg+xml" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${sanitizeFilename(bpmnFile)}.svg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Error downloading SVG:", err);
            setError("Failed to download diagram");
        }
    };

    /**
     * Handle Download as BPMN
     */
    const handleDownloadBPMN = async () => {
        if (!modelerMethodsRef.current?.exportXML) {
            return;
        }

        try {
            const xml = await modelerMethodsRef.current.exportXML();

            const blob = new Blob([xml], { type: "application/bpmn20+xml" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${sanitizeFilename(bpmnFile)}.bpmn`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error downloading BPMN", error);
            setError("Failed to download diagram");
        }
    };

    function addImageWatermark(pdf, watermarkImg) {
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        // Desired watermark width (in mm)
        const watermarkWidth = 120;

        // Preserve aspect ratio
        const aspectRatio = watermarkImg.naturalHeight / watermarkImg.naturalWidth;
        const watermarkHeight = watermarkWidth * aspectRatio;

        const x = (pageWidth - watermarkWidth) / 2;
        const y = (pageHeight - watermarkHeight) / 2;

        pdf.saveGraphicsState();
        pdf.setGState(new pdf.GState({ opacity: 0.05 }));

        pdf.addImage(watermarkImg, "PNG", x, y, watermarkWidth, watermarkHeight);

        pdf.restoreGraphicsState();
    }

    /**
     * Handle Download as PDF
     * Converts SVG to PDF using jsPDF
     */
    const handleDownloadPDF = async () => {
        if (!modelerMethodsRef.current?.exportSVG) {
            return;
        }

        try {
            setError(null);

            // Export the diagram as SVG
            const svg = await modelerMethodsRef.current.exportSVG();

            // Create a temporary image to get SVG dimensions
            const img = new Image();
            const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(svgBlob);

            img.onload = () => {
                try {
                    // Get image dimensions
                    const imgWidth = img.width;
                    const imgHeight = img.height;

                    // Calculate PDF dimensions (A4 size with margins)
                    const pdfWidth = 210; // A4 width in mm
                    const pdfHeight = 297; // A4 height in mm
                    const margin = 10; // margin in mm

                    // Calculate scaling to fit the image on the page
                    const maxWidth = pdfWidth - 2 * margin;
                    const maxHeight = pdfHeight - 2 * margin;

                    let finalWidth = imgWidth;
                    let finalHeight = imgHeight;

                    // Scale down if image is larger than page
                    const widthRatio = maxWidth / (imgWidth * 0.264583); // px to mm conversion
                    const heightRatio = maxHeight / (imgHeight * 0.264583);
                    const ratio = Math.min(widthRatio, heightRatio, 1);

                    finalWidth = imgWidth * 0.264583 * ratio;
                    finalHeight = imgHeight * 0.264583 * ratio;

                    // Determine orientation based on dimensions
                    const orientation = finalWidth > finalHeight ? "landscape" : "portrait";

                    // Create PDF
                    const pdf = new jsPDF({
                        orientation: orientation,
                        unit: "mm",
                        format: "a4"
                    });

                    // Center the image on the page
                    const x = (pdf.internal.pageSize.getWidth() - finalWidth) / 2;
                    const y = (pdf.internal.pageSize.getHeight() - finalHeight) / 2;

                    // Convert SVG to data URL
                    const canvas = document.createElement("canvas");
                    canvas.width = imgWidth;
                    canvas.height = imgHeight;
                    const ctx = canvas.getContext("2d");

                    // Draw image on canvas
                    ctx.drawImage(img, 0, 0);

                    // Get image data as PNG
                    const imgData = canvas.toDataURL("image/png");
                    // Add company logo
                    if (logoImgRef.current) {
                        const logoWidth = 30; // mm
                        const logoHeight = 10; // mm
                        const logoX = 10; // left margin
                        const logoY = 10; // top margin

                        pdf.addImage(logoImgRef.current, "PNG", logoX, logoY, logoWidth, logoHeight);
                    }

                    // Title
                    pdf.setFontSize(14);
                    pdf.setFont("helvetica", "bold");
                    pdf.text(sanitizeFilename(bpmnFile), pdf.internal.pageSize.getWidth() / 2, 18, { align: "center" });

                    // Divider line
                    pdf.setDrawColor(200);
                    pdf.line(10, 25, pdf.internal.pageSize.getWidth() - 10, 25);

                    // Add image to PDF
                    pdf.addImage(imgData, "PNG", x, y, finalWidth, finalHeight);
                    // ---- WATERMARK (every page) ----
                    if (watermarkImgRef.current) {
                        addImageWatermark(pdf, watermarkImgRef.current);
                    }

                    // Save the PDF
                    pdf.save(`${sanitizeFilename(bpmnFile)}.pdf`);

                    // Cleanup
                    URL.revokeObjectURL(url);
                } catch (err) {
                    console.error("Error creating PDF:", err);
                    setError("Failed to generate PDF. Please try again.");
                    URL.revokeObjectURL(url);
                }
            };

            img.onerror = () => {
                console.error("Error loading SVG image");
                setError("Failed to load diagram for PDF generation");
                URL.revokeObjectURL(url);
            };

            img.src = url;
        } catch (err) {
            console.error("Error downloading PDF:", err);
            setError("Failed to download diagram as PDF");
        }
    };

    /**
     * Handle file open from local filesystem
     */
    const handleOpenFile = event => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        // Validate file type
        const validExtensions = [".bpmn", ".xml", ".bpmn20.xml"];
        const fileExtension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
        if (!validExtensions.includes(fileExtension)) {
            setError("Invalid file type. Please select a .bpmn or .xml file");
            return;
        }

        setIsImporting(true);
        setError(null);

        const reader = new FileReader();

        reader.onload = e => {
            try {
                const xmlContent = e.target.result;

                // Update XML state - this will trigger BpmnModeler to reload
                setCurrentXml(xmlContent);
                lastLoadedXmlRef.current = xmlContent;
                setIsImporting(false);
            } catch (err) {
                console.error("Error reading BPMN file:", err);
                setError("Failed to import file. Please ensure it's a valid BPMN diagram.");
                setIsImporting(false);
            }
        };

        reader.onerror = () => {
            setError("Failed to read file. Please try again.");
            setIsImporting(false);
        };

        // Read file as text
        reader.readAsText(file);
        // Reset input so same file can be selected again
        event.target.value = "";
    };

    useEffect(() => {
        editorActionsRef.current = {
            downloadPDF: handleDownloadPDF,
            downloadSVG: handleDownloadSVG,
            downloadBPMN: handleDownloadBPMN
        };
    }, []);

    // 🔹 Group warnings by ruleId (UX improvement)
    const groupedWarnings = validationResults.warnings.reduce((acc, w) => {
        acc[w.ruleId] = acc[w.ruleId] || [];
        acc[w.ruleId].push(w);
        return acc;
    }, {});

    return (
        <div className="bpmn-editor-container">
            {/* Toolbar */}
            {!isSimulationMode && (
                <div className="bpmn-toolbar">
                    <div className="bpmn-toolbar-left">
                        <h3 className="bpmn-title">BPMN Diagram</h3>
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
                            <img src={plusIcon} style={{ width: 18, height: 18 }} alt="Zoom In" />
                        </button>

                        <button
                            type="button"
                            className="bpmn-btn bpmn-btn-icon"
                            onClick={handleZoomOut}
                            title="Zoom Out"
                            disabled={isLoading}
                        >
                            <img src={minusIcon} style={{ width: 18, height: 18 }} alt="Zoom Out" />
                        </button>

                        <button
                            type="button"
                            className="bpmn-btn bpmn-btn-icon"
                            onClick={handleZoomFit}
                            title="Fit to Screen"
                            disabled={isLoading}
                        >
                            <img src={resetIcon} style={{ width: 18, height: 18 }} alt="Fit to Screen" />
                        </button>

                        {/* Hidden file input */}
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".bpmn,.xml,.bpmn20.xml"
                            onChange={handleOpenFile}
                            style={{ display: "none" }}
                        />

                        {/* Open File button */}
                        <button
                            type="button"
                            className="bpmn-btn bpmn-btn-secondary"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isLoading || isImporting}
                            title="Open BPMN diagram from local file system"
                        >
                            <img src={folderIcon} style={{ width: 18, height: 18 }} alt="Open File" />
                        </button>

                        {/* Download dropdown menu */}
                        <div className="download-wrapper">
                            <button
                                type="button"
                                className="bpmn-btn bpmn-btn-secondary download-btn"
                                onClick={e => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setOpen(prev => !prev);
                                }}
                                disabled={isLoading}
                                title="Download diagram"
                            >
                                <img src={downloadIcon} style={{ width: 18, height: 18 }} alt="Download" />
                            </button>

                            {open && (
                                <div className="download-menu" onMouseDown={e => e.stopPropagation()}>
                                    <div
                                        className="download-item"
                                        onClick={e => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleDownloadSVG();
                                            setOpen(false);
                                        }}
                                    >
                                        Download SVG
                                    </div>
                                    <div
                                        className="download-item"
                                        onClick={e => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleDownloadBPMN();
                                            setOpen(false);
                                        }}
                                    >
                                        Download BPMN
                                    </div>
                                    <div
                                        className="download-item"
                                        onClick={e => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleDownloadPDF();
                                            setOpen(false);
                                        }}
                                    >
                                        Download PDF
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* KeyBoard shortcuts */}
                        <button
                            type="button"
                            className="bpmn-btn bpmn-btn-secondary"
                            onClick={() => setShowKeyboardShortcuts(true)}
                            title="Keyboard Shortcuts"
                            disabled={isLoading}
                        >
                            <img src={keyboardIcon} style={{ width: 18, height: 18 }} alt="Key Board" />
                        </button>
                        {/* In the toolbar center section, add this button: */}
                        <button
                            type="button"
                            className={`bpmn-btn bpmn-btn-secondary bpmn-btn-bottleneck ${
                                isBottleneckMode ? "active" : ""
                            }`}
                            onClick={handleBottleneckAnalysis}
                            disabled={isLoading}
                            title="Show task with high execution time"
                        >
                            {isBottleneckMode ? "Hide Bottleneck" : "Show Bottleneck"}
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
                        {onSave && (
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
            )}

            {/* Error display */}
            {error && (
                <div className="bpmn-error-banner">
                    <span className="bpmn-error-icon">⚠</span>
                    <span className="bpmn-error-text">{error}</span>
                    <button type="button" className="bpmn-error-close" onClick={() => setError(null)}>
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

            {/* BPMN Workspace */}
            <div className="bpmn-workspace">
                {/* BPMN Canvas */}
                <div className="bpmn-canvas-wrapper">
                    <BpmnModelerComponent
                        initialXml={currentXml}
                        onError={handleError}
                        onModelerReady={handleModelerReady}
                        editorActionsRef={editorActionsRef}
                        onValidate={(errors, warnings) => {
                            setValidationResults({ errors, warnings });
                            modelerMethodsRef.current?.applyValidationMarkers(errors, warnings);
                        }}
                        isSimulationMode={isSimulationMode}
                    />
                </div>

                {/* RIGHT SIDEBAR */}
                {!isSimulationMode && (
                    <div className="bpmn-right-sidebar">
                        {/* ---------- PROPERTIES HEADER ---------- */}
                        <div className="panel-header" onClick={handlePropertiesClick}>
                            <h4>Properties Panel</h4>
                            <img
                                src={downIcon}
                                className={`panel-arrow ${expandedPanel === "properties" ? "rotated" : ""}`}
                                alt="toggle properties"
                            />
                        </div>

                        {/* ---------- PROPERTIES CONTENT ---------- */}
                        <div
                            className={`bpmn-properties-content ${
                                expandedPanel === "properties" ? "expanded" : "collapsed"
                            }`}
                        >
                            {/* ⚠️ MUST NEVER BE REMOVED */}
                            <div id="js-properties-panel" className="panel-content" />
                        </div>

                        {/* ---------- VALIDATION HEADER ---------- */}
                        <div className="validation-title" onClick={handleValidationClick}>
                            <h4>Validation</h4>
                            <img
                                src={downIcon}
                                className={`validation-arrow ${expandedPanel === "validation" ? "rotated" : ""}`}
                                alt="toggle validation"
                            />
                        </div>

                        {/* ---------- VALIDATION CONTENT ---------- */}
                        <div
                            className={`bpmn-validation-content ${
                                expandedPanel === "validation" ? "expanded" : "collapsed"
                            }`}
                        >
                            <div className="validation-content">
                                {/* ERRORS */}
                                {validationResults.errors.length > 0 && (
                                    <div className="validation-errors">
                                        <h5 className="error-title">Errors</h5>
                                        {validationResults.errors.map((e, i) => (
                                            <div
                                                key={`error-${i}`}
                                                className="validation-item error"
                                                onClick={() => modelerMethodsRef.current?.focusElement(e.elementId)}
                                            >
                                                {e.message}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* WARNINGS */}
                                {Object.keys(groupedWarnings).length > 0 && (
                                    <div className="validation-warnings">
                                        <h5 className="warning-title">Warnings</h5>
                                        {Object.entries(groupedWarnings).map(([ruleId, items]) => (
                                            <div key={ruleId} className="validation-group">
                                                <div className="validation-group-title">
                                                    ⚠ {items.length} issue(s): {items[0].message}
                                                </div>
                                                <div className="validation-group-items">
                                                    {items.map((w, i) => (
                                                        <div
                                                            key={`${ruleId}-${i}`}
                                                            className="validation-item warning"
                                                            onClick={() =>
                                                                modelerMethodsRef.current?.focusElement(w.elementId)
                                                            }
                                                        >
                                                            {w.elementId || "Global"}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Keyboard Shortcuts Modal */}
            {showKeyboardShortcuts && (
                <div className="keyboard-shortcuts-overlay" onClick={() => setShowKeyboardShortcuts(false)}>
                    <div className="keyboard-shortcuts-modal" onClick={e => e.stopPropagation()}>
                        <div className="keyboard-shortcuts-header">
                            <h3>Keyboard Shortcuts</h3>
                            <button
                                className="keyboard-shortcuts-close"
                                onClick={() => setShowKeyboardShortcuts(false)}
                            >
                                ×
                            </button>
                        </div>

                        <div className="keyboard-shortcuts-content">
                            <div className="shortcuts-section">
                                <div className="shortcut-item">
                                    <span className="shortcut-description">Open diagram from local file system</span>
                                    <span className="shortcut-keys">
                                        <kbd>Ctrl</kbd> + <kbd>O</kbd>
                                    </span>
                                </div>
                                <div className="shortcut-item">
                                    <span className="shortcut-description">Download BPMN</span>
                                    <span className="shortcut-keys">
                                        <kbd>Ctrl</kbd> + <kbd>S</kbd>
                                    </span>
                                </div>
                                <div className="shortcut-item">
                                    <span className="shortcut-description">Download PDF</span>
                                    <span className="shortcut-keys">
                                        <kbd>Ctrl</kbd> + <kbd>D</kbd>
                                    </span>
                                </div>
                                <div className="shortcut-item">
                                    <span className="shortcut-description">Download SVG</span>
                                    <span className="shortcut-keys">
                                        <kbd>Ctrl</kbd> + <kbd>V</kbd>
                                    </span>
                                </div>
                                <div className="shortcut-item">
                                    <span className="shortcut-description">Undo</span>
                                    <span className="shortcut-keys">
                                        <kbd>Ctrl</kbd> + <kbd>Z</kbd>
                                    </span>
                                </div>
                                <div className="shortcut-item">
                                    <span className="shortcut-description">Redo</span>
                                    <span className="shortcut-keys">
                                        <kbd>Ctrl</kbd> + <kbd>⇧</kbd> + <kbd>Z</kbd>
                                    </span>
                                </div>
                                <div className="shortcut-item">
                                    <span className="shortcut-description">Select All</span>
                                    <span className="shortcut-keys">
                                        <kbd>Ctrl</kbd> + <kbd>A</kbd>
                                    </span>
                                </div>
                                <div className="shortcut-item">
                                    <span className="shortcut-description">Scrolling (Vertical)</span>
                                    <span className="shortcut-keys">
                                        <kbd>Ctrl</kbd> + <kbd>Scrolling</kbd>
                                    </span>
                                </div>
                                <div className="shortcut-item">
                                    <span className="shortcut-description">Scrolling (Horizontal)</span>
                                    <span className="shortcut-keys">
                                        <kbd>Ctrl</kbd> + <kbd>⇧</kbd> + <kbd>Scrolling</kbd>
                                    </span>
                                </div>
                                <div className="shortcut-item">
                                    <span className="shortcut-description">Direct Editing</span>
                                    <span className="shortcut-keys">
                                        <kbd>E</kbd>
                                    </span>
                                </div>
                                <div className="shortcut-item">
                                    <span className="shortcut-description">Hand Tool (Pan)</span>
                                    <span className="shortcut-keys">
                                        <kbd>H</kbd>
                                    </span>
                                </div>
                                <div className="shortcut-item">
                                    <span className="shortcut-description">Lasso Tool</span>
                                    <span className="shortcut-keys">
                                        <kbd>L</kbd>
                                    </span>
                                </div>
                                <div className="shortcut-item">
                                    <span className="shortcut-description">Space Tool</span>
                                    <span className="shortcut-keys">
                                        <kbd>S</kbd>
                                    </span>
                                </div>
                                <div className="shortcut-item">
                                    <span className="shortcut-description">Replace Tool</span>
                                    <span className="shortcut-keys">
                                        <kbd>R</kbd>
                                    </span>
                                </div>
                                <div className="shortcut-item">
                                    <span className="shortcut-description">Append anything</span>
                                    <span className="shortcut-keys">
                                        <kbd>A</kbd>
                                    </span>
                                </div>
                                <div className="shortcut-item">
                                    <span className="shortcut-description">Create anything</span>
                                    <span className="shortcut-keys">
                                        <kbd>N</kbd>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BpmnEditor;
