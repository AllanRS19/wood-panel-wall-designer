import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db/prisma';

function opOnly(session: Awaited<ReturnType<typeof getServerSession>>) {
    if (!session || session!.user.role !== 'OPERATOR')
        return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
    return null;
}

// GET — list holes for a canvas size
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const holes = await prisma.holePosition.findMany({
        where: { canvasSizeId: id },
        orderBy: { createdAt: 'asc' },
    });
    return NextResponse.json(holes);
}

// POST — add a hole
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    const deny = opOnly(session);
    if (deny) return deny;

    const { id } = await params;

    const size = await prisma.canvasSize.findUnique({ where: { id } });
    if (!size) return NextResponse.json({ error: 'Canvas size not found' }, { status: 404 });

    const { xMm, yMm, label } = await req.json();

    if (typeof xMm !== 'number' || typeof yMm !== 'number') {
        return NextResponse.json({ error: 'xMm and yMm (numbers) are required' }, { status: 400 });
    }
    if (xMm < 0 || xMm > size.widthMm || yMm < 0 || yMm > size.heightMm) {
        return NextResponse.json(
            { error: `Hole position (${xMm}, ${yMm}) is outside panel dimensions (${size.widthMm}×${size.heightMm} mm)` },
            { status: 400 }
        );
    }

    const hole = await prisma.holePosition.create({
        data: {
            canvasSizeId: id,
            xMm: Number(xMm),
            yMm: Number(yMm),
            label: label || 'Hanging point',
        },
    });

    return NextResponse.json(hole, { status: 201 });
}

// PUT — update a hole (holeId in body)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    const deny = opOnly(session);
    if (deny) return deny;

    const { id } = await params;

    const size = await prisma.canvasSize.findUnique({ where: { id } });
    if (!size) return NextResponse.json({ error: 'Canvas size not found' }, { status: 404 });

    const { holeId, xMm, yMm, label } = await req.json();

    const existing = await prisma.holePosition.findFirst({
        where: { id: holeId, canvasSizeId: id },
    });
    if (!existing) return NextResponse.json({ error: 'Hole not found' }, { status: 404 });

    const newX = xMm !== undefined ? Number(xMm) : existing.xMm;
    const newY = yMm !== undefined ? Number(yMm) : existing.yMm;

    if (newX < 0 || newX > size.widthMm || newY < 0 || newY > size.heightMm) {
        return NextResponse.json(
            { error: `Position (${newX}, ${newY}) is outside panel bounds (${size.widthMm}×${size.heightMm} mm)` },
            { status: 400 }
        );
    }

    const hole = await prisma.holePosition.update({
        where: { id: holeId },
        data: {
            xMm: newX,
            yMm: newY,
            ...(label !== undefined && { label }),
        },
    });

    return NextResponse.json(hole);
}

// DELETE — remove a hole (holeId in body)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    const deny = opOnly(session);
    if (deny) return deny;

    const { id } = await params;

    const { holeId } = await req.json();
    await prisma.holePosition.deleteMany({
        where: { id: holeId, canvasSizeId: id },
    });
    return NextResponse.json({ success: true });
}