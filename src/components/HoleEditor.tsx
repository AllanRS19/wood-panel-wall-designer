'use client';

import { useCallback, useRef, useState } from 'react';
import type { CanvasSizeData, HolePositionData } from '@/types';
import { Button } from './ui/button';

interface HoleEditorProps {
    canvasSize: CanvasSizeData;
    onHoleAdd: (xMm: number, yMm: number, label: string) => Promise<void>;
    onHoleUpdate: (holeId: string, xMm: number, yMm: number, label: string) => Promise<void>;
    onHoleDelete: (holeId: string) => Promise<void>;
}

const EDITOR_MAX_W = 520;
const EDITOR_MAX_H = 400;
const RULER_SIZE = 28; // px — ruler thickness
const DOT_R = 6; // px — hole dot radius

export function HoleEditor({ canvasSize, onHoleAdd, onHoleUpdate, onHoleDelete }: HoleEditorProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [selectedHole, setSelectedHole] = useState<HolePositionData | null>(null);
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [editLabel, setEditLabel] = useState('');
    const [editX, setEditX] = useState('');
    const [editY, setEditY] = useState('');
    const [saving, setSaving] = useState(false);

    const scale = Math.min(
        (EDITOR_MAX_W - RULER_SIZE) / canvasSize.widthMm,
        (EDITOR_MAX_H - RULER_SIZE) / canvasSize.heightMm
    );
    const panelDisplayW = canvasSize.widthMm * scale;
    const panelDisplayH = canvasSize.heightMm * scale;
    const svgW = panelDisplayW + RULER_SIZE;
    const svgH = panelDisplayH + RULER_SIZE;

    // Convert SVG coords (panel-local, already offset by ruler) to mm
    const svgToPanelMm = useCallback((clientX: number, clientY: number) => {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return { x: 0, y: 0 };
        const svgX = clientX - rect.left - RULER_SIZE;
        const svgY = clientY - rect.top - RULER_SIZE;
        return {
            x: Math.max(0, Math.min(canvasSize.widthMm, svgX / scale)),
            y: Math.max(0, Math.min(canvasSize.heightMm, svgY / scale)),
        };
    }, [scale, canvasSize]);

    const selectHole = (h: HolePositionData) => {
        setSelectedHole(h);
        setEditLabel(h.label);
        setEditX(h.xMm.toFixed(1));
        setEditY(h.yMm.toFixed(1));
    };

    const handleSvgClick = useCallback(async (e: React.MouseEvent) => {
        if (draggingId) return;
        const target = e.target as SVGElement;
        if (target.dataset.holeid) return; // clicked a hole dot
        const mm = svgToPanelMm(e.clientX, e.clientY);
        if (mm.x < 0 || mm.y < 0) return;
        setSaving(true);
        try {
            await onHoleAdd(parseFloat(mm.x.toFixed(1)), parseFloat(mm.y.toFixed(1)), 'Hanging point');
        } finally {
            setSaving(false);
        }
    }, [draggingId, svgToPanelMm, onHoleAdd]);

    const handleHoleMouseDown = (e: React.MouseEvent, hole: HolePositionData) => {
        e.stopPropagation();
        setDraggingId(hole.id);
        selectHole(hole);
    };

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!draggingId) return;
        const mm = svgToPanelMm(e.clientX, e.clientY);
        setEditX(mm.x.toFixed(1));
        setEditY(mm.y.toFixed(1));
    }, [draggingId, svgToPanelMm]);

    const handleMouseUp = useCallback(async (e: React.MouseEvent) => {
        if (!draggingId) return;
        const mm = svgToPanelMm(e.clientX, e.clientY);
        const x = parseFloat(mm.x.toFixed(1));
        const y = parseFloat(mm.y.toFixed(1));
        setSaving(true);
        try {
            await onHoleUpdate(draggingId, x, y, selectedHole?.label || 'Hanging point');
            setEditX(x.toFixed(1));
            setEditY(y.toFixed(1));
        } finally {
            setSaving(false);
            setDraggingId(null);
        }
    }, [draggingId, svgToPanelMm, onHoleUpdate, selectedHole]);

    const handleLabelSave = async () => {
        if (!selectedHole) return;
        setSaving(true);
        try {
            await onHoleUpdate(selectedHole.id, parseFloat(editX), parseFloat(editY), editLabel);
        } finally {
            setSaving(false);
        }
    };

    const handlePositionSave = async () => {
        if (!selectedHole) return;
        const x = parseFloat(editX);
        const y = parseFloat(editY);
        if (isNaN(x) || isNaN(y)) return;
        setSaving(true);
        try {
            await onHoleUpdate(selectedHole.id, x, y, editLabel || selectedHole.label);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedHole) return;
        setSaving(true);
        try {
            await onHoleDelete(selectedHole.id);
            setSelectedHole(null);
        } finally {
            setSaving(false);
        }
    };

    // Ruler tick marks
    const ticksMm = (total: number) => {
        const ticks: number[] = [];
        const step = total > 500 ? 50 : total > 200 ? 20 : 10;
        for (let m = 0; m <= total; m += step) ticks.push(m);
        return ticks;
    };
    const xTicks = ticksMm(canvasSize.widthMm);
    const yTicks = ticksMm(canvasSize.heightMm);

    // Get live positions for holes while dragging
    const getHoleDisplayPos = (hole: HolePositionData) => {
        if (draggingId === hole.id) {
            return { x: parseFloat(editX || '0'), y: parseFloat(editY || '0') };
        }
        return { x: hole.xMm, y: hole.yMm };
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-start gap-4 flex-wrap">
                {/* Panel with rulers */}
                <div className="flex-none">
                    <p className="text-xs text-gray-500 mb-1">
                        Click panel to add hole · Drag to reposition · {canvasSize.widthMm}×{canvasSize.heightMm} mm
                    </p>
                    <svg
                        ref={svgRef}
                        width={svgW}
                        height={svgH}
                        className="border border-gray-300 rounded cursor-crosshair"
                        onClick={handleSvgClick}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                        style={{ userSelect: 'none' }}
                    >
                        {/* Ruler backgrounds */}
                        <rect width={svgW} height={RULER_SIZE} fill="#f1f1f1" />
                        <rect width={RULER_SIZE} height={svgH} fill="#f1f1f1" />

                        {/* X ruler ticks */}
                        {xTicks.map((m) => (
                            <g key={`xt${m}`}>
                                <line x1={RULER_SIZE + m * scale} y1={RULER_SIZE - 6} x2={RULER_SIZE + m * scale} y2={RULER_SIZE} stroke="#888" strokeWidth={0.8} />
                                <text x={RULER_SIZE + m * scale} y={RULER_SIZE - 8} fontSize={8} textAnchor="middle" fill="#555">{m}</text>
                            </g>
                        ))}
                        <text x={svgW / 2} y={9} fontSize={7} textAnchor="middle" fill="#888">mm</text>

                        {/* Y ruler ticks */}
                        {yTicks.map((m) => (
                            <g key={`yt${m}`}>
                                <line x1={RULER_SIZE - 6} y1={RULER_SIZE + m * scale} x2={RULER_SIZE} y2={RULER_SIZE + m * scale} stroke="#888" strokeWidth={0.8} />
                                <text x={RULER_SIZE - 8} y={RULER_SIZE + m * scale + 3} fontSize={8} textAnchor="end" fill="#555">{m}</text>
                            </g>
                        ))}

                        {/* Panel body */}
                        <rect
                            x={RULER_SIZE} y={RULER_SIZE}
                            width={panelDisplayW} height={panelDisplayH}
                            fill="#e8d5b5" stroke="#6b4c1e" strokeWidth={1.5}
                        />

                        {/* Grid lines */}
                        {xTicks.map((m) => m > 0 && (
                            <line key={`xg${m}`} x1={RULER_SIZE + m * scale} y1={RULER_SIZE} x2={RULER_SIZE + m * scale} y2={RULER_SIZE + panelDisplayH} stroke="#ccc" strokeWidth={0.5} strokeDasharray="3 3" />
                        ))}
                        {yTicks.map((m) => m > 0 && (
                            <line key={`yg${m}`} x1={RULER_SIZE} y1={RULER_SIZE + m * scale} x2={RULER_SIZE + panelDisplayW} y2={RULER_SIZE + m * scale} stroke="#ccc" strokeWidth={0.5} strokeDasharray="3 3" />
                        ))}

                        {/* Holes */}
                        {canvasSize.holes.map((hole) => {
                            const pos = getHoleDisplayPos(hole);
                            const cx = RULER_SIZE + pos.x * scale;
                            const cy = RULER_SIZE + pos.y * scale;
                            const isSelected = selectedHole?.id === hole.id;
                            return (
                                <g key={hole.id}>
                                    <circle
                                        cx={cx} cy={cy} r={DOT_R + (isSelected ? 2 : 0)}
                                        fill={isSelected ? '#2563eb' : '#dc2626'}
                                        stroke="white" strokeWidth={1.5}
                                        data-holeid={hole.id}
                                        style={{ cursor: 'grab' }}
                                        onMouseDown={(e) => handleHoleMouseDown(e, hole)}
                                    />
                                    {/* ✕ crosshair */}
                                    <line x1={cx - DOT_R - 3} y1={cy} x2={cx + DOT_R + 3} y2={cy} stroke="#dc2626" strokeWidth={1} style={{ pointerEvents: 'none' }} />
                                    <line x1={cx} y1={cy - DOT_R - 3} x2={cx} y2={cy + DOT_R + 3} stroke="#dc2626" strokeWidth={1} style={{ pointerEvents: 'none' }} />
                                    {/* Label */}
                                    <text x={cx + DOT_R + 4} y={cy + 4} fontSize={9} fill={isSelected ? '#2563eb' : '#333'} style={{ pointerEvents: 'none' }}>
                                        {hole.label}
                                    </text>
                                </g>
                            );
                        })}

                        {saving && (
                            <text x={RULER_SIZE + 4} y={RULER_SIZE + panelDisplayH - 4} fontSize={9} fill="#888">Saving…</text>
                        )}
                    </svg>
                </div>

                {/* Hole properties panel */}
                {selectedHole && (
                    <div className="flex-1 min-w-50 bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                        <p className="font-semibold text-gray-800 text-sm">Hole Properties</p>

                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Label</label>
                            <input
                                value={editLabel}
                                onChange={(e) => setEditLabel(e.target.value)}
                                onBlur={handleLabelSave}
                                className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-brand-500"
                                placeholder="e.g. Left D-ring"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">X (mm)</label>
                                <input
                                    value={editX}
                                    onChange={(e) => setEditX(e.target.value)}
                                    onBlur={handlePositionSave}
                                    type="number"
                                    step="0.5"
                                    min={0}
                                    max={canvasSize.widthMm}
                                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-brand-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">Y (mm)</label>
                                <input
                                    value={editY}
                                    onChange={(e) => setEditY(e.target.value)}
                                    onBlur={handlePositionSave}
                                    type="number"
                                    step="0.5"
                                    min={0}
                                    max={canvasSize.heightMm}
                                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-brand-500"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                            <Button size="sm" onClick={handlePositionSave} loading={saving}>
                                Save Position
                            </Button>
                            <Button size="sm" variant="danger" onClick={handleDelete} loading={saving}>
                                Delete
                            </Button>
                        </div>
                    </div>
                )}

                {!selectedHole && (
                    <div className="text-sm text-gray-400 italic self-center">
                        Click a dot to edit a hole
                    </div>
                )}
            </div>

            {canvasSize.holes.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-sm text-amber-800">
                    ⚠ No holes configured. A default centre hole (50 mm from top) will be used in PDF templates.
                    Click the panel above to add a hole.
                </div>
            )}
        </div>
    );
}