// components/WallEditorIsland.tsx
'use client';

import { useCallback } from 'react';
import type { CanvasSizeData, PanelData, PhotoData } from '@/types';
import WallEditor from './WallEditor';

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
    const handleSavePanels = useCallback(async (panels: PanelData[]) => {
        await fetch(`/api/jobs/${jobId}/panels`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ panels }),
        });
    }, [jobId]);

    return <WallEditor {...rest} jobId={jobId} onSave={handleSavePanels} />;
}