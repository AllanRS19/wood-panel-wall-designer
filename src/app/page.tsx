import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

const Home = async () => {

    const session = await getServerSession(authOptions);
    
    if (session) {
        if (session.user?.role === 'OPERATOR') redirect('/operator/pipeline');
        else redirect('/dashboard');
    }

    redirect('/sign-in');
}

export default Home;