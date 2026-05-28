'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CanvasSizeData, PanelData, PhotoData } from '@/types';
import { panelDisplaySize, snapToGrid } from '@/lib/geometry';

export const MAX_HISTORY = 20;

export interface EditorPanel extends PanelData {
    displayW: number;
    displayH: number;
    photo?: PhotoData;
    canvasSize?: CanvasSizeData;
}

export interface DragState {
    type: 'panel' | 'tray';
    panelId?: string;      // dragging existing panel
    photoId?: string;       // dragging from tray
    offsetX: number;        // mm offset from top-left within panel
    offsetY: number;
}

interface UseWallEditorProps {
    initialPanels: PanelData[];
    photos: PhotoData[];
    canvasSizes: CanvasSizeData[];
    wallW: number;
    wallH: number;
    readOnly?: boolean;
    onSave: (panels: PanelData[]) => Promise<void>;
}

function enrichPanel(p: PanelData, photos: PhotoData[], canvasSizes: CanvasSizeData[]): EditorPanel {
    const cs = canvasSizes.find((s) => s.id === p.canvasSizeId);
    const photo = photos.find((ph) => ph.id === p.photoId);
    const { displayW, displayH } = panelDisplaySize(
        cs?.widthMm ?? 200,
        cs?.heightMm ?? 300,
        p.rotation as 0 | 90 | 180 | 270
    );
    return { ...p, displayW, displayH, photo, canvasSize: cs };
}

export function useWallEditor({
    initialPanels,
    photos,
    canvasSizes,
    wallW,
    wallH,
    readOnly,
    onSave,
}: UseWallEditorProps) {
    const [panels, setPanels] = useState<EditorPanel[]>(() =>
        initialPanels.map((p) => enrichPanel(p, photos, canvasSizes))
    );
    const [history, setHistory] = useState<EditorPanel[][]>([]);
    const [future, setFuture] = useState<EditorPanel[][]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [drag, setDrag] = useState<DragState | null>(null);
    const [saving, setSaving] = useState(false);
    const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Re-enrich if photos/sizes change
    useEffect(() => {
        setPanels((prev) => prev.map((p) => enrichPanel(p, photos, canvasSizes)));
    }, [photos, canvasSizes]);

    // Push state to history before mutating
    const snapshot = useCallback((current: EditorPanel[]) => {
        setHistory((h) => {
            const next = [...h, current].slice(-MAX_HISTORY);
            return next;
        });
        setFuture([]);
    }, []);

    const autoSave = useCallback(
        (newPanels: EditorPanel[]) => {
            if (readOnly) return;
            if (saveTimer.current) clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(async () => {
                setSaving(true);
                try {
                    await onSave(newPanels.map((p) => ({
                        id: p.id,
                        photoId: p.photoId,
                        canvasSizeId: p.canvasSizeId,
                        xMm: p.xMm,
                        yMm: p.yMm,
                        rotation: p.rotation,
                        label: p.label,
                    })));
                } finally {
                    setSaving(false);
                }
            }, 800);
        },
        [readOnly, onSave]
    );

    const mutatePanels = useCallback(
        (updater: (prev: EditorPanel[]) => EditorPanel[], saveAfter = true) => {
            setPanels((prev) => {
                snapshot(prev);
                const next = updater(prev);
                if (saveAfter) autoSave(next);
                return next;
            });
        },
        [snapshot, autoSave]
    );

    // ---- Undo / Redo ----
    const undo = useCallback(() => {
        setHistory((h) => {
            if (!h.length) return h;
            const prev = h[h.length - 1];
            setFuture((f) => [panels, ...f].slice(0, MAX_HISTORY));
            setPanels(prev);
            autoSave(prev);
            return h.slice(0, -1);
        });
    }, [panels, autoSave]);

    const redo = useCallback(() => {
        setFuture((f) => {
            if (!f.length) return f;
            const next = f[0];
            setHistory((h) => [...h, panels].slice(-MAX_HISTORY));
            setPanels(next);
            autoSave(next);
            return f.slice(1);
        });
    }, [panels, autoSave]);

    // ---- Add panel from tray ----
    const addPanel = useCallback(
        (photoId: string, xMm: number, yMm: number) => {
            if (readOnly || !canvasSizes.length) return;
            const defaultSize = canvasSizes.find((s) => s.active) ?? canvasSizes[0];
            const { displayW, displayH } = panelDisplaySize(defaultSize.widthMm, defaultSize.heightMm, 0);
            const snappedX = Math.max(0, Math.min(snapToGrid(xMm - displayW / 2), wallW - displayW));
            const snappedY = Math.max(0, Math.min(snapToGrid(yMm - displayH / 2), wallH - displayH));

            const newPanel: EditorPanel = {
                id: `new-${Date.now()}`,
                photoId,
                canvasSizeId: defaultSize.id,
                xMm: snappedX,
                yMm: snappedY,
                rotation: 0,
                label: `Panel ${Date.now()}`,
                displayW,
                displayH,
                photo: photos.find((p) => p.id === photoId),
                canvasSize: defaultSize,
            };
            mutatePanels((prev) => [...prev, newPanel]);
            setSelectedId(newPanel.id);
        },
        [readOnly, canvasSizes, wallW, wallH, photos, mutatePanels]
    );

    // ---- Move panel ----
    const movePanel = useCallback(
        (panelId: string, xMm: number, yMm: number) => {
            if (readOnly) return;
            mutatePanels((prev) =>
                prev.map((p) => {
                    if (p.id !== panelId) return p;
                    const snappedX = Math.max(0, Math.min(snapToGrid(xMm), wallW - p.displayW));
                    const snappedY = Math.max(0, Math.min(snapToGrid(yMm), wallH - p.displayH));
                    return { ...p, xMm: snappedX, yMm: snappedY };
                })
            );
        },
        [readOnly, wallW, wallH, mutatePanels]
    );

    // Add movePanelDirect — this is called during drag (no snapshot, no save)
    const movePanelDirect = useCallback(
        (panelId: string, xMm: number, yMm: number) => {
            if (readOnly) return;
            setPanels((prev) =>
                prev.map((p) => {
                    if (p.id !== panelId) return p;
                    // Clamp to wall bounds but do NOT snap — smooth visual during drag
                    const clampedX = Math.max(0, Math.min(xMm, wallW - p.displayW));
                    const clampedY = Math.max(0, Math.min(yMm, wallH - p.displayH));
                    return { ...p, xMm: clampedX, yMm: clampedY };
                })
            );
        },
        [readOnly, wallW, wallH]
    );

    const commitPanelMove = useCallback(
        (panelId: string) => {
            if (readOnly) return;
            mutatePanels((prev) =>
                prev.map((p) => {
                    if (p.id !== panelId) return p;
                    return {
                        ...p,
                        xMm: Math.max(0, Math.min(snapToGrid(p.xMm), wallW - p.displayW)),
                        yMm: Math.max(0, Math.min(snapToGrid(p.yMm), wallH - p.displayH)),
                    };
                })
            );
        },
        [readOnly, wallW, wallH, mutatePanels]
    );

    // ---- Rotate panel ----
    const rotatePanel = useCallback(
        (panelId: string) => {
            if (readOnly) return;
            mutatePanels((prev) =>
                prev.map((p) => {
                    if (p.id !== panelId) return p;
                    const rotations: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270];
                    const nextRot = rotations[(rotations.indexOf(p.rotation as 0 | 90 | 180 | 270) + 1) % 4];
                    const cs = p.canvasSize;
                    if (!cs) return p;
                    const { displayW, displayH } = panelDisplaySize(cs.widthMm, cs.heightMm, nextRot);
                    return { ...p, rotation: nextRot, displayW, displayH };
                })
            );
        },
        [readOnly, mutatePanels]
    );

    // ---- Change canvas size ----
    const changePanelSize = useCallback(
        (panelId: string, canvasSizeId: string) => {
            if (readOnly) return;
            const cs = canvasSizes.find((s) => s.id === canvasSizeId);
            if (!cs) return;
            mutatePanels((prev) =>
                prev.map((p) => {
                    if (p.id !== panelId) return p;
                    const { displayW, displayH } = panelDisplaySize(cs.widthMm, cs.heightMm, p.rotation as 0 | 90 | 180 | 270);
                    return { ...p, canvasSizeId, canvasSize: cs, displayW, displayH };
                })
            );
        },
        [readOnly, canvasSizes, mutatePanels]
    );

    // ---- Swap photo on panel ----
    const swapPhoto = useCallback(
        (panelId: string, photoId: string) => {
            if (readOnly) return;
            mutatePanels((prev) =>
                prev.map((p) => {
                    if (p.id !== panelId) return p;
                    return { ...p, photoId, photo: photos.find((ph) => ph.id === photoId) };
                })
            );
        },
        [readOnly, photos, mutatePanels]
    );

    // ---- Remove panel ----
    const removePanel = useCallback(
        (panelId: string) => {
            if (readOnly) return;
            mutatePanels((prev) => prev.filter((p) => p.id !== panelId));
            setSelectedId(null);
        },
        [readOnly, mutatePanels]
    );

    // Photos not on wall (available in tray)
    const trayPhotos = photos.filter(
        (ph) => !panels.some((p) => p.photoId === ph.id)
    );

    const selectedPanel = panels.find((p) => p.id === selectedId) ?? null;

    return {
        panels,
        trayPhotos,
        selectedId,
        selectedPanel,
        setSelectedId,
        drag,
        setDrag,
        saving,
        canUndo: history.length > 0,
        canRedo: future.length > 0,
        undo,
        redo,
        addPanel,
        movePanel,
        movePanelDirect,
        commitPanelMove,
        rotatePanel,
        changePanelSize,
        swapPhoto,
        removePanel,
    };
}