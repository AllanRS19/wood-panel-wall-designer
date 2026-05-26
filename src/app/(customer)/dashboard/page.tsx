'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Navbar from '@/components/shared/Navbar';
import { Button } from '@/components/ui/button';
import JobStatusBadge from '@/components/shared/JobStatusBadge';
import { JobStatus } from '@/types';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Job {
    id: string;
    title: string;
    wallWidthMm: number;
    wallHeightMm: number;
    status: JobStatus;
    createdAt: string;
    updatedAt: string;
    _count: { photos: number; panels: number };
}

const Dashboard = () => {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({ title: '', wallWidthMm: '', wallHeightMm: '', paperSize: 'A4' });
    const [formError, setFormError] = useState('');

    useEffect(() => {
        fetch('/api/jobs').then((r) => r.json()).then(setJobs).finally(() => setLoading(false));
    }, []);

    async function createJob(e: React.FormEvent) {
        e.preventDefault();
        setFormError('');
        const w = parseFloat(form.wallWidthMm);
        const h = parseFloat(form.wallHeightMm);
        if (!form.title.trim()) { setFormError('Title is required'); return; }
        if (!w || !h || w <= 0 || h <= 0) { setFormError('Wall dimensions must be positive numbers'); return; }
        setCreating(true);
        try {
            const res = await fetch('/api/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: form.title.trim(), wallWidthMm: w, wallHeightMm: h, paperSize: form.paperSize }),
            });
            if (!res.ok) { const d = await res.json(); setFormError(d.error || 'Failed'); return; }
            const job = await res.json();
            setJobs((prev) => [job, ...prev]);
            setShowCreate(false);
            setForm({ title: '', wallWidthMm: '', wallHeightMm: '', paperSize: 'A4' });
        } finally {
            setCreating(false);
        }
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <main className="max-w-4xl mx-auto px-4 py-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">My Jobs</h1>
                        <p className="text-gray-500 text-sm mt-0.5">Your wood panel wall designs</p>
                    </div>
                    <Button
                        onClick={() => setShowCreate(true)}
                        className='cursor-pointer'
                    >
                        + New Job
                    </Button>
                </div>

                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
                    </div>
                ) : jobs.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="text-5xl mb-4">🪵</div>
                        <h2 className="text-xl font-semibold text-gray-700">No jobs yet</h2>
                        <p className="text-gray-500 mt-1 mb-6">Create your first wall panel job to get started.</p>
                        <Button
                            onClick={() => setShowCreate(true)}
                            className='cursor-pointer'
                        >
                            Create your first job
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {jobs.map((job) => (
                            <Link
                                key={job.id}
                                href={`/jobs/${job.id}`}
                                className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-brand-400 hover:shadow-sm transition-all"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-semibold text-gray-900 truncate">{job.title}</h3>
                                            <JobStatusBadge status={job.status} />
                                        </div>
                                        <p className="text-sm text-gray-500 mt-0.5">
                                            Wall: {job.wallWidthMm}×{job.wallHeightMm} mm ·{' '}
                                            {job._count?.photos} photo{job._count?.photos !== 1 ? 's' : ''} ·{' '}
                                            {job._count?.panels} panel{job._count?.panels !== 1 ? 's' : ''}
                                        </p>
                                    </div>
                                    <p className="text-xs text-gray-400 flex-none">
                                        {new Date(job.updatedAt).toLocaleDateString()}
                                    </p>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </main>

            <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>New Job</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={createJob} className="space-y-4">
                        <Input label="Job title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Living Room Gallery Wall" required />
                        <div className="grid grid-cols-2 gap-3">
                            <Input label="Wall width" type="number" min={100} max={10000} step={10} value={form.wallWidthMm} onChange={(e) => setForm((f) => ({ ...f, wallWidthMm: e.target.value }))} suffix="mm" required />
                            <Input label="Wall height" type="number" min={100} max={10000} step={10} value={form.wallHeightMm} onChange={(e) => setForm((f) => ({ ...f, wallHeightMm: e.target.value }))} suffix="mm" required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Template paper size</label>
                            <select value={form.paperSize} onChange={(e) => setForm((f) => ({ ...f, paperSize: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-brand-500">
                                <option value="A4">A4 (210×297 mm)</option>
                                <option value="LETTER">Letter (216×279 mm)</option>
                            </select>
                        </div>
                        {formError && <p className="text-sm text-red-600">{formError}</p>}
                        <div className="flex justify-end gap-2 pt-2">
                            <Button
                                className="cursor-pointer"
                                type="button"
                                variant="secondary"
                                onClick={() => setShowCreate(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="cursor-pointer"
                                type="submit"
                                loading={creating}
                            >
                                Create Job
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default Dashboard;