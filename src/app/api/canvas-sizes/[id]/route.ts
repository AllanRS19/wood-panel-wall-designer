import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    const size = await prisma.canvasSize.findUnique({
        where: { id },
        include: { holes: { orderBy: { createdAt: 'asc' } } },
    });
    if (!size) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json(size);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'OPERATOR') {
        return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
    }

    const { id } = await params;

    const body = await req.json();
    const allowed = ['name', 'widthMm', 'heightMm', 'thicknessMm', 'priceCents', 'active'];
    const update: Record<string, unknown> = {};
    for (const key of allowed) {
        if (key in body) update[key] = body[key];
    }

    const size = await prisma.canvasSize.update({
        where: { id },
        data: update,
        include: { holes: { orderBy: { createdAt: 'asc' } } },
    });

    return NextResponse.json(size);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'OPERATOR') {
        return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
    }

    const { id } = await params;

    // Check if any panels use this size
    const count = await prisma.panel.count({ where: { canvasSizeId: id } });
    if (count > 0) {
        // Deactivate instead of deleting to preserve history
        await prisma.canvasSize.update({ where: { id }, data: { active: false } });
        return NextResponse.json({ message: 'Canvas size deactivated (panels exist using it)' });
    }

    await prisma.canvasSize.delete({ where: { id } });
    return NextResponse.json({ success: true });
}