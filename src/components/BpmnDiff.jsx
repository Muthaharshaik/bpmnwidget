import { useEffect, useRef, useState, useCallback, createElement } from "react";
import BpmnViewer from "bpmn-js/lib/NavigatedViewer";
import * as differ from "bpmn-js-differ";

const DIFF_MARKERS = ["diff-added", "diff-removed", "diff-changed", "diff-layout-changed", "diff-focused"];

/**
 * Side-by-side comparison of two BPMN diagrams.
 *
 * Rendered when the widget's Mode is Compare, which is meant for a dedicated
 * Mendix comparison page. Both diagrams arrive as Mendix attributes:
 *   xmlA - BPMN XML, the current version
 *   xmlB - Compare XML, the version picked in the Mendix dropdown
 *
 * There are no editing or closing controls: navigation belongs to the page.
 */
export const BpmnDiff = ({ xmlA, xmlB, labelA, labelB, diagramName }) => {
    const [changes, setChanges]         = useState(null);
    const [viewerAReady, setViewerAReady] = useState(false);
    const [viewerBReady, setViewerBReady] = useState(false);
    const [loadError, setLoadError]     = useState(null);
    const [isPanelOpen, setIsPanelOpen] = useState(true);
    const [syncViews, setSyncViews]     = useState(true);
    const [focusedId, setFocusedId]     = useState(null);

    const viewerARef    = useRef(null);
    const viewerBRef    = useRef(null);
    const containerARef = useRef(null);
    const containerBRef = useRef(null);

    // ─── Create the two viewers once ──────────────────────────────────────────
    useEffect(() => {
        if (!containerARef.current || !containerBRef.current) return;

        viewerARef.current = new BpmnViewer({ container: containerARef.current });
        viewerBRef.current = new BpmnViewer({ container: containerBRef.current });

        return () => {
            viewerARef.current?.destroy();
            viewerBRef.current?.destroy();
            viewerARef.current = null;
            viewerBRef.current = null;
        };
    }, []);

    // ─── Import each side whenever its XML changes ────────────────────────────
    useEffect(() => {
        if (!xmlA || !viewerARef.current) return;
        let cancelled = false;
        setViewerAReady(false);

        viewerARef.current
            .importXML(xmlA)
            .then(() => {
                if (cancelled) return;
                viewerARef.current.get("canvas").zoom("fit-viewport");
                setViewerAReady(true);
            })
            .catch(err => {
                console.error("Error loading the current diagram", err);
                if (!cancelled) setLoadError("The current diagram could not be rendered for comparison.");
            });

        return () => { cancelled = true; };
    }, [xmlA]);

    useEffect(() => {
        if (!xmlB || !viewerBRef.current) return;
        let cancelled = false;
        setViewerBReady(false);
        setLoadError(null);

        viewerBRef.current
            .importXML(xmlB)
            .then(() => {
                if (cancelled) return;
                viewerBRef.current.get("canvas").zoom("fit-viewport");
                setViewerBReady(true);
            })
            .catch(err => {
                console.error("Error loading the selected version", err);
                if (!cancelled) setLoadError("The selected version could not be rendered. Its BPMN XML may be invalid.");
            });

        return () => { cancelled = true; };
    }, [xmlB]);

    // ─── Compute the diff once both sides are rendered ────────────────────────
    useEffect(() => {
        if (!viewerAReady || !viewerBReady) return;

        const viewerA = viewerARef.current;
        const viewerB = viewerBRef.current;
        const defsA   = viewerA.getDefinitions();
        const defsB   = viewerB.getDefinitions();
        if (!defsA || !defsB) return;

        const canvasA   = viewerA.get("canvas");
        const canvasB   = viewerB.get("canvas");
        const registryA = viewerA.get("elementRegistry");
        const registryB = viewerB.get("elementRegistry");

        clearMarkers(canvasA, registryA);
        clearMarkers(canvasB, registryB);
        setFocusedId(null);

        let result;
        try {
            result = differ.diff(defsA, defsB);
        } catch (err) {
            console.error("Comparison failed", err);
            setLoadError("The two diagrams could not be compared.");
            setChanges(null);
            return;
        }

        const added         = result._added || {};
        const removed       = result._removed || {};
        const changed       = result._changed || {};
        const layoutChanged = result._layoutChanged || {};

        // Resolve a readable label once, here, so the list can stay dumb.
        const describe = id => {
            const element = registryB.get(id) || registryA.get(id);
            const bo      = element?.businessObject;
            const type    = (bo?.$type || "Element").replace(/^bpmn:/, "");
            const name    = bo?.name?.trim();
            return { id, name: name || null, type, label: name ? `${name} (${type})` : `${type} · ${id}` };
        };

        setChanges({
            added:         Object.keys(added).map(describe),
            removed:       Object.keys(removed).map(describe),
            changed:       Object.keys(changed).map(id => ({
                ...describe(id),
                attrs: Object.keys(changed[id]?.attrs || {})
            })),
            layoutChanged: Object.keys(layoutChanged).map(describe)
        });

        Object.keys(removed).forEach(id => addMarkerIfPresent(canvasA, registryA, id, "diff-removed"));
        Object.keys(added).forEach(id => addMarkerIfPresent(canvasB, registryB, id, "diff-added"));

        Object.keys(changed).forEach(id => {
            addMarkerIfPresent(canvasA, registryA, id, "diff-changed");
            addMarkerIfPresent(canvasB, registryB, id, "diff-changed");
        });

        Object.keys(layoutChanged).forEach(id => {
            addMarkerIfPresent(canvasA, registryA, id, "diff-layout-changed");
            addMarkerIfPresent(canvasB, registryB, id, "diff-layout-changed");
        });
    }, [viewerAReady, viewerBReady]);

    // ─── Keep both canvases showing the same region ───────────────────────────
    useEffect(() => {
        if (!syncViews || !viewerAReady || !viewerBReady) return;

        const viewerA = viewerARef.current;
        const viewerB = viewerBRef.current;
        const canvasA = viewerA.get("canvas");
        const canvasB = viewerB.get("canvas");

        // Shared guard: applying a viewbox fires the other canvas's event too.
        let syncing = false;
        const mirror = (from, to) => () => {
            if (syncing) return;
            syncing = true;
            try {
                to.viewbox(from.viewbox());
            } catch (err) {
                console.error("Could not synchronise the two views", err);
            } finally {
                syncing = false;
            }
        };

        const aToB = mirror(canvasA, canvasB);
        const bToA = mirror(canvasB, canvasA);

        viewerA.get("eventBus").on("canvas.viewbox.changed", aToB);
        viewerB.get("eventBus").on("canvas.viewbox.changed", bToA);

        return () => {
            viewerA.get("eventBus").off("canvas.viewbox.changed", aToB);
            viewerB.get("eventBus").off("canvas.viewbox.changed", bToA);
        };
    }, [syncViews, viewerAReady, viewerBReady]);

    // ─── Clicking a change brings that element into view on both sides ────────
    const handleChangeClick = useCallback(id => {
        [viewerARef.current, viewerBRef.current].forEach(viewer => {
            if (!viewer) return;
            const canvas   = viewer.get("canvas");
            const registry = viewer.get("elementRegistry");

            if (focusedId) canvas.removeMarker(focusedId, "diff-focused");

            const element = registry.get(id);
            if (!element) return;

            canvas.addMarker(id, "diff-focused");
            canvas.scrollToElement?.(element);
        });
        setFocusedId(id);
    }, [focusedId]);

    const total = changes
        ? changes.added.length + changes.removed.length + changes.changed.length + changes.layoutChanged.length
        : 0;

    return (
        <div className="bpmn-diff-container">
            {/* Header */}
            <div className="diff-header">
                <h2>{diagramName ? `${diagramName} – Version Comparison` : "Version Comparison"}</h2>

                <div className="diff-legend">
                    <span className="diff-legend-item"><i className="dot added" />Added</span>
                    <span className="diff-legend-item"><i className="dot removed" />Removed</span>
                    <span className="diff-legend-item"><i className="dot changed" />Changed</span>
                    <span className="diff-legend-item"><i className="dot layout" />Moved</span>
                </div>

                <label className="diff-sync-toggle">
                    <input
                        type="checkbox"
                        checked={syncViews}
                        onChange={e => setSyncViews(e.target.checked)}
                    />
                    Sync zoom &amp; pan
                </label>
            </div>

            {loadError && (
                <div className="diff-error-banner">
                    <span className="bpmn-error-icon">⚠</span>
                    <span>{loadError}</span>
                </div>
            )}

            {/* Viewers */}
            <div className="diff-viewers">
                <div className="diff-viewer-wrapper">
                    <div className="diff-viewer-header">
                        <span className="version-label">{labelA || "Current"}</span>
                        {xmlA && !viewerAReady && <span className="version-status">Loading…</span>}
                    </div>
                    <div ref={containerARef} className="diff-canvas" />
                    {!xmlA && <div className="diff-canvas-placeholder">No diagram to compare.</div>}
                </div>

                <div className="diff-viewer-wrapper">
                    <div className="diff-viewer-header">
                        <span className="version-label">{labelB || "Selected version"}</span>
                        {xmlB && !viewerBReady && <span className="version-status">Loading…</span>}
                    </div>
                    <div ref={containerBRef} className="diff-canvas" />
                    {!xmlB && <div className="diff-canvas-placeholder">Select a version to compare.</div>}
                </div>
            </div>

            {/* Changes */}
            {changes && (
                <div className={`diff-changes-panel ${isPanelOpen ? "" : "collapsed"}`}>
                    <button
                        type="button"
                        className="changes-toggle-btn"
                        onClick={() => setIsPanelOpen(open => !open)}
                    >
                        <span>{total === 0 ? "No differences" : `List of Changes (${total})`}</span>
                        <span className="changes-caret">{isPanelOpen ? "▾" : "▸"}</span>
                    </button>

                    {isPanelOpen && (
                        <div className="changes-list">
                            {total === 0 ? (
                                <p className="changes-empty">
                                    These two versions are identical.
                                </p>
                            ) : (
                                <ChangesList
                                    changes={changes}
                                    focusedId={focusedId}
                                    onSelect={handleChangeClick}
                                />
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Marker helpers ───────────────────────────────────────────────────────────
function clearMarkers(canvas, registry) {
    registry.getAll().forEach(element => {
        DIFF_MARKERS.forEach(marker => canvas.removeMarker(element.id, marker));
    });
}

function addMarkerIfPresent(canvas, registry, id, marker) {
    if (registry.get(id)) canvas.addMarker(id, marker);
}

// ─── Changes list ─────────────────────────────────────────────────────────────
function ChangesList({ changes, focusedId, onSelect }) {
    const groups = [
        { key: "added",         title: "Added",          className: "added",   prefix: "+", items: changes.added },
        { key: "removed",       title: "Removed",        className: "removed", prefix: "−", items: changes.removed },
        { key: "changed",       title: "Changed",        className: "changed", prefix: "~", items: changes.changed },
        { key: "layoutChanged", title: "Moved / Resized", className: "layout", prefix: "↔", items: changes.layoutChanged }
    ];

    return (
        <div className="changes-content">
            {groups
                .filter(group => group.items.length > 0)
                .map(group => (
                    <div key={group.key} className="change-group">
                        <h4 className={`change-group-title ${group.className}`}>
                            {group.title} ({group.items.length})
                        </h4>
                        {group.items.map(item => (
                            <button
                                key={item.id}
                                type="button"
                                title={item.id}
                                className={`change-item ${group.className} ${focusedId === item.id ? "focused" : ""}`}
                                onClick={() => onSelect(item.id)}
                            >
                                <span className="change-item-prefix">{group.prefix}</span>
                                <span className="change-item-label">{item.label}</span>
                                {item.attrs?.length > 0 && (
                                    <span className="change-item-attrs">{item.attrs.join(", ")}</span>
                                )}
                            </button>
                        ))}
                    </div>
                ))}
        </div>
    );
}
