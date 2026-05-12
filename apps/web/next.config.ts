import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  output: 'export',
  // Replace 'nce1-checkin' with your repository name
  basePath: isProd ? '/nce1-checkin' : '',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
