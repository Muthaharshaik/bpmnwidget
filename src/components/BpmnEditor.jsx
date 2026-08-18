import { createElement, useState, useRef, useEffect, useCallback } from "react";
import BpmnModelerComponent from "./BpmnModeler";
import { BpmnDiff } from "./BpmnDiff";
import companyLogo from "../assets/Marico_LOGO_11.png";
import watermarkImg from "../assets/Marico_LOGO_11.png";
import jsPDF from "jspdf";
import { applyBottleneckColors, clearBottleneckColors } from "../utils/bottleneckAnalyzer";

export const BpmnEditor = ({
    initialXml,
    onSave,
    onCancel,
    bpmnFile,
    onTasksExtracted,
    taskDataJson,
    isReadOnly,
    onTaskAction
}) => {
    // ─── State ────────────────────────────────────────────────────────────────
    const [error, setError]                         = useState(null);
    const [isSaving, setIsSaving]                   = useState(false);
    const [isLoading, setIsLoading]                 = useState(true);
    const [isImporting, setIsImporting]             = useState(false);
    const [currentXml, setCurrentXml]               = useState(initialXml);
    const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
    const [isSimulationMode, setIsSimulationMode]   = useState(false);
    const [validationResults, setValidationResults] = useState({ errors: [], warnings: [] });
    const [selectedIssueKey, setSelectedIssueKey]   = useState(null);
    const [isBottleneckMode, setIsBottleneckMode]   = useState(false);
    const [activeTab, setActiveTab]                 = useState("properties");
    const [isTaskDataApplied, setIsTaskDataApplied] = useState(false);
    const [showComments, setShowComments]           = useState(false);
    const [isTogglingComments, setIsTogglingComments] = useState(false);
    const [showDiff, setShowDiff]                   = useState(false);

    // dropdown visibility
    const [showDisplayMenu, setShowDisplayMenu]     = useState(false);
    const [showToolsMenu, setShowToolsMenu]         = useState(false);
    const [showDownloadMenu, setShowDownloadMenu]   = useState(false); // read-only download
    const [isPanelOpen, setIsPanelOpen] = useState(false);

    // ─── Refs ─────────────────────────────────────────────────────────────────
    const fileInputRef          = useRef(null);
    const modelerMethodsRef     = useRef(null);
    const lastLoadedXmlRef      = useRef(initialXml);
    const editorActionsRef      = useRef(null);
    const logoImgRef            = useRef(null);
    const watermarkImgRef       = useRef(null);
    const displayMenuRef        = useRef(null);
    const toolsMenuRef          = useRef(null);
    const downloadMenuRef       = useRef(null);

    // ─── Reload diagram when initialXml changes ───────────────────────────────
    useEffect(() => {
        if (initialXml && initialXml !== lastLoadedXmlRef.current && initialXml.trim().length > 100) {
            setCurrentXml(initialXml);
            lastLoadedXmlRef.current = initialXml;
        }
    }, [initialXml]);

    // ─── Close all dropdowns on outside click ─────────────────────────────────
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (displayMenuRef.current && !displayMenuRef.current.contains(event.target)) {
                setShowDisplayMenu(false);
            }
            if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target)) {
                setShowToolsMenu(false);
            }
            if (downloadMenuRef.current && !downloadMenuRef.current.contains(event.target)) {
                setShowDownloadMenu(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // ─── Preload images ───────────────────────────────────────────────────────
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

    // ─── Sync editor actions ref ──────────────────────────────────────────────
    useEffect(() => {
        editorActionsRef.current = {
            downloadPDF:  handleDownloadPDF,
            downloadSVG:  handleDownloadSVG,
            downloadBPMN: handleDownloadBPMN
        };
    }, []);

    // ─── Apply task data ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!modelerMethodsRef.current) return;
        if (!taskDataJson) return;
        try {
            const tasks = JSON.parse(taskDataJson);
            modelerMethodsRef.current.updateTasks(tasks);
            setIsTaskDataApplied(true);
        } catch (e) {
            console.error("Invalid task master data JSON", e);
        }
    }, [taskDataJson, modelerMethodsRef.current]);

    // ─── Fullscreen for simulation ────────────────────────────────────────────
    useEffect(() => {
        const el = document.documentElement;
        if (isSimulationMode) {
            if (el.requestFullscreen) el.requestFullscreen();
        } else {
            if (document.fullscreenElement) document.exitFullscreen();
        }
    }, [isSimulationMode]);

    // ─── Modeler ready ────────────────────────────────────────────────────────
    const handleModelerReady = async (methods) => {
        modelerMethodsRef.current = methods;
        setIsLoading(false);
        setIsTogglingComments(false);
        setIsTaskDataApplied(false);

        const modeler  = methods.getModeler();
        const eventBus = modeler.get("eventBus");

        eventBus.on("tokenSimulation.toggleMode", (event) => {
            setIsSimulationMode(!!event.active);
        });

        try {
            const { errors, warnings } = await methods.validateDiagram();
            setValidationResults({ errors, warnings });
            methods.applyValidationMarkers(errors, warnings);
            if (errors.length > 0) setError("Please fix validation errors.");
        } catch (e) {
            console.error("Auto validation failed", e);
        }
    };

    const handleError = (err) => {
        setError(err.message || "An error occurred while loading the diagram");
        setIsLoading(false);
    };

    // ─── Save ─────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!modelerMethodsRef.current) { setError("Modeler not ready"); return; }
        if (isReadOnly) { setError("Cannot save in read-only mode."); return; }

        try {
            setIsSaving(true);
            setError(null);

            const { errors, warnings } = await modelerMethodsRef.current.validateDiagram();
            setValidationResults({ errors, warnings });
            modelerMethodsRef.current.applyValidationMarkers(errors, warnings);

            if (errors.length > 0) {
                setError("Please fix validation errors before saving.");
                return;
            }

            if (onTasksExtracted && modelerMethodsRef.current.extractTasks) {
                onTasksExtracted(modelerMethodsRef.current.extractTasks());
            }

            const xml = await modelerMethodsRef.current.exportXML();
            const svg = await modelerMethodsRef.current.exportSVG();
            const base64SVG = btoa(unescape(encodeURIComponent(svg)));
            onSave?.(xml, `data:image/svg+xml;base64,${base64SVG}`);
        } catch (err) {
            console.error(err);
            setError("Failed to save diagram");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => onCancel?.();

    // ─── Zoom ─────────────────────────────────────────────────────────────────
    const MIN_ZOOM = 0.5;
    const MAX_ZOOM = 2.5;

    const handleZoomIn = () => {
        const canvas = modelerMethodsRef.current?.getModeler()?.get("canvas");
        if (canvas) canvas.zoom(Math.min(canvas.zoom() + 0.1, MAX_ZOOM));
    };

    const handleZoomOut = () => {
        const canvas = modelerMethodsRef.current?.getModeler()?.get("canvas");
        if (canvas) canvas.zoom(Math.max(canvas.zoom() - 0.1, MIN_ZOOM));
    };

    const handleZoomFit = () => modelerMethodsRef.current?.fitAndCenter?.();

    // ─── Panel tab handler ────────────────────────────────────────────────────
    // Clicking a tab activates it AND opens the panel if collapsed.
    const handleTabClick = (tab) => {
        setActiveTab(tab);
        setIsPanelOpen(true);
    };

    // ─── Filename helper ──────────────────────────────────────────────────────
    const sanitizeFilename = (name) => name?.trim() || "diagram";

    // ─── Bottleneck ───────────────────────────────────────────────────────────
    const handleBottleneckAnalysis = () => {
        if (!isTaskDataApplied) { alert("Task data is still loading. Please wait."); return; }
        if (!modelerMethodsRef.current?.extractTasks) return;

        const modeler = modelerMethodsRef.current.getModeler();

        if (isBottleneckMode) {
            clearBottleneckColors(modeler);
            setIsBottleneckMode(false);
            return;
        }

        const tasks = modelerMethodsRef.current.extractTasks();
        if (!tasks.filter(t => t.duration?.trim()).length) {
            alert("No tasks with duration found.");
            return;
        }

        applyBottleneckColors(modeler, tasks);
        setIsBottleneckMode(true);
    };

    // ─── Downloads ────────────────────────────────────────────────────────────
    const handleDownloadSVG = async () => {
        try {
            const svg  = await modelerMethodsRef.current.exportSVG();
            const blob = new Blob([svg], { type: "image/svg+xml" });
            const url  = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href     = url;
            link.download = `${sanitizeFilename(bpmnFile)}.svg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            setError("Failed to download SVG");
        }
    };

    const handleDownloadBPMN = async () => {
        try {
            const xml  = await modelerMethodsRef.current.exportXML();
            const blob = new Blob([xml], { type: "application/bpmn20+xml" });
            const url  = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href     = url;
            link.download = `${sanitizeFilename(bpmnFile)}.bpmn`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            setError("Failed to download BPMN");
        }
    };

    const addImageWatermark = (pdf, img) => {
        const pw = pdf.internal.pageSize.getWidth();
        const ph = pdf.internal.pageSize.getHeight();
        const ww = 120;
        const wh = ww * (img.naturalHeight / img.naturalWidth);
        pdf.saveGraphicsState();
        pdf.setGState(new pdf.GState({ opacity: 0.05 }));
        pdf.addImage(img, "PNG", (pw - ww) / 2, (ph - wh) / 2, ww, wh);
        pdf.restoreGraphicsState();
    };

    const handleDownloadPDF = async () => {
        try {
            setError(null);
            const svg     = await modelerMethodsRef.current.exportSVG();
            const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
            const url     = URL.createObjectURL(svgBlob);
            const img     = new Image();

            img.onload = () => {
                try {
                    const pdfWidth  = 210;
                    const pdfHeight = 297;
                    const margin    = 10;
                    const maxW      = pdfWidth  - 2 * margin;
                    const maxH      = pdfHeight - 2 * margin;
                    const ratio     = Math.min(maxW / (img.width * 0.264583), maxH / (img.height * 0.264583), 1);
                    const finalW    = img.width  * 0.264583 * ratio;
                    const finalH    = img.height * 0.264583 * ratio;

                    const pdf = new jsPDF({
                        orientation: finalW > finalH ? "landscape" : "portrait",
                        unit: "mm",
                        format: "a4"
                    });

                    const canvas = document.createElement("canvas");
                    canvas.width  = img.width;
                    canvas.height = img.height;
                    canvas.getContext("2d").drawImage(img, 0, 0);
                    const imgData = canvas.toDataURL("image/png");

                    if (logoImgRef.current) pdf.addImage(logoImgRef.current, "PNG", 10, 10, 18.4, 14.6);

                    pdf.setFontSize(14);
                    pdf.setFont("helvetica", "bold");
                    pdf.text(sanitizeFilename(bpmnFile), pdf.internal.pageSize.getWidth() / 2, 18, { align: "center" });
                    pdf.setDrawColor(200);
                    pdf.line(10, 25, pdf.internal.pageSize.getWidth() - 10, 25);

                    const x = (pdf.internal.pageSize.getWidth()  - finalW) / 2;
                    const y = (pdf.internal.pageSize.getHeight() - finalH) / 2;
                    pdf.addImage(imgData, "PNG", x, y, finalW, finalH);

                    if (watermarkImgRef.current) addImageWatermark(pdf, watermarkImgRef.current);

                    pdf.save(`${sanitizeFilename(bpmnFile)}.pdf`);
                    URL.revokeObjectURL(url);
                } catch (err) {
                    console.error(err);
                    setError("Failed to generate PDF.");
                    URL.revokeObjectURL(url);
                }
            };

            img.onerror = () => { setError("Failed to load diagram for PDF."); URL.revokeObjectURL(url); };
            img.src = url;
        } catch (err) {
            console.error(err);
            setError("Failed to download PDF");
        }
    };

    // ─── Open file ────────────────────────────────────────────────────────────
    const handleOpenFile = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
        if (![".bpmn", ".xml", ".bpmn20.xml"].includes(ext)) {
            setError("Invalid file type. Please select a .bpmn or .xml file");
            return;
        }

        setIsImporting(true);
        setError(null);

        const reader = new FileReader();
        reader.onload = (e) => {
            setCurrentXml(e.target.result);
            lastLoadedXmlRef.current = e.target.result;
            setIsImporting(false);
        };
        reader.onerror = () => { setError("Failed to read file."); setIsImporting(false); };
        reader.readAsText(file);
        event.target.value = "";
    };

    // ─── Grouped warnings ─────────────────────────────────────────────────────
    const groupedWarnings = validationResults.warnings.reduce((acc, w) => {
        acc[w.ruleId] = acc[w.ruleId] || [];
        acc[w.ruleId].push(w);
        return acc;
    }, {});

    // ─── Validation issue → canvas ────────────────────────────────────────────
    const issueKey = (issue, severity) =>
        `${severity}-${issue.ruleId}-${issue.elementId || "global"}`;

    /** Label shown in the panel: element name, readable type, or the diagram itself */
    const issueLabel = issue => {
        if (!issue.elementId) return "Whole diagram";
        return issue.elementName || issue.elementType || issue.elementId;
    };

    const handleIssueClick = (issue, severity) => {
        const key = issueKey(issue, severity);

        // Clicking the selected issue again clears the highlight
        if (selectedIssueKey === key) {
            setSelectedIssueKey(null);
            modelerMethodsRef.current?.clearFocus?.();
            return;
        }

        setSelectedIssueKey(key);

        if (issue.elementId) {
            modelerMethodsRef.current?.focusElement(issue.elementId);
        } else {
            modelerMethodsRef.current?.clearFocus?.();
        }
    };

    // Hiding the panel / leaving the Validation tab drops the canvas highlight
    useEffect(() => {
        if (!selectedIssueKey) return;
        if (isPanelOpen && !isSimulationMode && activeTab === "validation") return;

        setSelectedIssueKey(null);
        modelerMethodsRef.current?.clearFocus?.();
    }, [isPanelOpen, activeTab, isSimulationMode, selectedIssueKey]);

    // Drop the selection (and its canvas highlight) once the issue is resolved
    useEffect(() => {
        if (!selectedIssueKey) return;

        const stillOpen = [
            ...validationResults.errors.map(e => issueKey(e, "error")),
            ...validationResults.warnings.map(w => issueKey(w, "warning"))
        ].includes(selectedIssueKey);

        if (!stillOpen) {
            setSelectedIssueKey(null);
            modelerMethodsRef.current?.clearFocus?.();
        }
    }, [validationResults, selectedIssueKey]);

    // ─── SVG icons (inline — no asset imports needed) ─────────────────────────
    const IconZoomOut = () => (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
    );
    const IconZoomIn = () => (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
    );
    const IconFit = () => (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
            <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
        </svg>
    );
    const IconDownload = () => (
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/>
            <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>
        </svg>
    );
    const IconEye = () => (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
        </svg>
    );
    const IconTools = () => (
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
    );
    const IconClock = () => (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
    );
    const IconComment = () => (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
    );
    const IconCompare = () => (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
    );
    const IconFolder = () => (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
    );
    const IconKeyboard = () => (
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
    );

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <div className={`bpmn-editor-container ${isReadOnly ? "readonly-mode" : ""}`}>

            {/* ═══════════════════════════ TOOLBAR ═══════════════════════════ */}
            {!isSimulationMode && (
                <div className="bpmn-toolbar">

                    {/* ── LEFT ── */}
                    <div className="bpmn-toolbar-left">

                        {/* Title */}
                        <span className="bpmn-title">BPMN Diagram</span>
                        {isReadOnly && <span className="bpmn-readonly-badge">Read-Only</span>}

                        <div className="bpmn-toolbar-divider" />

                        {/* Zoom Out */}
                        <button
                            type="button"
                            className="bpmn-btn bpmn-btn-icon"
                            onClick={handleZoomOut}
                            disabled={isLoading}
                            title="Zoom Out"
                        >
                            <IconZoomOut />
                        </button>

                        {/* Zoom In */}
                        <button
                            type="button"
                            className="bpmn-btn bpmn-btn-icon"
                            onClick={handleZoomIn}
                            disabled={isLoading}
                            title="Zoom In"
                        >
                            <IconZoomIn />
                        </button>

                        {/* Fit */}
                        <button
                            type="button"
                            className="bpmn-btn bpmn-btn-icon"
                            onClick={handleZoomFit}
                            disabled={isLoading}
                            title="Fit to Screen"
                        >
                            <IconFit />
                        </button>

                        <div className="bpmn-toolbar-divider" />

                        {/* ── READ-ONLY: single download dropdown ── */}
                        {isReadOnly && (
                            <div className="bpmn-dropdown-wrapper" ref={downloadMenuRef}>
                                <button
                                    type="button"
                                    className={`bpmn-btn bpmn-btn-icon ${showDownloadMenu ? "active" : ""}`}
                                    onClick={() => setShowDownloadMenu(prev => !prev)}
                                    disabled={isLoading}
                                    title="Download"
                                >
                                    <IconDownload />
                                </button>

                                {showDownloadMenu && (
                                    <div className="bpmn-dropdown-menu">
                                        <div
                                            className="bpmn-menu-item"
                                            onClick={() => { handleDownloadBPMN(); setShowDownloadMenu(false); }}
                                        >
                                            <IconDownload /> Download BPMN
                                        </div>
                                        <div
                                            className="bpmn-menu-item"
                                            onClick={() => { handleDownloadSVG(); setShowDownloadMenu(false); }}
                                        >
                                            <IconDownload /> Download SVG
                                        </div>
                                        <div
                                            className="bpmn-menu-item"
                                            onClick={() => { handleDownloadPDF(); setShowDownloadMenu(false); }}
                                        >
                                            <IconDownload /> Download PDF
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── EDITABLE: Display + Tools dropdowns ── */}
                        {!isReadOnly && (
                            <div className="bpmn-editable-controls">
                                {/* Display dropdown */}
                                <div className="bpmn-dropdown-wrapper" ref={displayMenuRef}>
                                    <button
                                        type="button"
                                        className={`bpmn-btn bpmn-btn-dropdown ${showDisplayMenu ? "active" : ""}`}
                                        onClick={() => {
                                            setShowDisplayMenu(prev => !prev);
                                            setShowToolsMenu(false);
                                        }}
                                        disabled={isLoading}
                                    >
                                        <IconEye />
                                        Display
                                        <span className="bpmn-dropdown-caret">▾</span>
                                    </button>

                                    {showDisplayMenu && (
                                        <div className="bpmn-dropdown-menu">
                                            <div
                                                className="bpmn-menu-item"
                                                onClick={() => {
                                                    handleBottleneckAnalysis();
                                                    setShowDisplayMenu(false);
                                                }}
                                            >
                                                <IconClock />
                                                {isBottleneckMode ? "Hide Bottleneck" : "Bottleneck Analysis"}
                                            </div>

                                            <div
                                                className="bpmn-menu-item"
                                                onClick={() => {
                                                    setIsTogglingComments(true);
                                                    setShowComments(prev => !prev);
                                                    setShowDisplayMenu(false);
                                                }}
                                            >
                                                <IconComment />
                                                {showComments ? "Hide Comments" : "Show Comments"}
                                            </div>

                                            <div
                                                className="bpmn-menu-item"
                                                onClick={() => {
                                                    setShowDiff(true);
                                                    setShowDisplayMenu(false);
                                                }}
                                            >
                                                <IconCompare />
                                                Compare Versions
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Tools dropdown */}
                                <div className="bpmn-dropdown-wrapper" ref={toolsMenuRef}>
                                    <button
                                        type="button"
                                        className={`bpmn-btn bpmn-btn-dropdown ${showToolsMenu ? "active" : ""}`}
                                        onClick={() => {
                                            setShowToolsMenu(prev => !prev);
                                            setShowDisplayMenu(false);
                                        }}
                                        disabled={isLoading}
                                    >
                                        <IconTools />
                                        Tools
                                        <span className="bpmn-dropdown-caret">▾</span>
                                    </button>

                                    {showToolsMenu && (
                                        <div className="bpmn-dropdown-menu">
                                            <div
                                                className="bpmn-menu-item"
                                                onClick={() => {
                                                    fileInputRef.current?.click();
                                                    setShowToolsMenu(false);
                                                }}
                                            >
                                                <IconFolder /> Open File
                                            </div>

                                            <div
                                                className="bpmn-menu-item"
                                                onClick={() => { handleDownloadBPMN(); setShowToolsMenu(false); }}
                                            >
                                                <IconDownload /> Download BPMN
                                            </div>

                                            <div
                                                className="bpmn-menu-item"
                                                onClick={() => { handleDownloadSVG(); setShowToolsMenu(false); }}
                                            >
                                                <IconDownload /> Download SVG
                                            </div>

                                            <div
                                                className="bpmn-menu-item"
                                                onClick={() => { handleDownloadPDF(); setShowToolsMenu(false); }}
                                            >
                                                <IconDownload /> Download PDF
                                            </div>

                                            <div
                                                className="bpmn-menu-item"
                                                onClick={() => {
                                                    setShowKeyboardShortcuts(true);
                                                    setShowToolsMenu(false);
                                                }}
                                            >
                                                <IconKeyboard /> Keyboard Shortcuts
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Hidden file input */}
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".bpmn,.xml,.bpmn20.xml"
                                    onChange={handleOpenFile}
                                    style={{ display: "none" }}
                                />
                            </div>
                        )}
                    </div>

                    {/* ── CENTER (empty — keeps grid balanced) ── */}
                    <div className="bpmn-toolbar-center" />

                    {/* ── RIGHT ── */}
                    <div className="bpmn-toolbar-right">
                        {onCancel && (
                            <button
                                type="button"
                                className="bpmn-btn bpmn-btn-secondary"
                                onClick={handleCancel}
                                disabled={isSaving}
                            >
                                {isReadOnly ? "Close" : "Cancel"}
                            </button>
                        )}

                        {onSave && !isReadOnly && (
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

            {/* ── Error banner ── */}
            {error && !isReadOnly && (
                <div className="bpmn-error-banner">
                    <span className="bpmn-error-icon">⚠</span>
                    <span className="bpmn-error-text">{error}</span>
                    <button type="button" className="bpmn-error-close" onClick={() => setError(null)}>×</button>
                </div>
            )}

            {/* ── Loading ── */}
            {isLoading && (
                <div className="bpmn-loading">
                    <div className="bpmn-loading-spinner" />
                    <p>Loading BPMN Editor...</p>
                </div>
            )}

            {/* ═══════════════════════════ WORKSPACE ═════════════════════════ */}
            <div className="bpmn-workspace">

                {/* Canvas */}
                <div className="bpmn-canvas-wrapper">
                    <BpmnModelerComponent
                        initialXml={currentXml}
                        showComments={showComments}
                        onError={handleError}
                        onModelerReady={handleModelerReady}
                        editorActionsRef={editorActionsRef}
                        onValidate={(errors, warnings) => {
                            setValidationResults({ errors, warnings });
                            modelerMethodsRef.current?.applyValidationMarkers(errors, warnings);
                        }}
                        isSimulationMode={isSimulationMode}
                        isReadOnly={isReadOnly}
                        onTaskAction={onTaskAction}
                    />
                </div>

                {/* ═══════════════════════ BOTTOM DOCKED PANEL ═══════════════════
                    Tabs for Properties + Validation. Sits below the canvas so the
                    canvas gets full width. `#js-properties-panel` is kept mounted
                    at all times (only display-toggled) because bpmn-js's
                    propertiesPanel.attachTo() binding requires the node to persist. */}
                {!isSimulationMode && (
                    <div className={`bpmn-bottom-panel ${isPanelOpen ? "" : "collapsed"}` }>
                        <div className="bpmn-panel-tabs"  onClick={() => setIsPanelOpen(prev => !prev)}>
                            <div className="bpmn-panel-tabs-group">
                                <button
                                    type="button"
                                    className={`bpmn-panel-tab ${activeTab === "properties" ? "active" : ""}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleTabClick("properties");
                                    }}
                                >
                                    Properties
                                </button>
                                <button
                                    type="button"
                                    className={`bpmn-panel-tab ${activeTab === "validation" ? "active" : ""}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleTabClick("validation");
                                    }}
                                >
                                    Validation
                                    {(validationResults.errors.length + Object.keys(groupedWarnings).length) > 0 && (
                                        <span className={`bpmn-tab-badge ${validationResults.errors.length > 0 ? "error" : "warning"}`}>
                                            {validationResults.errors.length + Object.keys(groupedWarnings).length}
                                        </span>
                                    )}
                                </button>
                            </div>
                            <button
                                type="button"
                                className="bpmn-panel-collapse-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsPanelOpen(prev => !prev);
                                }}
                                title={isPanelOpen ? "Hide panel" : "Show panel"}
                            >
                                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                                    <polyline
                                        points={isPanelOpen ? "4,6 8,10 12,6" : "4,10 8,6 12,10"}
                                        stroke="currentColor" strokeWidth="1.5"
                                        strokeLinecap="round" strokeLinejoin="round"
                                    />
                                </svg>
                                <span>{isPanelOpen ? "Hide panel" : "Show panel"}</span>
                            </button>
                        </div>

                        <div className="bpmn-panel-content">
                            {/* Properties pane — display-toggled, not unmounted */}
                            <div
                                className="bpmn-panel-pane properties-pane"
                                style={{ display: activeTab === "properties" ? "block" : "none" }}
                            >
                                <div id="js-properties-panel" className="panel-content" />
                            </div>

                            {/* Validation pane — safe to unmount, no external bindings */}
                            {activeTab === "validation" && (
                                <div className="bpmn-panel-pane validation-pane">
                                    <div className="validation-content">
                                        {validationResults.errors.length === 0 && (
                                            <div className="validation-errors">
                                                <h5 className="no-error-content">No Validation Errors!</h5>
                                            </div>
                                        )}

                                        {validationResults.errors.length > 0 && (
                                            <div className="validation-errors">
                                                <h5 className="error-title">Errors</h5>
                                                {validationResults.errors.map((e, i) => (
                                                    <div
                                                        key={`error-${i}`}
                                                        className={`validation-item error ${selectedIssueKey === issueKey(e, "error") ? "selected" : ""}`}
                                                        onClick={() => handleIssueClick(e, "error")}
                                                        title={e.elementId ? `${issueLabel(e)} (${e.elementId})` : e.message}
                                                    >
                                                        <span className="validation-item-message">{e.message}</span>
                                                        {e.elementId && (
                                                            <span className="validation-item-element">{issueLabel(e)}</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}

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
                                                                    className={`validation-item warning ${selectedIssueKey === issueKey(w, "warning") ? "selected" : ""}`}
                                                                    onClick={() => handleIssueClick(w, "warning")}
                                                                    title={w.elementId ? `${issueLabel(w)} (${w.elementId})` : w.message}
                                                                >
                                                                    <span className="validation-item-element">{issueLabel(w)}</span>
                                                                    {w.elementType && !issueLabel(w).includes(w.elementType) && (
                                                                        <span className="validation-item-type">{w.elementType}</span>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ═══════════════════════ KEYBOARD SHORTCUTS MODAL ══════════════ */}
            {showKeyboardShortcuts && (
                <div className="keyboard-shortcuts-overlay" onClick={() => setShowKeyboardShortcuts(false)}>
                    <div className="keyboard-shortcuts-modal" onClick={e => e.stopPropagation()}>
                        <div className="keyboard-shortcuts-header">
                            <h3>Keyboard Shortcuts</h3>
                            <button className="keyboard-shortcuts-close" onClick={() => setShowKeyboardShortcuts(false)}>×</button>
                        </div>
                        <div className="keyboard-shortcuts-content">
                            <div className="shortcuts-section">
                                {[
                                    ["Open file",              "Ctrl", "O"],
                                    ["Download BPMN",          "Ctrl", "S"],
                                    ["Download PDF",           "Ctrl", "D"],
                                    ["Download SVG",           "Ctrl", "I"],
                                    ["Undo",                   "Ctrl", "Z"],
                                    ["Redo",                   "Ctrl", "⇧", "Z"],
                                    ["Select All",             "Ctrl", "A"],
                                    ["Direct Editing",         "E"],
                                    ["Hand Tool (Pan)",        "H"],
                                    ["Lasso Tool",             "L"],
                                    ["Space Tool",             "S"],
                                    ["Replace Tool",           "R"],
                                    ["Append anything",        "A"],
                                    ["Create anything",        "N"],
                                ].map(([desc, ...keys]) => (
                                    <div className="shortcut-item" key={desc}>
                                        <span className="shortcut-description">{desc}</span>
                                        <span className="shortcut-keys">
                                            {keys.map((k, i) => (
                                                <span key={i}>{i > 0 && " + "}<kbd>{k}</kbd></span>
                                            ))}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ══════════════════════════ DIFF VIEWER ════════════════════════ */}
            {showDiff && (
                <BpmnDiff
                    onClose={() => setShowDiff(false)}
                    currentXml={currentXml}
                />
            )}
        </div>
    );
};

export default BpmnEditor;