import Navbar from "@/components/shared/Navbar";

const Loading = () => {
    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />
            <div className="max-w-6xl mx-auto px-4 py-8 space-y-4">
                <div className="skeleton h-12 rounded-xl" />
                <div className="skeleton h-96 rounded-xl" />
            </div>
        </div>
    );
}

export default Loading;