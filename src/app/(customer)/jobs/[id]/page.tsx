import { notFound } from 'next/navigation';
import dynamic from 'next/dynamic';
import { cookies, headers } from 'next/headers';
import Navbar from '@/components/shared/Navbar';
import JobStatusBadge from '@/components/shared/JobStatusBadge';
import JobActions from '@/components/JobActions';
import { PhotoSection } from '@/components/PhotoSection';
import type { CanvasSizeData, JobData } from '@/types';

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
        cache: 'no-store',
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
        next: { revalidate: 3600 },
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

    const isDraft = ['DRAFT'].includes(job.status);
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
                        isDraft={isDraft}
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
                            key={job.photos.map((p) => p.id).join(',')}
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