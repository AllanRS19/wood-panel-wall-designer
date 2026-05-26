import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db/prisma';
// import { getPresignedGetUrl } from '@/lib/s3';

async function getJobOrForbid(id: string, userId: string, role: string) {

    const job = await prisma.job.findUnique({
        where: {
            id
        },
        include: {
            photos: true,
            panels: {
                include: {
                    photo: true,
                    canvasSize: { include: { holes: true } },
                },
                orderBy: { createdAt: 'asc' },
            },
            customer: { select: { email: true, name: true } },
        },
    });

    if (!job) return null;
    if (role !== 'OPERATOR' && job.customerId !== userId) return null;

    return job;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = (await params).id;

    const job = await getJobOrForbid(id, session.user.id, session.user.role);
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Generate presigned GET URLs for photos
    // const photosWithUrls = await Promise.all(
    //     job.photos.map(async (p) => ({
    //         ...p,
    //         url: await getPresignedGetUrl(p.s3Key),
    //     }))
    // );

    // return NextResponse.json({ ...job, photos: photosWithUrls });
    return NextResponse.json({ ...job });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const job = await getJobOrForbid(params.id, session.user.id, session.user.role);
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await req.json();
    const allowed = ['title', 'wallWidthMm', 'wallHeightMm', 'paperSize'];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
        if (key in body) update[key] = body[key];
    }

    const updated = await prisma.job.update({ where: { id: params.id }, data: update });
    return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const job = await getJobOrForbid(params.id, session.user.id, session.user.role);
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Only operator or job owner in DRAFT can delete
    if (session.user.role !== 'OPERATOR' && job.status !== 'DRAFT') {
        return NextResponse.json({ error: 'Cannot delete a job that is not in DRAFT status' }, { status: 400 });
    }

    await prisma.job.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
}