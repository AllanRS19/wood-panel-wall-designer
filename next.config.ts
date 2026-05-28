import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'woodpanel-photos-allanrs.s3.us-east-2.amazonaws.com',
        port: '',
        pathname: '/jobs/**'
      }
    ]
  }
};

export default nextConfig;