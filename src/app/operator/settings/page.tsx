'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { CanvasSizeData } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/shared/Navbar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const DEFAULT_FORM = { name: '', widthMm: '', heightMm: '', thicknessMm: '18', priceCents: '' };

const EditModal = ({
    size,
    form,
    setForm,
    formError,
    handleSave,
    saving,
    onClose,
}: {
    size: CanvasSizeData | null;
    form: typeof DEFAULT_FORM;
    setForm: React.Dispatch<React.SetStateAction<typeof DEFAULT_FORM>>;
    formError: string;
    handleSave: (e: React.FormEvent) => void;
    saving: boolean;
    onClose: () => void;
}) => (
    <Dialog open={true} onOpenChange={onClose}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>
                    {size ? `Edit: ${size.name}` : 'Add Canvas Size'}
                </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-3">
                <Input label="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. 30×40 cm" required />
                <div className="grid grid-cols-2 gap-3">
                    <Input label="Width" type="number" min={10} step={1} value={form.widthMm} onChange={(e) => setForm((f) => ({ ...f, widthMm: e.target.value }))} suffix="mm" required />
                    <Input label="Height" type="number" min={10} step={1} value={form.heightMm} onChange={(e) => setForm((f) => ({ ...f, heightMm: e.target.value }))} suffix="mm" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <Input label="Thickness" type="number" min={1} step={1} value={form.thicknessMm} onChange={(e) => setForm((f) => ({ ...f, thicknessMm: e.target.value }))} suffix="mm" />
                    <Input label="Price" type="number" min={0} step={1} value={form.priceCents} onChange={(e) => setForm((f) => ({ ...f, priceCents: e.target.value }))} suffix="¢" hint="In cents" />
                </div>
                {formError && <p className="text-sm text-red-600">{formError}</p>}
                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit" loading={saving}>Save</Button>
                </div>
            </form>
        </DialogContent>
    </Dialog>
);

const OperatorSettingsPage = () => {
    const [sizes, setSizes] = useState<CanvasSizeData[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [editSize, setEditSize] = useState<CanvasSizeData | null>(null);
    const [form, setForm] = useState(DEFAULT_FORM);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState('');

    const loadSizes = async () => {
        const res = await fetch('/api/canvas-sizes');
        const data = await res.json();
        setSizes(data);
        setLoading(false);
    };

    useEffect(() => { loadSizes(); }, []);

    const openEdit = (size: CanvasSizeData) => {
        setEditSize(size);
        setForm({
            name: size.name,
            widthMm: String(size.widthMm),
            heightMm: String(size.heightMm),
            thicknessMm: String(size.thicknessMm),
            priceCents: String(size.priceCents),
        });
        setFormError('');
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');
        const w = parseFloat(form.widthMm), h = parseFloat(form.heightMm);
        if (!form.name.trim() || !w || !h) { setFormError('Name, width and height are required'); return; }
        setSaving(true);
        try {
            const url = editSize ? `/api/canvas-sizes/${editSize.id}` : '/api/canvas-sizes';
            const method = editSize ? 'PATCH' : 'POST';
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: form.name, widthMm: w, heightMm: h, thicknessMm: parseFloat(form.thicknessMm || '18'), priceCents: parseInt(form.priceCents || '0') }),
            });
            if (!res.ok) { const d = await res.json(); setFormError(d.error || 'Failed'); return; }
            await loadSizes();
            setShowAdd(false);
            setEditSize(null);
            setForm(DEFAULT_FORM);
        } finally {
            setSaving(false);
        }
    };

    const toggleActive = async (size: CanvasSizeData) => {
        await fetch(`/api/canvas-sizes/${size.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: !size.active }),
        });
        loadSizes();
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <main className="max-w-4xl mx-auto px-4 py-8">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Canvas Catalog</h1>
                        <p className="text-gray-500 text-sm mt-0.5">Manage available panel sizes and hole positions</p>
                    </div>
                    <Button onClick={() => { setShowAdd(true); setForm(DEFAULT_FORM); setFormError(''); }}>+ Add Size</Button>
                </div>

                {loading ? (
                    <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
                ) : (
                    <div className="space-y-3">
                        {sizes.map((size) => (
                            <div
                                key={size.id}
                                className={`bg-white border rounded-xl px-4 py-3 flex items-center gap-4 ${size.active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-gray-900">{size.name}</span>
                                        {!size.active && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Inactive</span>}
                                        {size.holes.length === 0 && (
                                            <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">⚠ Needs hole config</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-500">
                                        {size.widthMm}×{size.heightMm} mm · {size.thicknessMm}mm thick ·{' '}
                                        ${(size.priceCents / 100).toFixed(2)} ·{' '}
                                        {size.holes.length} hole{size.holes.length !== 1 ? 's' : ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 flex-none">
                                    <Link href={`/operator/settings/${size.id}`}>
                                        <Button size="sm" variant="outline">Edit Holes</Button>
                                    </Link>
                                    <Button size="sm" variant="ghost" onClick={() => openEdit(size)}>Edit</Button>
                                    <button
                                        onClick={() => toggleActive(size)}
                                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${size.active ? 'bg-brand-600' : 'bg-gray-200'}`}
                                        title={size.active ? 'Deactivate' : 'Activate'}
                                    >
                                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${size.active ? 'translate-x-4' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {showAdd && <EditModal size={null} onClose={() => setShowAdd(false)} form={form} setForm={setForm} formError={formError} saving={saving} handleSave={handleSave} />}
            {editSize && <EditModal size={editSize} onClose={() => setEditSize(null)} form={form} setForm={setForm} formError={formError} saving={saving} handleSave={handleSave} />}
        </div>
    );
}

export default OperatorSettingsPage;