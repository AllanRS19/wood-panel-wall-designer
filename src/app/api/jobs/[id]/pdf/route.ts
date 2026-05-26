import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { buildTiledTemplatePdf, buildReferenceSheetPdf, type PdfPanel, type PdfJob } from '@/lib/pdf';
import { defaultHoles } from '@/lib/geometry';
import prisma from '@/lib/db/prisma';

async function buildPdfJob(jobId: string, userId: string, role: string): Promise<PdfJob | null> {
    const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: {
            panels: {
                include: {
                    canvasSize: { include: { holes: true } },
                },
                orderBy: { createdAt: 'asc' },
            },
        },
    });

    if (!job) return null;
    if (role !== 'OPERATOR' && job.customerId !== userId) return null;

    const panels: PdfPanel[] = job.panels.map((p, i) => ({
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
    }));

    return {
        title: job.title,
        wallWidthMm: job.wallWidthMm,
        wallHeightMm: job.wallHeightMm,
        paperSize: job.paperSize as 'A4' | 'LETTER',
        panels,
    };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = (await params).id;

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'template'; // 'template' | 'reference'

    const pdfJob = await buildPdfJob(id, session.user.id, session.user.role);
    if (!pdfJob) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    if (pdfJob.panels.length === 0) {
        return NextResponse.json({ error: 'No panels on wall — add panels before generating PDF' }, { status: 400 });
    }

    let pdfBytes: Uint8Array;
    let filename: string;

    if (type === 'reference') {
        pdfBytes = await buildReferenceSheetPdf(pdfJob);
        filename = `reference-${id}.pdf`;
    } else {
        pdfBytes = await buildTiledTemplatePdf(pdfJob);
        filename = `hanging-template-${id}.pdf`;
    }

    return new NextResponse(pdfBytes, {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
            'Content-Length': String(pdfBytes.byteLength),
        },
    });
}