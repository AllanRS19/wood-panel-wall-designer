import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db/prisma';

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const where =
        session.user.role === 'OPERATOR'
            ? {} // Operator sees all jobs
            : { customerId: session.user.id }; // Customer sees only their own

    const jobs = await prisma.job.findMany({
        where,
        include: {
            customer: {
                select: {
                    email: true,
                    name: true
                }
            },
            _count: {
                select: {
                    photos: true,
                    panels: true
                }
            },
        },
        orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json(jobs);
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { title, wallWidthMm, wallHeightMm, paperSize } = body;

    if (!title || !wallWidthMm || !wallHeightMm) {
        return NextResponse.json({ error: 'title, wallWidthMm, and wallHeightMm are required' }, { status: 400 });
    }
    if (wallWidthMm <= 0 || wallHeightMm <= 0 || wallWidthMm > 10000 || wallHeightMm > 10000) {
        return NextResponse.json({ error: 'Wall dimensions must be between 1 and 10000 mm' }, { status: 400 });
    }

    const job = await prisma.job.create({
        data: {
            title,
            wallWidthMm: Number(wallWidthMm),
            wallHeightMm: Number(wallHeightMm),
            paperSize: paperSize === 'LETTER' ? 'LETTER' : 'A4',
            customerId: session.user.id,
            status: 'DRAFT',
        },
    });

    return NextResponse.json(job, { status: 201 });
}