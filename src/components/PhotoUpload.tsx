'use client';

import { useCallback, useRef, useState } from 'react';

interface UploadProgress {
    photoId: string;
    filename: string;
    progress: number; // 0-100
    status: 'uploading' | 'done' | 'error';
    error?: string;
}

interface Props {
    jobId: string;
    onUploaded: (photoId: string, filename: string) => void;
    disabled?: boolean;
}

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

const PhotoUpload = ({ jobId, onUploaded, disabled }: Props) => {
    const [uploads, setUploads] = useState<UploadProgress[]>([]);
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const uploadFile = useCallback(async (file: File) => {
        if (!ALLOWED.includes(file.type)) {
            alert(`"${file.name}" is not a supported image type (JPEG, PNG, WebP only).`);
            return;
        }

        const uploadId = `${Date.now()}-${file.name}`;
        setUploads((prev) => [
            ...prev,
            { photoId: uploadId, filename: file.name, progress: 0, status: 'uploading' },
        ]);

        try {
            // Step 1: Get presigned URL + create photo record
            const res = await fetch('/api/upload/presign', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jobId,
                    filename: file.name,
                    mimeType: file.type,
                    fileSize: file.size,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to get upload URL');
            }

            const { photoId, presignedUrl } = await res.json();

            // Step 2: Upload directly to S3 — file never touches our server
            await new Promise<void>((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open('PUT', presignedUrl);
                xhr.setRequestHeader('Content-Type', file.type);
                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const pct = Math.round((e.loaded / e.total) * 100);
                        setUploads((prev) =>
                            prev.map((u) => (u.photoId === uploadId ? { ...u, progress: pct } : u))
                        );
                    }
                };
                xhr.onload = () => {
                    if (xhr.status >= 200 && xhr.status < 300) resolve();
                    else reject(new Error(`S3 upload failed: ${xhr.status}`));
                };
                xhr.onerror = (e) => reject(new Error('Network error during upload'));
                xhr.send(file);
            });

            // Step 3: Mark done, notify parent
            setUploads((prev) =>
                prev.map((u) =>
                    u.photoId === uploadId ? { ...u, photoId, progress: 100, status: 'done' } : u
                )
            );
            onUploaded(photoId, file.name);

            // Auto-clear after 2s
            setTimeout(() => {
                setUploads((prev) => prev.filter((u) => u.photoId !== uploadId));
            }, 2000);
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Upload failed';
            setUploads((prev) =>
                prev.map((u) => (u.photoId === uploadId ? { ...u, status: 'error', error: msg } : u))
            );
        }
    }, [jobId, onUploaded]);

    const handleFiles = useCallback(
        (files: FileList | null) => {
            if (!files) return;
            Array.from(files).forEach(uploadFile);
        },
        [uploadFile]
    );

    const onDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setDragging(false);
            if (!disabled) handleFiles(e.dataTransfer.files);
        },
        [disabled, handleFiles]
    );

    return (
        <div className="space-y-3">
            {/* Drop zone */}
            <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => !disabled && inputRef.current?.click()}
                className={[
                    'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
                    dragging ? 'border-brand-500 bg-brand-50' : 'border-gray-300 hover:border-brand-400',
                    disabled ? 'opacity-50 cursor-not-allowed' : '',
                ].join(' ')}
            >
                <p className="text-sm font-medium text-gray-700">
                    Drop photos here or <span className="text-brand-600 underline">browse</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">JPEG, PNG, WebP — up to 50 MB each</p>
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => handleFiles(e.target.files)}
                    disabled={disabled}
                />
            </div>

            {/* Progress list */}
            {uploads.length > 0 && (
                <div className="space-y-2">
                    {uploads.map((u) => (
                        <div key={u.photoId} className="bg-gray-50 rounded-md px-3 py-2">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-gray-700 truncate max-w-50">{u.filename}</span>
                                <span className="text-xs text-gray-500">
                                    {u.status === 'done' ? '✓' : u.status === 'error' ? '✗' : `${u.progress}%`}
                                </span>
                            </div>
                            {u.status === 'uploading' && (
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                    <div
                                        className="bg-brand-600 h-1.5 rounded-full transition-all"
                                        style={{ width: `${u.progress}%` }}
                                    />
                                </div>
                            )}
                            {u.status === 'error' && (
                                <p className="text-xs text-red-600">{u.error}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default PhotoUpload;