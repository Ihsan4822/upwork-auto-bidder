import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@upwork-bidder/core', '@upwork-bidder/config', '@upwork-bidder/db', '@upwork-bidder/ui'],
  env: {
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/upwork_bidder',
    OAUTH_TOKEN_ENCRYPTION_KEY:
      process.env.OAUTH_TOKEN_ENCRYPTION_KEY || '850bd951e72c474f8e247510acc52a76d1447fc1d9cf0439e86523e3aa77a56c',
    UPWORK_MCP_URL: process.env.UPWORK_MCP_URL || 'https://mcp.upwork.com/mcp',
    APP_URL: process.env.APP_URL || 'http://localhost:3000',
  },
};

export default nextConfig;
