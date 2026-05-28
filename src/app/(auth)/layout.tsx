import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

const AuthLayout = async ({
    children
}: Readonly<{
    children: React.ReactNode
}>) => {

    const session = await getServerSession(authOptions);

    if (session) {
        if (session.user?.role === 'OPERATOR') redirect('/operator/pipeline');
        else redirect('/dashboard');
    }

    return (
        <div>
            {children}
        </div>
    )
}

export default AuthLayout;