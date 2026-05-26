import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canTransition, type JobStatus } from '@/types';
import prisma from '@/lib/db/prisma';

// Who can trigger which transitions
// const ALLOWED_BY_ROLE: Record<string, JobStatus[]> = {
//     CUSTOMER: ['UPLOADED', 'ARRANGING'],   // submit for review, or revert to arranging
//     OPERATOR: ['ARRANGING', 'PROOFING', 'APPROVED', 'PRINTED', 'SHIPPED'],
// };

const ALLOWED_BY_ROLE: Record<string, JobStatus[]> = {
    CUSTOMER: ['UPLOADED', 'ARRANGING', 'PROOFING', 'APPROVED'], // upload, request changes, submit for review
    OPERATOR: ['ARRANGING', 'PROOFING', 'APPROVED', 'PRINTED', 'SHIPPED'],
};

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const id = (await params).id;

    const { status: newStatus } = await req.json() as { status: JobStatus };
    if (!newStatus) return NextResponse.json({ error: 'status is required' }, { status: 400 });

    const job = await prisma.job.findUnique({ where: { id } });
    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Customer can only touch their own jobs
    if (session.user.role !== 'OPERATOR' && job.customerId !== session.user.id) {

        console.log('You are not the owner');

        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate transition
    if (!canTransition(job.status as JobStatus, newStatus)) {
        return NextResponse.json(
            { error: `Invalid transition: ${job.status} → ${newStatus}` },
            { status: 400 }
        );
    }

    // Check role is allowed to make this transition
    const allowedForRole = ALLOWED_BY_ROLE[session.user.role] ?? [];
    if (!allowedForRole.includes(newStatus)) {

        console.log(newStatus);

        console.log("You are not allowed");

        return NextResponse.json(
            { error: `Your role cannot transition to ${newStatus}` },
            { status: 403 }
        );
    }

    const updated = await prisma.job.update({
        where: { id },
        data: { status: newStatus },
    });

    return NextResponse.json(updated);
}