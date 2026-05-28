'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CircleAlert } from 'lucide-react';

const SignUp = () => {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
        setLoading(true);
        try {
            const res = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name }),
            });
            if (!res.ok) {
                const data = await res.json();
                setError(data.error || 'Signup failed');
                return;
            }
            await signIn('credentials', { email, password, redirect: false });
            router.push('/dashboard');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-brand-50 flex items-center justify-center px-4">
            <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-8">
                <div className="text-center mb-4">
                    <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
                    <p className="text-gray-500 mt-1">Design your perfect wall</p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <Input
                        label="Name"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoComplete="name"
                    />
                    <Input
                        label="Email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        required
                    />
                    <Input
                        label="Password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        required
                        hint="At least 8 characters"
                    />
                    {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">{error}</div>}
                    <Button type="submit" className="w-full cursor-pointer" size="lg" loading={loading}>
                        Create Account
                    </Button>
                </form>
                <p className="text-center text-sm text-gray-500 mt-6">
                    Already have an account?{' '}
                    <Link href="/sign-in" className="text-brand-600 font-medium hover:underline">Sign in</Link>
                </p>

                <div className="mt-6 flex items-start gap-3 rounded-md border border-blue-300 bg-blue-100 p-3 text-blue-900">
                    <div className="mt-0.5 shrink-0">
                        <CircleAlert className="h-5 w-5" />
                    </div>

                    <div className="space-y-1">
                        <p className="text-sm font-medium">Operator Account Information</p>

                        <p className="text-xs leading-relaxed">
                            To create an operator account, simply include{' '}
                            <span className="rounded bg-blue-200 px-1 py-0.5 font-mono text-[11px]">
                                @woodpanel
                            </span>{' '}
                            in the email address and the operator role will be assigned automatically. Just for testing purposes.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SignUp;