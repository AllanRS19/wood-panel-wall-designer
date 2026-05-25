import prisma from '@/lib/db';
import { Role } from '@/app/generated/prisma/enums';
import bcrypt from 'bcryptjs';

async function main() {
    console.log('Seeding database...');

    // Create operator
    const opEmail = process.env.OPERATOR_EMAIL || 'operator@woodpanel.com';
    const opPassword = process.env.OPERATOR_PASSWORD || 'Operator1234!';
    const hash = await bcrypt.hash(opPassword, 12);

    await prisma.user.upsert({
        where: { email: opEmail },
        update: {},
        create: {
            email: opEmail,
            passwordHash: hash,
            name: 'Operator',
            role: Role.OPERATOR,
        },
    });
    console.log(`Operator created: ${opEmail}`);

    // Default canvas sizes
    const sizes = [
        { name: '20×30 cm', widthMm: 200, heightMm: 300, thicknessMm: 18, priceCents: 2500 },
        { name: '30×40 cm', widthMm: 300, heightMm: 400, thicknessMm: 18, priceCents: 3500 },
        { name: '40×60 cm', widthMm: 400, heightMm: 600, thicknessMm: 18, priceCents: 5500 },
        { name: '60×80 cm', widthMm: 600, heightMm: 800, thicknessMm: 18, priceCents: 7500 },
        { name: '30×30 cm', widthMm: 300, heightMm: 300, thicknessMm: 18, priceCents: 3000 },
        { name: '40×40 cm', widthMm: 400, heightMm: 400, thicknessMm: 18, priceCents: 4000 },
        { name: '20×20 cm', widthMm: 200, heightMm: 200, thicknessMm: 18, priceCents: 2000 },
    ];

    for (const s of sizes) {
        const existing = await prisma.canvasSize.findFirst({ where: { name: s.name } });
        if (!existing) {
            const cs = await prisma.canvasSize.create({ data: s });
            // Add sensible default holes (1 centred hole 50mm from top)
            await prisma.holePosition.create({
                data: {
                    canvasSizeId: cs.id,
                    xMm: s.widthMm / 2,
                    yMm: 50,
                    label: 'Centre top',
                },
            });
            console.log(`Canvas size created: ${s.name}`);
        }
    }

    console.log('Seed complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());