import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { randomUUID } from 'crypto';
import { authOptions } from '@/lib/auth';
import { getPresignedPutUrl, photoKey, deleteObject } from '@/lib/s3';
import prisma from '@/lib/db/prisma';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB

// POST /api/upload/presign — get a presigned PUT URL, create photo record
export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { jobId, filename, mimeType, fileSize } = await req.json();

    if (!jobId || !filename || !mimeType) {
        return NextResponse.json({ error: 'jobId, filename, mimeType are required' }, { status: 400 });
    }
    if (!ALLOWED_MIME.includes(mimeType)) {
        return NextResponse.json({ error: 'Only JPEG, PNG, WebP are accepted' }, { status: 400 });
    }
    if (fileSize && fileSize > MAX_BYTES) {
        return NextResponse.json({ error: 'File exceeds 50 MB limit' }, { status: 400 });
    }

    // Verify job ownership
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    if (session.user.role !== 'OPERATOR' && job.customerId !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Create photo record first (status not confirmed until upload complete)
    const photoId = randomUUID();
    const key = photoKey(jobId, photoId, filename);

    const photo = await prisma.photo.create({
        data: {
            id: photoId,
            jobId,
            s3Key: key,
            originalName: filename,
            mimeType,
        },
    });

    // Generate presigned PUT URL — browser uploads directly to S3
    const presignedUrl = await getPresignedPutUrl({
        key,
        contentType: mimeType,
        maxSizeBytes: fileSize || MAX_BYTES,
    });

    // Advance job to UPLOADED if still DRAFT
    if (job.status === 'DRAFT') {
        await prisma.job.update({ where: { id: jobId }, data: { status: 'UPLOADED' } });
    }

    return NextResponse.json({
        photoId: photo.id,
        presignedUrl,
        s3Key: key,
    });
}

// DELETE /api/upload/presign — remove a photo record and its S3 object
export async function DELETE(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { photoId } = await req.json();

    const photo = await prisma.photo.findUnique({
        where: { id: photoId },
        include: { job: true },
    });
    if (!photo) return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    if (session.user.role !== 'OPERATOR' && photo.job.customerId !== session.user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // remainingAfterDelete = current total photos minus the one being removed from the list
    const totalPhotos = await prisma.photo.count({
        where: { jobId: photo.jobId },
    });
    const remainingAfterDelete = totalPhotos - 1;

    // Remove panels using this photo
    await prisma.panel.deleteMany({ where: { photoId } });
    // Delete from S3
    try { await deleteObject(photo.s3Key); } catch { /* ignore if not found */ }
    // Delete record
    await prisma.photo.delete({ where: { id: photoId } });

    let statusChanged = false;

    if (remainingAfterDelete === 0) {
        await prisma.job.update({
            where: { id: photo.jobId },
            data: { status: 'DRAFT' },
        });
        statusChanged = true;

    } else if (photo.job.status === 'ARRANGING') {
        // Photos still exist — check if any panels remain on the wall
        const remainingPanels = await prisma.panel.count({
            where: { jobId: photo.jobId },
        });
        if (remainingPanels === 0) {
            // Wall is now empty but photos exist → back to UPLOADED
            await prisma.job.update({
                where: { id: photo.jobId },
                data: { status: 'UPLOADED' },
            });
            statusChanged = true;
        }
    }

    return NextResponse.json({ success: true, remainingPhotos: remainingAfterDelete, statusChanged });
}

// POST /api/upload/presign/signup (auth signup)
export async function PUT(req: NextRequest) {
    // Signup endpoint — no session required
    const { email, password, name } = await req.json();

    if (!email || !password) {
        return NextResponse.json({ error: 'email and password are required' }, { status: 400 });
    }
    if (password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: 409 });

    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
        data: {
            email: email.toLowerCase(),
            passwordHash: hash,
            name: name || null,
            role: 'CUSTOMER',
        },
        select: { id: true, email: true, name: true, role: true },
    });

    return NextResponse.json(user, { status: 201 });
}