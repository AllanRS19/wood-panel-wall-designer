'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';

interface Props {
    jobId: string;
    isDraft: boolean;
    isProofing: boolean;
    isApprovedOrLater: boolean;
    canSubmit: boolean;
}

const JobActions = ({ jobId, isDraft, isProofing, isApprovedOrLater, canSubmit }: Props) => {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [approving, setApproving] = useState(false);
    const [requesting, setRequesting] = useState(false);

    // Add this handler alongside the other handlers
    const handleDeleteJob = async () => {
        if (!confirm(`Are you sure you want to delete this job? This cannot be undone.`)) return;
        const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' });
        if (res.ok) {
            router.push('/dashboard');
        }
    };

    const handleTransition = async (status: string) => {

        await fetch(`/api/jobs/${jobId}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
        router.refresh(); // re-runs the server component fetch
    };

    return (
        <div className="flex items-center gap-2 flex-wrap">
            {isDraft && (
                <Button size="sm" variant="danger" onClick={handleDeleteJob}>
                    Delete job
                </Button>
            )}
            {(isProofing || isApprovedOrLater) && (
                <>
                    <Button size="sm" variant="outline" onClick={() => {
                        location.href = `/api/jobs/${jobId}/pdf?type=template`;
                    }}>
                        ⬇ Hanging Template PDF
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => {
                        location.href = `/api/jobs/${jobId}/pdf?type=reference`;
                    }}>
                        ⬇ Reference Sheet PDF
                    </Button>
                </>
            )}
            {isProofing && (
                <>
                    <Button size="sm" variant="danger" loading={requesting} onClick={async () => {
                        setRequesting(true);
                        await handleTransition('ARRANGING');
                        setRequesting(false);
                    }}>
                        Request Changes
                    </Button>
                    <Button size="sm" loading={approving} onClick={async () => {
                        setApproving(true);
                        await handleTransition('APPROVED');
                        setApproving(false);
                    }}>
                        ✓ Approve Layout
                    </Button>
                </>
            )}
            {canSubmit && (
                <Button loading={submitting} onClick={async () => {
                    setSubmitting(true);
                    await handleTransition('PROOFING');
                    setSubmitting(false);
                }}>
                    Submit for Review →
                </Button>
            )}
        </div>
    );
}

export default JobActions;