import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db/prisma';

const EDITABLE_STATUSES = ['DRAFT', 'UPLOADED', 'ARRANGING'];

async function checkJobAccess(jobId: string, userId: string, role: string) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return { job: null, error: 'Job not found' };
    if (role !== 'OPERATOR' && job.customerId !== userId) return { job: null, error: 'Forbidden' };
    return { job, error: null };
}

// GET — list panels for a job
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = (await params).id;

    const { job, error } = await checkJobAccess(id, session.user.id, session.user.role);
    if (!job) return NextResponse.json({ error }, { status: 404 });

    const panels = await prisma.panel.findMany({
        where: { jobId: id },
        include: {
            photo: true,
            canvasSize: { include: { holes: true } },
        },
        orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(panels);
}

// POST — create or bulk-replace panels (bulk: send { panels: [...] })
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = (await params).id;

    const { job, error } = await checkJobAccess(id, session.user.id, session.user.role);
    if (!job) return NextResponse.json({ error }, { status: 404 });

    const editable = EDITABLE_STATUSES.includes(job.status) || session.user.role === 'OPERATOR';
    if (!editable) {
        return NextResponse.json({ error: 'Job is not editable in current status' }, { status: 400 });
    }

    const body = await req.json();

    // Bulk replace: { panels: [...] }
    if (Array.isArray(body.panels)) {
        const panels = body.panels as Array<{
            id?: string;
            photoId: string;
            canvasSizeId: string;
            xMm: number;
            yMm: number;
            rotation: number;
            label?: string;
        }>;

        // Validate all canvasSizes exist and are active
        const sizeIds = [...new Set(panels.map((p) => p.canvasSizeId))];
        const sizes = await prisma.canvasSize.findMany({ where: { id: { in: sizeIds }, active: true } });
        if (sizes.length !== sizeIds.length) {
            return NextResponse.json({ error: 'One or more canvas sizes not found or inactive' }, { status: 400 });
        }

        // Validate photos belong to this job
        const photoIds = [...new Set(panels.map((p) => p.photoId))];
        const photos = await prisma.photo.findMany({ where: { id: { in: photoIds }, jobId: id } });
        if (photos.length !== photoIds.length) {
            return NextResponse.json({ error: 'One or more photos not found in this job' }, { status: 400 });
        }

        // Delete existing panels and replace
        await prisma.$transaction([
            prisma.panel.deleteMany({ where: { jobId: id } }),
            prisma.panel.createMany({
                data: panels.map((p, i) => ({
                    jobId: id,
                    photoId: p.photoId,
                    canvasSizeId: p.canvasSizeId,
                    xMm: Number(p.xMm),
                    yMm: Number(p.yMm),
                    rotation: [0, 90, 180, 270].includes(Number(p.rotation)) ? Number(p.rotation) : 0,
                    label: p.label || `Panel ${i + 1}`,
                })),
            }),
        ]);

        // Advance status to ARRANGING if still UPLOADED
        if (job.status === 'UPLOADED') {
            await prisma.job.update({ where: { id: id }, data: { status: 'ARRANGING' } });
        }

        const result = await prisma.panel.findMany({
            where: { jobId: id },
            include: { photo: true, canvasSize: { include: { holes: true } } },
        });
        return NextResponse.json(result);
    }

    // Single panel create
    const { photoId, canvasSizeId, xMm, yMm, rotation, label } = body;
    const panel = await prisma.panel.create({
        data: {
            jobId: id,
            photoId,
            canvasSizeId,
            xMm: Number(xMm),
            yMm: Number(yMm),
            rotation: [0, 90, 180, 270].includes(Number(rotation)) ? Number(rotation) : 0,
            label,
        },
        include: { photo: true, canvasSize: { include: { holes: true } } },
    });

    return NextResponse.json(panel, { status: 201 });
}

// PUT — update a single panel (pass panelId in body)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = (await params).id;

    const { job, error } = await checkJobAccess(id, session.user.id, session.user.role);
    if (!job) return NextResponse.json({ error }, { status: 404 });

    const body = await req.json();
    const { panelId, xMm, yMm, rotation, canvasSizeId, photoId, label } = body;

    const existing = await prisma.panel.findFirst({ where: { id: panelId, jobId: id } });
    if (!existing) return NextResponse.json({ error: 'Panel not found' }, { status: 404 });

    const updated = await prisma.panel.update({
        where: { id: panelId },
        data: {
            ...(xMm !== undefined && { xMm: Number(xMm) }),
            ...(yMm !== undefined && { yMm: Number(yMm) }),
            ...(rotation !== undefined && { rotation: Number(rotation) }),
            ...(canvasSizeId && { canvasSizeId }),
            ...(photoId && { photoId }),
            ...(label !== undefined && { label }),
        },
        include: { photo: true, canvasSize: { include: { holes: true } } },
    });

    return NextResponse.json(updated);
}

// DELETE — delete a panel (pass panelId in body)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = (await params).id;

    const { job, error } = await checkJobAccess(id, session.user.id, session.user.role);
    if (!job) return NextResponse.json({ error }, { status: 404 });

    const { panelId } = await req.json();
    await prisma.panel.deleteMany({ where: { id: panelId, jobId: id } });
    return NextResponse.json({ success: true });
}