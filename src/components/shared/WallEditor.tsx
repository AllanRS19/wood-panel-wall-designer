'use client';

import { useCallback, useRef, useState } from 'react';
import type { CanvasSizeData, PanelData, PhotoData } from '@/types';
import { useWallEditor } from '@/hooks/use-wall-editor';
import { Button } from '../ui/button';

interface WallEditorProps {
    jobId: string;
    wallW: number;   // mm
    wallH: number;   // mm
    photos: PhotoData[];
    canvasSizes: CanvasSizeData[];
    initialPanels: PanelData[];
    readOnly?: boolean;
    onSave: (panels: PanelData[]) => Promise<void>;
}

// Max display dimensions
const EDITOR_MAX_W = 1450;
const EDITOR_MAX_H = 550;
const TRAY_W = 200;

export default function WallEditor({
    wallW, 
    wallH, 
    photos, 
    canvasSizes, 
    initialPanels, 
    readOnly, 
    onSave
}: WallEditorProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [draggingTrayPhoto, setDraggingTrayPhoto] = useState<string | null>(null);
    const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
    const [activeDragPanel, setActiveDragPanel] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);

    const scale = Math.min(EDITOR_MAX_W / wallW, EDITOR_MAX_H / wallH);
    const displayW = wallW * scale;
    const displayH = wallH * scale;

    const {
        panels, trayPhotos, selectedId, selectedPanel,
        setSelectedId, saving, canUndo, canRedo,
        undo, redo, addPanel, movePanel, rotatePanel,
        changePanelSize, swapPhoto, removePanel,
    } = useWallEditor({ initialPanels, photos, canvasSizes, wallW, wallH, readOnly, onSave });

    // Convert SVG client coords to wall mm
    const svgToMm = useCallback((clientX: number, clientY: number) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return { x: 0, y: 0 };
        return {
            x: (clientX - rect.left) / scale,
            y: (clientY - rect.top) / scale,
        };
    }, [scale]);

    // ---- Panel drag handlers ----
    const onPanelMouseDown = useCallback((e: React.MouseEvent, panelId: string) => {
        if (readOnly) return;
        e.stopPropagation();
        const panel = panels.find((p) => p.id === panelId);
        if (!panel) return;
        const mm = svgToMm(e.clientX, e.clientY);
        setActiveDragPanel({ id: panelId, offsetX: mm.x - panel.xMm, offsetY: mm.y - panel.yMm });
        setSelectedId(panelId);
    }, [readOnly, panels, svgToMm, setSelectedId]);

    const onSvgMouseMove = useCallback((e: React.MouseEvent) => {
        if (activeDragPanel) {
            const mm = svgToMm(e.clientX, e.clientY);
            movePanel(activeDragPanel.id, mm.x - activeDragPanel.offsetX, mm.y - activeDragPanel.offsetY);
        }
        if (draggingTrayPhoto) {
            setDragPos({ x: e.clientX, y: e.clientY });
        }
    }, [activeDragPanel, draggingTrayPhoto, svgToMm, movePanel]);

    const onSvgMouseUp = useCallback((e: React.MouseEvent) => {
        if (draggingTrayPhoto) {
            const mm = svgToMm(e.clientX, e.clientY);
            if (mm.x >= 0 && mm.x <= wallW && mm.y >= 0 && mm.y <= wallH) {
                // Check if dropping on existing panel → swap photo
                const target = panels.find((p) =>
                    mm.x >= p.xMm && mm.x <= p.xMm + p.displayW &&
                    mm.y >= p.yMm && mm.y <= p.yMm + p.displayH
                );
                if (target) {
                    swapPhoto(target.id, draggingTrayPhoto);
                } else {
                    addPanel(draggingTrayPhoto, mm.x, mm.y);
                }
            }
            setDraggingTrayPhoto(null);
            setDragPos(null);
        }
        setActiveDragPanel(null);
    }, [draggingTrayPhoto, panels, wallW, wallH, svgToMm, swapPhoto, addPanel]);

    const onSvgClick = useCallback((e: React.MouseEvent) => {
        if ((e.target as SVGElement).tagName === 'svg') setSelectedId(null);
    }, [setSelectedId]);

    return (
        <div className="flex flex-col gap-3 h-full">
            {/* Toolbar */}
            <div className="flex items-center gap-2 flex-wrap">
                {!readOnly && (
                    <>
                        <Button size="sm" variant="outline" onClick={undo} disabled={!canUndo} title="Undo">↩ Undo</Button>
                        <Button size="sm" variant="outline" onClick={redo} disabled={!canRedo} title="Redo">↪ Redo</Button>
                    </>
                )}
                {saving && <span className="text-xs text-gray-500 animate-pulse">Saving…</span>}
                <span className="ml-auto text-xs text-gray-400">
                    Wall: {wallW}×{wallH} mm | Scale: 1:{Math.round(1 / scale)}
                </span>
            </div>

            <div className="flex gap-3 overflow-hidden">
                {/* Photo Tray */}
                <div className="flex-none w-45 flex flex-col gap-2 overflow-y-auto max-h-145">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Photos</p>
                    {trayPhotos.length === 0 && (
                        <p className="text-xs text-gray-400 italic">All photos placed</p>
                    )}
                    {trayPhotos.map((photo) => (
                        <div
                            key={photo.id}
                            draggable={!readOnly}
                            onDragStart={() => { setDraggingTrayPhoto(photo.id); }}
                            onMouseDown={() => setDraggingTrayPhoto(photo.id)}
                            className={[
                                'rounded-md border border-gray-200 overflow-hidden cursor-grab bg-gray-50',
                                readOnly ? 'opacity-60 cursor-default' : 'hover:border-brand-400',
                            ].join(' ')}
                            title={photo.originalName}
                        >
                            {photo.url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={photo.url}
                                    alt={photo.originalName}
                                    className="w-full h-24 object-cover pointer-events-none"
                                />
                            ) : (
                                <div className="w-full h-24 flex items-center justify-center text-gray-300 text-2xl">🖼️</div>
                            )}
                            <p className="text-xs text-gray-500 px-1.5 py-1 truncate">{photo.originalName}</p>
                        </div>
                    ))}
                </div>

                {/* SVG wall canvas */}
                <div className="flex-1 overflow-auto">
                    <svg
                        ref={svgRef}
                        width={displayW}
                        height={displayH}
                        viewBox={`0 0 ${wallW} ${wallH}`}
                        className="border-2 border-gray-300 rounded-lg bg-gray-100 block touch-none"
                        onMouseMove={onSvgMouseMove}
                        onMouseUp={onSvgMouseUp}
                        onMouseLeave={onSvgMouseUp}
                        onClick={onSvgClick}
                        style={{ cursor: draggingTrayPhoto ? 'copy' : 'default' }}
                    >
                        {/* Wall background */}
                        <rect width={wallW} height={wallH} fill="#f8f6f2" />

                        {/* Grid lines (50mm) */}
                        {Array.from({ length: Math.ceil(wallW / 50) + 1 }, (_, i) => i * 50).map((x) => (
                            <line key={`gx${x}`} x1={x} y1={0} x2={x} y2={wallH} stroke="#e5e5e5" strokeWidth={0.5} />
                        ))}
                        {Array.from({ length: Math.ceil(wallH / 50) + 1 }, (_, i) => i * 50).map((y) => (
                            <line key={`gy${y}`} x1={0} y1={y} x2={wallW} y2={y} stroke="#e5e5e5" strokeWidth={0.5} />
                        ))}

                        {/* Panels */}
                        {panels.map((panel) => {
                            const isSelected = panel.id === selectedId;
                            const cs = panel.canvasSize;
                            const holeList = cs?.holes && cs.holes.length > 0
                                ? cs.holes
                                : [{ xMm: (cs?.widthMm ?? 200) / 2, yMm: 50, label: 'default', id: 'd' }];

                            return (
                                <g
                                    key={panel.id}
                                    transform={`translate(${panel.xMm},${panel.yMm})`}
                                    onMouseDown={(e) => onPanelMouseDown(e, panel.id)}
                                    style={{ cursor: readOnly ? 'default' : 'grab' }}
                                >
                                    {/* Panel fill */}
                                    <rect
                                        width={panel.displayW}
                                        height={panel.displayH}
                                        fill={panel.photo?.url ? 'none' : '#d4b896'}
                                        stroke={isSelected ? '#2563eb' : '#6b4c1e'}
                                        strokeWidth={isSelected ? 3 / scale : 1.5 / scale}
                                        rx={2 / scale}
                                    />
                                    {/* Photo (clipped) */}
                                    {panel.photo?.url && (
                                        <>
                                            <defs>
                                                <clipPath id={`clip-${panel.id}`}>
                                                    <rect width={panel.displayW} height={panel.displayH} rx={2 / scale} />
                                                </clipPath>
                                            </defs>
                                            <image
                                                href={panel.photo.url}
                                                width={panel.displayW}
                                                height={panel.displayH}
                                                preserveAspectRatio="xMidYMid slice"
                                                clipPath={`url(#clip-${panel.id})`}
                                                style={{ pointerEvents: 'none' }}
                                            />
                                        </>
                                    )}
                                    {/* Slight overlay to see panel borders on photos */}
                                    <rect
                                        width={panel.displayW}
                                        height={panel.displayH}
                                        fill="none"
                                        stroke={isSelected ? '#2563eb' : '#6b4c1e'}
                                        strokeWidth={isSelected ? 3 / scale : 1.5 / scale}
                                        rx={2 / scale}
                                        style={{ pointerEvents: 'none' }}
                                    />
                                    {/* Panel label */}
                                    <text
                                        x={4 / scale}
                                        y={14 / scale}
                                        fontSize={10 / scale}
                                        fill="white"
                                        style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                                        fontWeight="bold"
                                    >
                                        {panel.label || panel.id.slice(-4)}
                                    </text>
                                    {/* Hole markers — shown relative to panel origin using rotation-aware transforms */}
                                    {isSelected && holeList.map((h, i) => {
                                        // Transform hole to panel-display coords
                                        // Use panel rotation to compute display position of hole
                                        const pw = cs?.widthMm ?? panel.displayW;
                                        const ph2 = cs?.heightMm ?? panel.displayH;
                                        let hx = h.xMm, hy = h.yMm;
                                        const rot = panel.rotation as 0 | 90 | 180 | 270;
                                        if (rot === 90) { const tmp = hx; hx = ph2 - h.yMm; hy = tmp; }
                                        else if (rot === 180) { hx = pw - h.xMm; hy = ph2 - h.yMm; }
                                        else if (rot === 270) { const tmp = hx; hx = h.yMm; hy = pw - tmp; }
                                        return (
                                            <g key={i}>
                                                <circle cx={hx} cy={hy} r={5 / scale} fill="rgba(220,38,38,0.3)" stroke="#dc2626" strokeWidth={1 / scale} />
                                                <line x1={hx - 4 / scale} y1={hy} x2={hx + 4 / scale} y2={hy} stroke="#dc2626" strokeWidth={1.5 / scale} />
                                                <line x1={hx} y1={hy - 4 / scale} x2={hx} y2={hy + 4 / scale} stroke="#dc2626" strokeWidth={1.5 / scale} />
                                            </g>
                                        );
                                    })}
                                </g>
                            );
                        })}

                        {/* Drop zone overlay while dragging tray photo */}
                        {draggingTrayPhoto && (
                            <rect width={wallW} height={wallH} fill="rgba(37,99,235,0.05)" stroke="#2563eb" strokeWidth={2 / scale} strokeDasharray={`${8 / scale} ${4 / scale}`} rx={4 / scale} style={{ pointerEvents: 'none' }} />
                        )}
                    </svg>
                </div>

                {/* Panel controls panel (right sidebar) */}
                {selectedPanel && !readOnly && (
                    <div className="flex-none w-52 flex flex-col gap-3 text-sm">
                        <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
                            <p className="font-semibold text-gray-800 text-sm">Selected Panel</p>

                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Size</label>
                                <select
                                    value={selectedPanel.canvasSizeId}
                                    onChange={(e) => changePanelSize(selectedPanel.id, e.target.value)}
                                    className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-brand-500"
                                >
                                    {canvasSizes.filter((s) => s.active).map((s) => (
                                        <option key={s.id} value={s.id}>{s.name} ({s.widthMm}×{s.heightMm}mm)</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                                <div><span className="font-medium">X:</span> {selectedPanel.xMm.toFixed(0)} mm</div>
                                <div><span className="font-medium">Y:</span> {selectedPanel.yMm.toFixed(0)} mm</div>
                                <div><span className="font-medium">W:</span> {selectedPanel.displayW} mm</div>
                                <div><span className="font-medium">H:</span> {selectedPanel.displayH} mm</div>
                                <div><span className="font-medium">Rot:</span> {selectedPanel.rotation}°</div>
                            </div>

                            {selectedPanel.canvasSize?.holes.length === 0 && (
                                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                    ⚠ No holes configured — using default centre hole
                                </p>
                            )}

                            <div className="flex flex-col gap-2">
                                <Button size="sm" variant="outline" onClick={() => rotatePanel(selectedPanel.id)}>
                                    ↻ Rotate 90°
                                </Button>
                                <Button size="sm" variant="danger" onClick={() => removePanel(selectedPanel.id)}>
                                    ✕ Remove
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Ghost cursor for tray drag */}
            {draggingTrayPhoto && dragPos && (
                <div
                    className="fixed pointer-events-none z-50 w-16 h-16 rounded border-2 border-brand-500 bg-brand-100 opacity-70 -translate-x-1/2 -translate-y-1/2"
                    style={{ left: dragPos.x, top: dragPos.y }}
                >
                    <span className="flex h-full items-center justify-center text-brand-700 font-bold text-xs">📷</span>
                </div>
            )}
        </div>
    );
}