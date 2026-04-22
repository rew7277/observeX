/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // bodySizeLimit is still valid inside experimental.serverActions
      // in Next.js 15 for overriding the default 1 MB request body cap.
      bodySizeLimit: "25mb"
    }
  }
};

export default nextConfig;
