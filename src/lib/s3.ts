import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
} from '@aws-sdk/client-s3';

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function getS3Client(): S3Client {
    const config: ConstructorParameters<typeof S3Client>[0] = {
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        },
    };

    // Support MinIO or other S3-compatible endpoints for local dev
    if (process.env.S3_ENDPOINT) {
        config.endpoint = process.env.S3_ENDPOINT;
        config.forcePathStyle = true;
    }

    return new S3Client(config);
}

export const s3 = getS3Client();
export const BUCKET = process.env.S3_BUCKET_NAME!;

/**
 * Generate a presigned PUT URL.
 * The browser uploads directly to S3 — file does NOT pass through our server.
 */
export async function getPresignedPutUrl(params: {
    key: string;
    contentType: string;
    maxSizeBytes?: number;
}): Promise<string> {
    const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: params.key,
        ContentType: params.contentType,
        ...(params.maxSizeBytes ? { ContentLength: params.maxSizeBytes } : {}),
    });

    return getSignedUrl(s3, command, { expiresIn: 3600 }); // 1 hour
}

/**
 * Generate a presigned GET URL for serving photos to the wall editor.
 */
export async function getPresignedGetUrl(key: string, expiresIn = 86400): Promise<string> {
    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    return getSignedUrl(s3, command, { expiresIn });
}

/**
 * Delete an object from S3.
 */
export async function deleteObject(key: string): Promise<void> {
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/**
 * Build an S3 key for a job photo.
 */
export function photoKey(jobId: string, photoId: string, filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || 'jpg';
    return `jobs/${jobId}/photos/${photoId}.${ext}`;
}