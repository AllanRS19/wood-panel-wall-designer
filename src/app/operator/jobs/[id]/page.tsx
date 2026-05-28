'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { CanvasSizeData, JobData, PanelData } from '@/types';
import Navbar from '@/components/shared/Navbar';
import JobStatusBadge from '@/components/shared/JobStatusBadge';
import { Button } from '@/components/ui/button';

const WallEditor = dynamic(() => import('@/components/shared/WallEditor'), { ssr: false, loading: () => <div className="skeleton rounded-xl h-150" /> });

export default function OperatorJobPage() {
    const { id } = useParams<{ id: string }>();
    const [job, setJob] = useState<JobData | null>(null);
    const [canvasSizes, setCanvasSizes] = useState<CanvasSizeData[]>([]);
    const [loading, setLoading] = useState(true);
    const [transitioning, setTransitioning] = useState('');

    const loadJob = useCallback(async () => {
        const [jobRes, sizesRes] = await Promise.all([fetch(`/api/jobs/${id}`), fetch('/api/canvas-sizes')]);
        if (!jobRes.ok) { setLoading(false); return; }
        const [jobData, sizesData] = await Promise.all([jobRes.json(), sizesRes.json()]);
        setJob(jobData);
        setCanvasSizes(sizesData);
        setLoading(false);
    }, [id]);

    useEffect(() => { loadJob(); }, [loadJob]);

    const transition = async (status: string) => {
        setTransitioning(status);
        const res = await fetch(`/api/jobs/${id}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
        if (res.ok) loadJob();
        setTransitioning('');
    };

    const handleSavePanels = useCallback(async (panels: PanelData[]) => {
        await fetch(`/api/jobs/${id}/panels`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ panels }),
        });
    }, [id]);

    if (loading) return <div className="min-h-screen bg-gray-50"><Navbar /><div className="max-w-7xl mx-auto px-4 py-8 space-y-4"><div className="skeleton h-12 rounded-xl" /><div className="skeleton h-96 rounded-xl" /></div></div>;
    if (!job) return <div className="min-h-screen bg-gray-50"><Navbar /><div className="max-w-7xl mx-auto px-4 py-8"><p className="text-red-600">Job not found</p><Link href="/operator/pipeline" className="text-brand-600 underline">← Pipeline</Link></div></div>;

    const canSendProof = job.status === 'ARRANGING' && job.panels.length > 0;
    const canMarkPrinted = job.status === 'APPROVED';
    const canMarkShipped = job.status === 'PRINTED';
    const canDownloadExport = ['APPROVED', 'PRINTED', 'SHIPPED'].includes(job.status);
    const editorEditable = ['UPLOADED', 'ARRANGING', 'PROOFING'].includes(job.status);

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Breadcrumb */}
                <div className="mb-4">
                    <Link href="/operator/pipeline" className="text-sm text-brand-600 hover:underline">← Pipeline</Link>
                </div>

                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
                    <div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
                            <JobStatusBadge status={job.status} />
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                            Customer: {job.customer?.email} · Wall: {job.wallWidthMm}×{job.wallHeightMm} mm · {job.panels.length} panels
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button size="sm" variant="outline" onClick={() => {
                            location.href = `/api/jobs/${id}/pdf?type=template`;
                        }}>
                            ⬇ Template PDF
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => {
                            location.href = `/api/jobs/${id}/pdf?type=reference`;
                        }}>
                            ⬇ Reference PDF
                        </Button>
                        {canDownloadExport && (
                            <Button size="sm" variant="outline" onClick={() => {
                                location.href = `/api/jobs/${id}/export`;
                            }}>
                                ⬇ Print-Master ZIP
                            </Button>
                        )}
                        {canSendProof && (
                            <Button
                                loading={transitioning === 'PROOFING'}
                                onClick={() => transition('PROOFING')}
                            >
                                Send Proof to Customer →
                            </Button>
                        )}
                        {canMarkPrinted && (
                            <Button loading={transitioning === 'PRINTED'} onClick={() => transition('PRINTED')}>
                                Mark as Printed
                            </Button>
                        )}
                        {canMarkShipped && (
                            <Button loading={transitioning === 'SHIPPED'} onClick={() => transition('SHIPPED')}>
                                Mark as Shipped
                            </Button>
                        )}
                    </div>
                </div>

                {/* Status timeline */}
                <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                    <div className="flex items-center gap-1 flex-wrap text-xs text-gray-500">
                        {['DRAFT', 'UPLOADED', 'ARRANGING', 'PROOFING', 'APPROVED', 'PRINTED', 'SHIPPED'].map((s, i, arr) => (
                            <div key={s} className="flex items-center gap-1">
                                <span className={`px-2 py-0.5 rounded ${job.status === s ? 'bg-brand-600 text-white font-semibold' : 'bg-gray-100'}`}>{s}</span>
                                {i < arr.length - 1 && <span className="text-gray-300">→</span>}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Wall editor */}
                <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <h2 className="font-semibold text-gray-800 mb-3">
                        Wall Layout
                        {!editorEditable && <span className="text-xs font-normal text-gray-400 ml-2">(read-only in {job.status} status)</span>}
                    </h2>
                    <WallEditor
                        jobId={id}
                        wallW={job.wallWidthMm}
                        wallH={job.wallHeightMm}
                        photos={job.photos}
                        canvasSizes={canvasSizes}
                        initialPanels={job.panels}
                        readOnly={!editorEditable}
                        onSave={handleSavePanels}
                    />
                </div>
            </main>
        </div>
    );
}