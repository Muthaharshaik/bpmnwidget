import { useEffect, useRef, useState, createElement} from "react";
import BpmnViewer from "bpmn-js/lib/NavigatedViewer";
import * as differ from "bpmn-js-differ";

export const BpmnDiff = ({ onClose, currentXml }) => {
    const [versionA, setVersionA] = useState(null);
    const [versionB, setVersionB] = useState(null);
    const [changes, setChanges] = useState(null);
    const [viewerAReady, setViewerAReady] = useState(false);
    const [viewerBReady, setViewerBReady] = useState(false);

    
    const viewerARef = useRef(null);
    const viewerBRef = useRef(null);
    const containerARef = useRef(null);
    const containerBRef = useRef(null);
    const fileInputARef = useRef(null);
    const fileInputBRef = useRef(null);

    // Initialize viewers
    useEffect(() => {
        if (!containerARef.current || !containerBRef.current) return;

        viewerARef.current = new BpmnViewer({
            container: containerARef.current
        });

        viewerBRef.current = new BpmnViewer({
            container: containerBRef.current
        });

        return () => {
            viewerARef.current?.destroy();
            viewerBRef.current?.destroy();
        };
    }, []);

    // Load and compare diagrams
    useEffect(() => {
        // ✅ Auto-load current diagram into Version A
        if (currentXml && !versionA) {
            setVersionA(currentXml);
        }
    }, [currentXml]);

    useEffect(() => {
        if (!versionA || !viewerARef.current) return;
        setViewerAReady(false)
        viewerARef.current
              .importXML(versionA)
              .then(() => {
                viewerARef.current.get('canvas').zoom('fit-viewport');
                setViewerAReady(true);
              })
              .catch(err => {
                console.error("Error Loading version A", err)
              })
    },[versionA])

    useEffect(() => {
        if(!versionB || !viewerBRef.current) return;
        setViewerBReady(false)
        viewerBRef.current
              .importXML(versionB)
              .then(() => {
                viewerBRef.current.get('canvas').zoom('fit-viewport');
                setViewerBReady(true); 
              })
              .catch(err => {
                console.error("Error Loading version B", err)
              })
    },[versionB])

    // Load and compare diagrams
// Compute diff only when BOTH viewers are ready
useEffect(() => {
    if (!viewerAReady || !viewerBReady) return;

    const defsA = viewerARef.current.getDefinitions();
    const defsB = viewerBRef.current.getDefinitions();

    if (!defsA || !defsB) return;

    // ✅ Clear previous markers before applying new ones
    const canvasA = viewerARef.current.get('canvas');
    const canvasB = viewerBRef.current.get('canvas');
    const registryA = viewerARef.current.get('elementRegistry');
    const registryB = viewerBRef.current.get('elementRegistry');

    // Clear all previous diff markers
    registryA.getAll().forEach(el => {
        canvasA.removeMarker(el.id, 'diff-added');
        canvasA.removeMarker(el.id, 'diff-removed');
        canvasA.removeMarker(el.id, 'diff-changed');
        canvasA.removeMarker(el.id, 'diff-layout-changed');
    });

    registryB.getAll().forEach(el => {
        canvasB.removeMarker(el.id, 'diff-added');
        canvasB.removeMarker(el.id, 'diff-removed');
        canvasB.removeMarker(el.id, 'diff-changed');
        canvasB.removeMarker(el.id, 'diff-layout-changed');
    });

    const diffResult = differ.diff(defsA, defsB);
    setChanges(diffResult);

    applyDiffMarkers(viewerARef.current, diffResult, 'old');
    applyDiffMarkers(viewerBRef.current, diffResult, 'new');
}, [viewerAReady, viewerBReady]);

    const handleFileLoad = (file, setVersion) => {
        const reader = new FileReader();
        reader.onload = (e) => setVersion(e.target.result);
        reader.readAsText(file);
    };

    return (
        <div className="bpmn-diff-container">
            {/* Header */}
            <div className="diff-header">
                <h2>BPMN Diagram Comparison</h2>
                <button className="diff-close-btn" onClick={onClose}>×</button>
            </div>

            {/* Viewers Container */}
            <div className="diff-viewers">
                {/* Version A */}
                <div className="diff-viewer-wrapper">
                    <div className="diff-viewer-header">
                        <span className="version-label">version A (Current)</span>
                        <span className="version-status">
                            {versionA ? 'Loaded' : 'Loading...'}
                        </span>
                    </div>
                    <div ref={containerARef} className="diff-canvas" />
                </div>

                {/* Version B */}
                <div className="diff-viewer-wrapper">
                    <div className="diff-viewer-header">
                        <span className="version-label">version B</span>
                        <input
                            ref={fileInputBRef}
                            type="file"
                            accept=".bpmn,.xml"
                            style={{ display: 'none' }}
                            onChange={(e) => handleFileLoad(e.target.files[0], setVersionB)}
                        />
                        <button 
                            className="choose-file-btn"
                            onClick={() => fileInputBRef.current?.click()}
                        >
                            Choose file
                        </button>
                    </div>
                    <div ref={containerBRef} className="diff-canvas" />
                </div>
            </div>

            {/* Changes Panel */}
            {changes && (
                <div className="diff-changes-panel">
                    <button className="changes-toggle-btn">
                        List of Changes
                    </button>
                    <div className="changes-list">
                        <ChangesList changes={changes} />
                    </div>
                </div>
            )}
        </div>
    );
};

// Apply diff markers to viewer
function applyDiffMarkers(viewer, diffResult, side) {
    const canvas = viewer.get('canvas');
    const elementRegistry = viewer.get('elementRegistry');

    // Added elements (only show in version B)
    if (side === 'new') {
        Object.keys(diffResult._added).forEach(id => {
            const element = elementRegistry.get(id);
            if (element) canvas.addMarker(id, 'diff-added');
        });
    }

    // Removed elements (only show in version A)
    if (side === 'old') {
        Object.keys(diffResult._removed).forEach(id => {
            const element = elementRegistry.get(id);
            if (element) canvas.addMarker(id, 'diff-removed');
        });
    }

    // Changed elements (show in both)
    Object.keys(diffResult._changed).forEach(id => {
        const element = elementRegistry.get(id);
        if (element) canvas.addMarker(id, 'diff-changed');
    });

    // Layout changed (position/size changes)
    Object.keys(diffResult._layoutChanged).forEach(id => {
        const element = elementRegistry.get(id);
        if (element) canvas.addMarker(id, 'diff-layout-changed');
    });
}

// Changes list component
function ChangesList({ changes }) {
    const added = Object.keys(changes._added);
    const removed = Object.keys(changes._removed);
    const changed = Object.keys(changes._changed);
    const layoutChanged = Object.keys(changes._layoutChanged);

    return (
        <div className="changes-content">
            {added.length > 0 && (
                <div className="change-group">
                    <h4 className="change-group-title added">Added ({added.length})</h4>
                    {added.map(id => (
                        <div key={id} className="change-item added">+ {id}</div>
                    ))}
                </div>
            )}
            
            {removed.length > 0 && (
                <div className="change-group">
                    <h4 className="change-group-title removed">Removed ({removed.length})</h4>
                    {removed.map(id => (
                        <div key={id} className="change-item removed">- {id}</div>
                    ))}
                </div>
            )}
            
            {changed.length > 0 && (
                <div className="change-group">
                    <h4 className="change-group-title changed">Changed ({changed.length})</h4>
                    {changed.map(id => (
                        <div key={id} className="change-item changed">~ {id}</div>
                    ))}
                </div>
            )}

            {layoutChanged.length > 0 && (
                <div className="change-group">
                    <h4 className="change-group-title layout">Layout Changed ({layoutChanged.length})</h4>
                    {layoutChanged.map(id => (
                        <div key={id} className="change-item layout">↔ {id}</div>
                    ))}
                </div>
            )}
        </div>
    );
}