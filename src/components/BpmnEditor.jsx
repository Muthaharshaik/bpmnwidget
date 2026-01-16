import { createElement, useState, useRef, useEffect } from "react";
import BpmnModelerComponent from "./BpmnModeler";
import folderIcon from "../assets/folder-closed.svg";
import plusIcon from "../assets/zoom-in.svg";
import minusIcon from "../assets/zoom-out.svg";
import resetIcon from "../assets/move-diagonal.svg";
import downloadIcon from "../assets/download.svg";
import keyboardIcon from "../assets/keyboard.svg";
import jsPDF from "jspdf";

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

export const BpmnEditor = ({ 
    initialXml, 
    onSave, 
    onCancel,
    bpmnFile
}) => {
    // State management
    const [error, setError] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isImporting, setIsImporting] = useState(false);
    const [open, setOpen] = useState(false);
    const [currentXml, setCurrentXml] = useState(initialXml);
    const [showKeyboardShortcuts, setShowKeyboardShortcuts] = useState(false);
    const [validationResults, setValidationResults] = useState({  errors: [], warnings: []});


    
    // Refs
    const fileInputRef = useRef(null);
    const modelerMethodsRef = useRef(null);
    const lastLoadedXmlRef = useRef(initialXml);
    const editorActionsRef = useRef(null);

    /**
     * Only reload diagram if we're opening a genuinely different diagram
     * This prevents unwanted re-imports when user is editing
     */
    useEffect(() => {
        if (initialXml && 
            initialXml !== lastLoadedXmlRef.current && 
            initialXml.trim().length > 100) {
            
            console.log("New diagram detected, reloading editor");
            setCurrentXml(initialXml);
            lastLoadedXmlRef.current = initialXml;
        }
    }, [initialXml]);

    /**
     * Close dropdown menu when clicking outside
     */
    useEffect(() => {
        const handleClickOutside = (event) => {
            const downloadWrapper = event.target.closest('.download-wrapper');
            if (!downloadWrapper && open) {
                setOpen(false);
            }
        };

        if (open) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [open]);

    /**
     * Handle modeler initialization
     */
    const handleModelerReady = async (methods) => {
        modelerMethodsRef.current = methods;
        setIsLoading(false);
            // 🔁 AUTO-RUN VALIDATION ON LOAD
        try {
        const { errors, warnings } = await methods.validateDiagram();

        setValidationResults({ errors, warnings });
        methods.applyValidationMarkers(errors, warnings);

        // Optional: show blocking message immediately
        if (errors.length > 0) {
            setError("Please fix validation errors.");
        }
        } catch (e) {
        console.error("Auto validation failed", e);
        }
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
    if (!modelerMethodsRef.current) {
        setError("Modeler not ready");
        return;
    }

    try {
        setIsSaving(true);
        setError(null);

        // 🔴 VALIDATION FIRST
        const { errors, warnings  } = await modelerMethodsRef.current.validateDiagram();

        setValidationResults({ errors, warnings });
        modelerMethodsRef.current.applyValidationMarkers(errors, warnings);
        if (errors.length > 0) {
        setError("Please fix validation errors before saving.");
        return;
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
     * Sanitize the file names
     */
    const sanitizeFilename = (name) => {
        if (!name || !name.trim()) {
            return null;
        }
        return name.trim();
    }

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
        } catch(error) {
           console.error("Error downloading BPMN", error);
           setError("Failed to download diagram");
        }
    };

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
            const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
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
                    const maxWidth = pdfWidth - (2 * margin);
                    const maxHeight = pdfHeight - (2 * margin);
                    
                    let finalWidth = imgWidth;
                    let finalHeight = imgHeight;
                    
                    // Scale down if image is larger than page
                    const widthRatio = maxWidth / (imgWidth * 0.264583); // px to mm conversion
                    const heightRatio = maxHeight / (imgHeight * 0.264583);
                    const ratio = Math.min(widthRatio, heightRatio, 1);
                    
                    finalWidth = (imgWidth * 0.264583) * ratio;
                    finalHeight = (imgHeight * 0.264583) * ratio;
                    
                    // Determine orientation based on dimensions
                    const orientation = finalWidth > finalHeight ? 'landscape' : 'portrait';
                    
                    // Create PDF
                    const pdf = new jsPDF({
                        orientation: orientation,
                        unit: 'mm',
                        format: 'a4'
                    });
                    
                    // Center the image on the page
                    const x = (pdf.internal.pageSize.getWidth() - finalWidth) / 2;
                    const y = (pdf.internal.pageSize.getHeight() - finalHeight) / 2;
                    
                    // Convert SVG to data URL
                    const canvas = document.createElement('canvas');
                    canvas.width = imgWidth;
                    canvas.height = imgHeight;
                    const ctx = canvas.getContext('2d');
                    
                    // Draw image on canvas
                    ctx.drawImage(img, 0, 0);
                    
                    // Get image data as PNG
                    const imgData = canvas.toDataURL('image/png');
                    
                    // Add image to PDF
                    pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
                    
                    // Save the PDF
                    pdf.save(`${sanitizeFilename(bpmnFile)}.pdf`);
                    
                    // Cleanup
                    URL.revokeObjectURL(url);
                    
                } catch (err) {
                    console.error('Error creating PDF:', err);
                    setError('Failed to generate PDF. Please try again.');
                    URL.revokeObjectURL(url);
                }
            };
            
            img.onerror = () => {
                console.error('Error loading SVG image');
                setError('Failed to load diagram for PDF generation');
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
    const handleOpenFile = (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        
        // Validate file type
        const validExtensions = [".bpmn", ".xml", ".bpmn20.xml"];
        const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        if (!validExtensions.includes(fileExtension)) {
            setError('Invalid file type. Please select a .bpmn or .xml file');
            return;
        }
        
        setIsImporting(true);
        setError(null);
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const xmlContent = e.target.result;
                
                // Update XML state - this will trigger BpmnModeler to reload
                setCurrentXml(xmlContent);
                lastLoadedXmlRef.current = xmlContent;
                setIsImporting(false);
                
            } catch(err) {
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
        event.target.value = '';
    };

    useEffect(() => {
    editorActionsRef.current = {
        downloadPDF: handleDownloadPDF,
        downloadSVG: handleDownloadSVG,
        downloadBPMN: handleDownloadBPMN,
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
            <div className="bpmn-toolbar">
                <div className="bpmn-toolbar-left">
                    <h3 className="bpmn-title">
                        BPMN Diagram
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
                        <img src={plusIcon} style={{width:18, height:18}} alt="Zoom In" />
                    </button>
                    
                    <button
                        type="button"
                        className="bpmn-btn bpmn-btn-icon"
                        onClick={handleZoomOut}
                        title="Zoom Out"
                        disabled={isLoading}
                    >
                        <img src={minusIcon} style={{width:18, height:18}} alt="Zoom Out" />
                    </button>
                    
                    <button
                        type="button"
                        className="bpmn-btn bpmn-btn-icon"
                        onClick={handleZoomFit}
                        title="Fit to Screen"
                        disabled={isLoading}
                    >
                        <img src={resetIcon} style={{width:18, height:18}} alt="Fit to Screen" />
                    </button>
                    
                    {/* Hidden file input */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".bpmn,.xml,.bpmn20.xml"
                        onChange={handleOpenFile}
                        style={{ display: 'none' }}
                    />
                    
                    {/* Open File button */}
                    <button
                        type="button"
                        className="bpmn-btn bpmn-btn-secondary"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isLoading || isImporting}
                        title="Open BPMN diagram from local file system"
                    >
                        <img src={folderIcon} style={{width:18, height:18}} alt="Open File" />
                    </button>

                    {/* Download dropdown menu */}
                    <div className="download-wrapper">
                        <button
                            type="button"
                            className="bpmn-btn bpmn-btn-secondary download-btn"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setOpen(prev => !prev);
                            }}
                            disabled={isLoading}
                            title="Download diagram"
                        >
                            <img src={downloadIcon} style={{width:18, height:18}} alt="Download" />
                        </button>

                        {open && (
                            <div 
                                className="download-menu"
                                onMouseDown={(e) => e.stopPropagation()}
                            >
                                <div 
                                    className="download-item"
                                    onClick={(e) => {
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
                                    onClick={(e) => {
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
                                    onClick={(e) => {
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
                        <img src={keyboardIcon} style={{width: 18, height:18}} alt="Key Board" />
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
                />
            </div>

            {/* Validation Panel (RIGHT SIDE) */}
            <div className="bpmn-validation-panel">
                <h4>Validation</h4>
            {/* ERRORS */}
            {validationResults.errors.length > 0 && (
            <div>
                <h5 className="error-title">Errors</h5>
                {validationResults.errors.map((e, i) => (
                <div
                    key={`error-${i}`}
                    className="validation-item error"
                    onClick={() =>
                    modelerMethodsRef.current?.focusElement(e.elementId)
                    }
                >
                    {e.message}
                </div>
                ))}
            </div>
            )}

            {/* WARNINGS */}
            {Object.keys(groupedWarnings).length > 0 && (
            <div>
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

            {/* Keyboard Shortcuts Modal */}
            {showKeyboardShortcuts && (
                <div 
                    className="keyboard-shortcuts-overlay"
                    onClick={() => setShowKeyboardShortcuts(false)}
                >
                    <div 
                        className="keyboard-shortcuts-modal"
                        onClick={(e) => e.stopPropagation()}
                    >
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