'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { STATUS_LABELS, type JobStatus } from '@/types';
import Navbar from '@/components/shared/Navbar';
import JobStatusBadge from '@/components/shared/JobStatusBadge';

const PIPELINE_ORDER: JobStatus[] = ['PROOFING', 'ARRANGING', 'UPLOADED', 'APPROVED', 'PRINTED', 'SHIPPED', 'DRAFT'];

interface Job {
    id: string;
    title: string;
    wallWidthMm: number;
    wallHeightMm: number;
    status: JobStatus;
    updatedAt: string;
    customer: { email: string; name: string | null };
    _count: { photos: number; panels: number };
}

const OperatorPipelinePage = () => {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/jobs').then((r) => r.json()).then(setJobs).finally(() => setLoading(false));
    }, []);

    const grouped = PIPELINE_ORDER.reduce((acc, status) => {
        const group = jobs.filter((j) => j.status === status);
        if (group.length > 0) acc.push({ status, jobs: group });
        return acc;
    }, [] as { status: JobStatus; jobs: Job[] }[]);

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <main className="max-w-6xl mx-auto px-4 py-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Job Pipeline</h1>
                        <p className="text-gray-500 text-sm">{jobs.length} total jobs</p>
                    </div>
                    <button
                        onClick={() => { setLoading(true); fetch('/api/jobs').then((r) => r.json()).then(setJobs).finally(() => setLoading(false)); }}
                        className="text-sm text-brand-600 hover:underline"
                    >
                        Refresh
                    </button>
                </div>

                {loading ? (
                    <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-32 rounded-xl" />)}</div>
                ) : grouped.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <p className="text-4xl mb-3">📋</p>
                        <p className="text-lg">No jobs in pipeline yet</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {grouped.map(({ status, jobs: group }) => (
                            <div key={status}>
                                <div className="flex items-center gap-2 mb-3">
                                    <JobStatusBadge status={status} />
                                    <span className="text-sm text-gray-500">{group.length} job{group.length !== 1 ? 's' : ''}</span>
                                </div>
                                <div className="space-y-2">
                                    {group.map((job) => (
                                        <Link
                                            key={job.id}
                                            href={`/operator/jobs/${job.id}`}
                                            className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-brand-400 hover:shadow-sm transition-all"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-gray-900 truncate">{job.title}</span>
                                                </div>
                                                <p className="text-sm text-gray-500 mt-0.5">
                                                    {job.customer.name || job.customer.email} · {job.wallWidthMm}×{job.wallHeightMm} mm ·{' '}
                                                    {job._count.panels} panels
                                                </p>
                                            </div>
                                            <div className="text-right text-xs text-gray-400 flex-none ml-4">
                                                <p>{new Date(job.updatedAt).toLocaleDateString()}</p>
                                                <p className="text-brand-600 font-medium mt-0.5">Open →</p>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}

export default OperatorPipelinePage;