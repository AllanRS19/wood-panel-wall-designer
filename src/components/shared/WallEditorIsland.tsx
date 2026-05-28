'use client';

import { useCallback } from 'react';
import type { CanvasSizeData, PanelData, PhotoData } from '@/types';
import WallEditor from './WallEditor';
import { useRouter } from 'next/navigation';

interface Props {
    jobId: string;
    wallW: number;
    wallH: number;
    photos: PhotoData[];
    canvasSizes: CanvasSizeData[];
    initialPanels: PanelData[];
    readOnly: boolean;
}

export default function WallEditorIsland({ jobId, ...rest }: Props) {

    const router = useRouter();

    const handleSavePanels = useCallback(async (panels: PanelData[]) => {
        const res = await fetch(`/api/jobs/${jobId}/panels`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ panels }),
        });

        if (!res.ok) return;

        const { statusChanged } = await res.json();

        // The server tells us definitively whether the job status changed.
        // Only refresh the Server Component when it actually did.
        if (statusChanged) {
            router.refresh();
        }

    }, [jobId, router]);

    return <WallEditor {...rest} jobId={jobId} onSave={handleSavePanels} />;
}