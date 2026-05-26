import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextAuthProvider } from "@/components/NextAuthProvider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: 'Wood Panel Wall Designer',
    description: 'Design your custom wood panel wall layout',
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang="en"
            className={`${inter.className} h-full antialiased`}
        >
            <body className="min-h-full flex flex-col">
                <NextAuthProvider>
                    {children}
                </NextAuthProvider>
            </body>
        </html>
    );
}