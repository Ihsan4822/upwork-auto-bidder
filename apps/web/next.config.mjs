/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@upwork-bidder/core', '@upwork-bidder/config', '@upwork-bidder/db', '@upwork-bidder/ui'],
};

export default nextConfig;
