import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db/prisma';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Customers get only active sizes; operators get all
    const where = session.user.role === 'OPERATOR' ? {} : { active: true };

    const sizes = await prisma.canvasSize.findMany({
        where,
        include: {
            holes: {
                orderBy: {
                    createdAt: 'asc'
                }
            }
        },
        orderBy: [
            { active: 'desc' },
            { widthMm: 'asc' }
        ],
    });

    return NextResponse.json(sizes);
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'OPERATOR') {
        return NextResponse.json({ error: 'Operator access required' }, { status: 403 });
    }

    const body = await req.json();
    const { name, widthMm, heightMm, thicknessMm, priceCents } = body;

    if (!name || !widthMm || !heightMm) {
        return NextResponse.json({ error: 'name, widthMm, and heightMm are required' }, { status: 400 });
    }
    if (widthMm <= 0 || heightMm <= 0) {
        return NextResponse.json({ error: 'Dimensions must be positive' }, { status: 400 });
    }

    const size = await prisma.canvasSize.create({
        data: {
            name,
            widthMm: Number(widthMm),
            heightMm: Number(heightMm),
            thicknessMm: Number(thicknessMm || 18),
            priceCents: Number(priceCents || 0),
            active: true,
        },
        include: { holes: true },
    });

    return NextResponse.json(size, { status: 201 });
}