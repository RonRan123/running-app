import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The guide moved out of the signed-in area so visitors can read it.
  async redirects() {
    return [{ source: '/how-to-use', destination: '/guide', permanent: true }]
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.squarespace-cdn.com',
      },
    ],
  },
};

export default nextConfig;
