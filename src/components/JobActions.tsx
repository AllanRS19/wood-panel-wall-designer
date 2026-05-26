'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from './ui/button';

interface Props {
    jobId: string;
    isProofing: boolean;
    isApprovedOrLater: boolean;
    canSubmit: boolean;
}

const JobActions = ({ jobId, isProofing, isApprovedOrLater, canSubmit }: Props) => {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);
    const [approving, setApproving] = useState(false);
    const [requesting, setRequesting] = useState(false);

    const handleTransition = async (status: string) => {

        console.log("Change the status to approve");

        await fetch(`/api/jobs/${jobId}/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
        });
        router.refresh(); // re-runs the server component fetch
    };

    const downloadPdf = (type: 'template' | 'reference') => {
        window.open(`/api/jobs/${jobId}/pdf?type=${type}`, '_blank');
    };

    return (
        <div className="flex items-center gap-2 flex-wrap">
            {(isProofing || isApprovedOrLater) && (
                <>
                    <Button size="sm" variant="outline" onClick={() => downloadPdf('template')}>
                        ⬇ Hanging Template PDF
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => downloadPdf('reference')}>
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