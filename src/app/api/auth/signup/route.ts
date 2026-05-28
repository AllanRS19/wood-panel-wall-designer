import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db/prisma';
import { Role } from '@/app/generated/prisma/enums';

export async function POST(req: NextRequest) {
    const { email, password, name } = await req.json();

    if (!email || !password) {
        return NextResponse.json({ error: 'email and password are required' }, { status: 400 });
    }
    if (password.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return NextResponse.json({ error: 'Email already registered' }, { status: 409 });

    const hash = await bcrypt.hash(password, 12);

    const role = email.includes('woodpanel') ? Role.OPERATOR : Role.CUSTOMER;

    const user = await prisma.user.create({
        data: {
            email: email.toLowerCase(),
            passwordHash: hash,
            name,
            role,
        },
        select: { id: true, email: true, name: true, role: true },
    });

    return NextResponse.json(user, { status: 201 });
}