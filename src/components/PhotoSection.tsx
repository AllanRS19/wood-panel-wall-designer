'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PhotoData } from '@/types';
import PhotoUpload from './PhotoUpload';

interface Props {
    jobId: string;
    initialPhotos: PhotoData[];
}

export function PhotoSection({ jobId, initialPhotos }: Props) {
    const router = useRouter();
    // Optimistic local state so new uploads appear immediately
    const [photos, setPhotos] = useState(initialPhotos);

    const handlePhotoUploaded = (photoId: string, filename: string) => {
        setPhotos((prev) => [
            ...prev,
            { id: photoId, s3Key: '', originalName: filename, mimeType: 'image/jpeg' },
        ]);
        router.refresh(); // sync real URL from server
    };

    const handlePhotoDelete = async (photoId: string) => {
        if (!confirm('Remove this photo? Any panels using it will also be removed.')) return;
        await fetch('/api/upload/presign', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photoId }),
        });
        setPhotos((prev) => prev.filter((p) => p.id !== photoId));
        router.refresh();
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
            <h2 className="font-semibold text-gray-800 mb-3">Photos</h2>
            <div className="flex gap-4 flex-wrap">
                <div className="flex-1 min-w-70">
                    <PhotoUpload
                        jobId={jobId}
                        onUploaded={handlePhotoUploaded}
                        disabled={false}
                    />
                </div>
                {photos.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                        {photos.map((ph) => (
                            <div key={ph.id} className="relative group w-24">
                                {ph.url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={ph.url} alt={ph.originalName} className="w-24 h-24 object-cover rounded-lg border border-gray-200" />
                                ) : (
                                    <div className="w-24 h-24 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center text-2xl">🖼️</div>
                                )}
                                <button
                                    onClick={() => handlePhotoDelete(ph.id)}
                                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >✕</button>
                                <p className="text-xs text-gray-500 truncate mt-1">{ph.originalName}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}