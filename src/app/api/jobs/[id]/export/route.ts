import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db/prisma';
import { buildPrintMasterZip } from '@/lib/zipExport';
import { getPresignedGetUrl } from '@/lib/s3';
import { defaultHoles } from '@/lib/geometry';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'OPERATOR') {
        return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
    }

    const { id } = await params;

    const job = await prisma.job.findUnique({
        where: { id },
        include: {
            panels: {
                include: {
                    photo: true,
                    canvasSize: { include: { holes: true } },
                },
                orderBy: { createdAt: 'asc' },
            },
        },
    });

    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (job.status !== 'APPROVED' && job.status !== 'PRINTED' && job.status !== 'SHIPPED') {
        return NextResponse.json({ error: 'Job must be APPROVED before exporting print files' }, { status: 400 });
    }

    const panels = await Promise.all(
        job.panels.map(async (p, i) => {
            const photoUrl = await getPresignedGetUrl(p.photo.s3Key, 3600);
            return {
                id: p.id,
                label: p.label || `Panel ${i + 1}`,
                xMm: p.xMm,
                yMm: p.yMm,
                widthMm: p.canvasSize.widthMm,
                heightMm: p.canvasSize.heightMm,
                rotation: p.rotation as 0 | 90 | 180 | 270,
                holes:
                    p.canvasSize.holes.length > 0
                        ? p.canvasSize.holes.map((h) => ({ xMm: h.xMm, yMm: h.yMm, label: h.label }))
                        : defaultHoles(p.canvasSize.widthMm),
                photoUrl,
                photoOriginalName: p.photo.originalName,
                photoS3Key: p.photo.s3Key,
            };
        })
    );

    const zipBytes = await buildPrintMasterZip({
        title: job.title,
        wallWidthMm: job.wallWidthMm,
        wallHeightMm: job.wallHeightMm,
        paperSize: job.paperSize as 'A4' | 'LETTER',
        panels,
    });

    return new NextResponse(zipBytes, {
        headers: {
            'Content-Type': 'application/zip',
            'Content-Disposition': `attachment; filename="print-master-${id}.zip"`,
            'Content-Length': String(zipBytes.byteLength),
        },
    });
}