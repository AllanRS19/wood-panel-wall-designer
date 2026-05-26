// 'use client';

// import { useCallback, useEffect, useState } from 'react';
// import { useParams } from 'next/navigation';
// import dynamic from 'next/dynamic';
// import { Navbar } from '@/components/Navbar';
// import { PhotoUpload } from '@/components/PhotoUpload';
// import { Button } from '@/components/ui/Button';
// import { JobStatusBadge } from '@/components/JobStatusBadge';
// import type { CanvasSizeData, JobData, PanelData } from '@/types';

// const WallEditor = dynamic(() => import('@/components/WallEditor'), { ssr: false, loading: () => <div className="skeleton rounded-xl h-[600px]" /> });

// const CustomerJob = () => {
//     const { id } = useParams<{ id: string }>();
//     const [job, setJob] = useState<JobData | null>(null);
//     const [canvasSizes, setCanvasSizes] = useState<CanvasSizeData[]>([]);
//     const [loading, setLoading] = useState(true);
//     const [submitting, setSubmitting] = useState(false);
//     const [approving, setApproving] = useState(false);
//     const [requesting, setRequesting] = useState(false);
//     const [error, setError] = useState('');

//     const loadJob = useCallback(async () => {
//         const [jobRes, sizesRes] = await Promise.all([
//             fetch(`/api/jobs/${id}`),
//             fetch('/api/canvas-sizes'),
//         ]);
//         if (!jobRes.ok) { setError('Job not found'); setLoading(false); return; }
//         const [jobData, sizesData] = await Promise.all([jobRes.json(), sizesRes.json()]);
//         setJob(jobData);
//         setCanvasSizes(sizesData);
//         setLoading(false);
//     }, [id]);

//     useEffect(() => { loadJob(); }, [loadJob]);

//     const handlePhotoUploaded = (photoId: string, filename: string) => {
//         setJob((prev) => {
//             if (!prev) return prev;
//             return { ...prev, photos: [...prev.photos, { id: photoId, s3Key: '', originalName: filename, mimeType: 'image/jpeg' }] };
//         });
//         loadJob(); // reload to get URL
//     };

//     const handlePhotoDelete = async (photoId: string) => {
//         if (!confirm('Remove this photo? Any panels using it will also be removed.')) return;
//         await fetch('/api/upload/presign', {
//             method: 'DELETE',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ photoId }),
//         });
//         loadJob();
//     };

//     const handleSavePanels = useCallback(async (panels: PanelData[]) => {
//         await fetch(`/api/jobs/${id}/panels`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ panels }),
//         });
//     }, [id]);

//     const handleTransition = async (status: string) => {
//         const res = await fetch(`/api/jobs/${id}/status`, {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({ status }),
//         });
//         if (res.ok) loadJob();
//     };

//     const downloadPdf = (type: 'template' | 'reference') => {
//         window.open(`/api/jobs/${id}/pdf?type=${type}`, '_blank');
//     };

//     if (loading) return <div className="min-h-screen bg-gray-50"><Navbar /><div className="max-w-6xl mx-auto px-4 py-8 space-y-4"><div className="skeleton h-12 rounded-xl" /><div className="skeleton h-96 rounded-xl" /></div></div>;
//     if (!job) return <div className="min-h-screen bg-gray-50"><Navbar /><div className="max-w-6xl mx-auto px-4 py-8"><p className="text-red-600">{error}</p></div></div>;

//     const isEditable = ['DRAFT', 'UPLOADED', 'ARRANGING'].includes(job.status);
//     const isProofing = job.status === 'PROOFING';
//     const isApprovedOrLater = ['APPROVED', 'PRINTED', 'SHIPPED'].includes(job.status);
//     const canSubmit = isEditable && job.panels.length > 0 && job.status !== 'DRAFT';

//     return (
//         <div className="min-h-screen bg-gray-50">
//             <Navbar />
//             <main className="max-w-7xl mx-auto px-4 py-6">
//                 {/* Header */}
//                 <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
//                     <div>
//                         <div className="flex items-center gap-3 flex-wrap">
//                             <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
//                             <JobStatusBadge status={job.status} />
//                         </div>
//                         <p className="text-gray-500 text-sm mt-1">
//                             Wall: {job.wallWidthMm}×{job.wallHeightMm} mm · {job.photos.length} photos · {job.panels.length} panels
//                         </p>
//                     </div>
//                     <div className="flex items-center gap-2 flex-wrap">
//                         {(isProofing || isApprovedOrLater) && (
//                             <>
//                                 <Button size="sm" variant="outline" onClick={() => downloadPdf('template')}>
//                                     ⬇ Hanging Template PDF
//                                 </Button>
//                                 <Button size="sm" variant="outline" onClick={() => downloadPdf('reference')}>
//                                     ⬇ Reference Sheet PDF
//                                 </Button>
//                             </>
//                         )}
//                         {isProofing && (
//                             <>
//                                 <Button size="sm" variant="danger" loading={requesting} onClick={async () => {
//                                     setRequesting(true);
//                                     await handleTransition('ARRANGING');
//                                     setRequesting(false);
//                                 }}>
//                                     Request Changes
//                                 </Button>
//                                 <Button size="sm" loading={approving} onClick={async () => {
//                                     setApproving(true);
//                                     await handleTransition('APPROVED');
//                                     setApproving(false);
//                                 }}>
//                                     ✓ Approve Layout
//                                 </Button>
//                             </>
//                         )}
//                         {canSubmit && (
//                             <Button loading={submitting} onClick={async () => {
//                                 setSubmitting(true);
//                                 await handleTransition('PROOFING');
//                                 setSubmitting(false);
//                             }}>
//                                 Submit for Review →
//                             </Button>
//                         )}
//                     </div>
//                 </div>

//                 {/* Proof review notice */}
//                 {isProofing && (
//                     <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
//                         <p className="font-medium text-purple-900">Your layout is awaiting your approval</p>
//                         <p className="text-sm text-purple-700 mt-0.5">
//                             Review the layout below (read-only). Download the PDFs to check dimensions.
//                             If everything looks correct, click Approve. Otherwise, click Request Changes to edit.
//                         </p>
//                     </div>
//                 )}

//                 {/* Upload section */}
//                 {isEditable && (
//                     <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
//                         <h2 className="font-semibold text-gray-800 mb-3">Photos</h2>
//                         <div className="flex gap-4 flex-wrap">
//                             <div className="flex-1 min-w-[280px]">
//                                 <PhotoUpload jobId={id} onUploaded={handlePhotoUploaded} disabled={!isEditable} />
//                             </div>
//                             {job.photos.length > 0 && (
//                                 <div className="flex gap-2 flex-wrap">
//                                     {job.photos.map((ph) => (
//                                         <div key={ph.id} className="relative group w-24">
//                                             {ph.url ? (
//                                                 // eslint-disable-next-line @next/next/no-img-element
//                                                 <img src={ph.url} alt={ph.originalName} className="w-24 h-24 object-cover rounded-lg border border-gray-200" />
//                                             ) : (
//                                                 <div className="w-24 h-24 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center text-2xl">🖼️</div>
//                                             )}
//                                             <button
//                                                 onClick={() => handlePhotoDelete(ph.id)}
//                                                 className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
//                                             >✕</button>
//                                             <p className="text-xs text-gray-500 truncate mt-1">{ph.originalName}</p>
//                                         </div>
//                                     ))}
//                                 </div>
//                             )}
//                         </div>
//                     </div>
//                 )}

//                 {/* Wall editor */}
//                 {(job.photos.length > 0 || job.panels.length > 0) && (
//                     <div className="bg-white rounded-xl border border-gray-200 p-4">
//                         <h2 className="font-semibold text-gray-800 mb-3">
//                             Wall Layout {isProofing && <span className="text-xs font-normal text-purple-600 ml-1">(read-only — pending approval)</span>}
//                         </h2>
//                         <WallEditor
//                             jobId={id}
//                             wallW={job.wallWidthMm}
//                             wallH={job.wallHeightMm}
//                             photos={job.photos}
//                             canvasSizes={canvasSizes}
//                             initialPanels={job.panels}
//                             readOnly={!isEditable}
//                             onSave={handleSavePanels}
//                         />
//                     </div>
//                 )}

//                 {job.photos.length === 0 && isEditable && (
//                     <div className="text-center py-12 text-gray-400">
//                         <p className="text-4xl mb-3">⬆️</p>
//                         <p className="text-lg font-medium">Upload photos to start designing</p>
//                     </div>
//                 )}
//             </main>
//         </div>
//     );
// }

// export default CustomerJob;

// app/jobs/[id]/page.tsx  (Server Component — no 'use client')

import { notFound } from 'next/navigation';
import dynamic from 'next/dynamic';
import Navbar from '@/components/shared/Navbar';
import JobStatusBadge from '@/components/shared/JobStatusBadge';
import JobActions from '@/components/JobActions';
import { PhotoSection } from '@/components/PhotoSection';
import type { CanvasSizeData, JobData } from '@/types';
import { cookies, headers } from 'next/headers';

interface Props {
    params: Promise<{ id: string }>;
}

const WallEditorIsland = dynamic(() => import('@/components/shared/WallEditorIsland'), {
    loading: () => <div className="skeleton rounded-xl h-150" />,
});

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL;

async function getJob(id: string): Promise<JobData | null> {

    const cookieStore = await cookies();
    const headersList = await headers();

    const res = await fetch(`${BASE_URL}/api/jobs/${id}`, {
        cache: 'no-store', // always fresh — job status changes frequently
        headers: {
            cookie: cookieStore.toString(),
            host: headersList.get("host") ?? ''
        }
    });

    console.log(res);

    if (!res.ok) return null;
    return res.json();
}

async function getCanvasSizes(): Promise<CanvasSizeData[]> {

    const cookieStore = await cookies();
    const headersList = await headers();

    const res = await fetch(`${BASE_URL}/api/canvas-sizes`, {
        next: { revalidate: 3600 }, // canvas sizes rarely change
        headers: {
            cookie: cookieStore.toString(),
            host: headersList.get("host") ?? ''
        }
    });

    if (!res.ok) return [];
    return res.json();
}

const CustomerJobPage = async ({ params }: Props) => {

    const { id } = await params;

    const [job, canvasSizes] = await Promise.all([getJob(id), getCanvasSizes()]);

    if (!job) notFound();

    const isEditable = ['DRAFT', 'UPLOADED', 'ARRANGING'].includes(job.status);
    const isProofing = job.status === 'PROOFING';
    const isApprovedOrLater = ['APPROVED', 'PRINTED', 'SHIPPED'].includes(job.status);
    // const canSubmit = isEditable && job.panels.length > 0 && job.status !== 'DRAFT';
    const canSubmit = job.status === 'ARRANGING' && job.panels.length > 0;

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
                    <div>
                        <div className="flex items-center gap-3 flex-wrap">
                            <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
                            <JobStatusBadge status={job.status} />
                        </div>
                        <p className="text-gray-500 text-sm mt-1">
                            Wall: {job.wallWidthMm}×{job.wallHeightMm} mm · {job.photos.length} photos · {job.panels.length} panels
                        </p>
                    </div>

                    {/* All buttons need client-side state/handlers → island switched to client-side components */}
                    <JobActions
                        jobId={id}
                        isProofing={isProofing}
                        isApprovedOrLater={isApprovedOrLater}
                        canSubmit={canSubmit}
                    />
                </div>

                {/* Proof review notice — pure markup, no interactivity */}
                {isProofing && (
                    <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-4">
                        <p className="font-medium text-purple-900">Your layout is awaiting your approval</p>
                        <p className="text-sm text-purple-700 mt-0.5">
                            Review the layout below (read-only). Download the PDFs to check dimensions.
                            If everything looks correct, click Approve. Otherwise, click Request Changes to edit.
                        </p>
                    </div>
                )}

                {/* Photo upload + thumbnails — needs state for optimistic UI → island */}
                {isEditable && (
                    <PhotoSection
                        jobId={id}
                        initialPhotos={job.photos}
                    />
                )}

                {/* Wall editor — needs browser canvas APIs → island */}
                {(job.photos.length > 0 || job.panels.length > 0) && (
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                        <h2 className="font-semibold text-gray-800 mb-3">
                            Wall Layout{' '}
                            {isProofing && (
                                <span className="text-xs font-normal text-purple-600 ml-1">
                                    (read-only — pending approval)
                                </span>
                            )}
                        </h2>
                        <WallEditorIsland
                            jobId={id}
                            wallW={job.wallWidthMm}
                            wallH={job.wallHeightMm}
                            photos={job.photos}
                            canvasSizes={canvasSizes}
                            initialPanels={job.panels}
                            readOnly={!isEditable}
                        />
                    </div>
                )}

                {job.photos.length === 0 && isEditable && (
                    <div className="text-center py-12 text-gray-400">
                        <p className="text-4xl mb-3">⬆️</p>
                        <p className="text-lg font-medium">Upload photos to start designing</p>
                    </div>
                )}
            </main>
        </div>
    );
}

export default CustomerJobPage;