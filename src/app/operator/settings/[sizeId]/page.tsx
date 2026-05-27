'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { CanvasSizeData } from '@/types';
import Navbar from '@/components/shared/Navbar';
import { HoleEditor } from '@/components/HoleEditor';

const HoleEditorPage = () => {
    const { sizeId } = useParams<{ sizeId: string }>();
    const [size, setSize] = useState<CanvasSizeData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadSize = useCallback(async () => {
        const res = await fetch(`/api/canvas-sizes/${sizeId}`);
        if (!res.ok) { setError('Canvas size not found'); setLoading(false); return; }
        setSize(await res.json());
        setLoading(false);
    }, [sizeId]);

    useEffect(() => { loadSize(); }, [loadSize]);

    const handleHoleAdd = async (xMm: number, yMm: number, label: string) => {
        const res = await fetch(`/api/canvas-sizes/${sizeId}/holes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ xMm, yMm, label }),
        });
        if (res.ok) await loadSize();
        else {
            const d = await res.json();
            alert(d.error || 'Failed to add hole');
        }
    };

    const handleHoleUpdate = async (holeId: string, xMm: number, yMm: number, label: string) => {
        const res = await fetch(`/api/canvas-sizes/${sizeId}/holes`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ holeId, xMm, yMm, label }),
        });
        if (res.ok) await loadSize();
        else {
            const d = await res.json();
            alert(d.error || 'Failed to update hole');
        }
    };

    const handleHoleDelete = async (holeId: string) => {
        if (!confirm('Delete this hole? This will affect any PDFs generated for panels of this size.')) return;
        const res = await fetch(`/api/canvas-sizes/${sizeId}/holes`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ holeId }),
        });
        if (res.ok) await loadSize();
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <main className="max-w-4xl mx-auto px-4 py-8">
                <div className="mb-4">
                    <Link href="/operator/settings" className="text-sm text-brand-600 hover:underline">
                        ← Canvas Catalog
                    </Link>
                </div>

                {loading ? (
                    <div className="space-y-4">
                        <div className="skeleton h-10 w-64 rounded-lg" />
                        <div className="skeleton h-96 rounded-xl" />
                    </div>
                ) : error ? (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
                        {error}
                    </div>
                ) : size ? (
                    <>
                        <div className="mb-6">
                            <h1 className="text-2xl font-bold text-gray-900">Hole Positions — {size.name}</h1>
                            <p className="text-gray-500 text-sm mt-1">
                                {size.widthMm}×{size.heightMm} mm · {size.thicknessMm} mm thick ·{' '}
                                {size.holes.length} hole{size.holes.length !== 1 ? 's' : ''} configured
                            </p>
                        </div>

                        {/* Instructions */}
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-800">
                            <p className="font-semibold mb-1">How hole positions work</p>
                            <ul className="space-y-1 text-blue-700 list-disc list-inside">
                                <li>Positions are stored in <strong>millimetres from the panel&apos;s top-left corner</strong> (unrotated).</li>
                                <li>When a panel is rotated on the wall, the geometry engine transforms each hole position correctly.</li>
                                <li>Click anywhere on the panel diagram to place a new hole.</li>
                                <li>Drag existing holes to reposition, or type exact coordinates in the fields.</li>
                                <li>Changes here immediately affect all future PDF templates for this size.</li>
                            </ul>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200 p-6">
                            <HoleEditor
                                canvasSize={size}
                                onHoleAdd={handleHoleAdd}
                                onHoleUpdate={handleHoleUpdate}
                                onHoleDelete={handleHoleDelete}
                            />
                        </div>

                        {/* Hole table */}
                        {size.holes.length > 0 && (
                            <div className="mt-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
                                <div className="px-4 py-3 border-b border-gray-100">
                                    <h2 className="font-semibold text-gray-800 text-sm">All Holes</h2>
                                </div>
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left font-medium text-gray-600">Label</th>
                                            <th className="px-4 py-2 text-left font-medium text-gray-600">X (mm from left)</th>
                                            <th className="px-4 py-2 text-left font-medium text-gray-600">Y (mm from top)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {size.holes.map((h) => (
                                            <tr key={h.id} className="hover:bg-gray-50">
                                                <td className="px-4 py-2 text-gray-900">{h.label}</td>
                                                <td className="px-4 py-2 font-mono text-gray-700">{h.xMm.toFixed(1)}</td>
                                                <td className="px-4 py-2 font-mono text-gray-700">{h.yMm.toFixed(1)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                ) : null}
            </main>
        </div>
    );
}

export default HoleEditorPage;