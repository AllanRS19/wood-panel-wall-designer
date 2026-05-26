import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
    function middleware(req) {
        const token = req.nextauth.token;
        const path = req.nextUrl.pathname;

        // Operator-only routes
        if (path.startsWith('/operator') && token?.role !== 'OPERATOR') {
            return NextResponse.redirect(new URL('/dashboard', req.url));
        }

        // Customer routes are accessible to customers (not operators, who use /operator)
        if (path.startsWith('/dashboard') && token?.role === 'OPERATOR') {
            return NextResponse.redirect(new URL('/operator/pipeline', req.url));
        }

        return NextResponse.next();
    },
    {
        callbacks: {
            authorized: ({ token }) => !!token,
        },
        pages: {
            signIn: '/sign-in'
        }
    }
);

// These are the pages that are secured and require authentication
export const config = {
    matcher: [
        '/dashboard/:path*',
        '/jobs/:path*',
        '/operator/:path*',
    ],
};