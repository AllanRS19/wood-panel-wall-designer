'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { Button } from '../ui/button';

const Navbar = () => {
    const { data: session } = useSession();
    const isOperator = session?.user.role === 'OPERATOR';

    return (
        <nav className="bg-white border-b border-gray-200 px-4 md:px-8 py-3 flex items-center justify-between">
            <div className="flex items-center gap-6">
                <Link href={isOperator ? '/operator/pipeline' : '/dashboard'} className="flex items-center gap-2">
                    <span className="text-2xl">🪵</span>
                    <span className="font-bold text-gray-900 hidden sm:block">Wood Panel Designer</span>
                </Link>
                {isOperator && (
                    <div className="flex items-center gap-4 text-sm">
                        <Link href="/operator/pipeline" className="text-gray-600 hover:text-gray-900 font-medium">Pipeline</Link>
                        <Link href="/operator/settings" className="text-gray-600 hover:text-gray-900 font-medium">Settings</Link>
                    </div>
                )}
                {!isOperator && (
                    <div className="flex items-center gap-4 text-sm">
                        <Link href="/dashboard" className="text-gray-600 hover:text-gray-900 font-medium">My Jobs</Link>
                    </div>
                )}
            </div>
            <div className="flex items-center gap-3">
                {isOperator && (
                    <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                        Operator
                    </span>
                )}
                <span className="hidden sm:block text-sm text-gray-500 truncate max-w-40">
                    {session?.user.name}
                </span>
                <Button
                    className='cursor-pointer'
                    variant="ghost"
                    size="sm"
                    onClick={() => signOut({ callbackUrl: '/sign-in' })}
                >
                    Sign out
                </Button>
            </div>
        </nav>
    );
}

export default Navbar;