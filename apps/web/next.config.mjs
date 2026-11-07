import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@upwork-bidder/core', '@upwork-bidder/config', '@upwork-bidder/db', '@upwork-bidder/ui'],
  outputFileTracingIncludes: {
    '/api/**/*': [
      '../../node_modules/.pnpm/@prisma+client*/**/*',
      '../../node_modules/.prisma/**/*',
    ],
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, 'src'),
    };

    if (isServer) {
      config.plugins.push({
        apply(compiler) {
          compiler.hooks.afterEmit.tap('CopyPrismaEnginePlugin', () => {
            try {
              const dbPackageDir = path.resolve(__dirname, '../../packages/db');
              const dbRequire = createRequire(path.join(dbPackageDir, 'package.json'));
              const prismaClientPath = dbRequire.resolve('@prisma/client');
              const prismaEnginesDir = path.join(path.dirname(prismaClientPath), '../../.prisma/client');

              if (fs.existsSync(prismaEnginesDir)) {
                const targetDirs = [
                  path.resolve(__dirname, '.next/server/chunks'),
                  path.resolve(__dirname, '.next/server'),
                ];

                const files = fs.readdirSync(prismaEnginesDir);
                for (const targetDir of targetDirs) {
                  if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                  }
                  for (const file of files) {
                    if (file.endsWith('.node')) {
                      fs.copyFileSync(
                        path.join(prismaEnginesDir, file),
                        path.join(targetDir, file)
                      );
                    }
                  }
                }
              }
            } catch (err) {
              console.warn('[Webpack] Could not copy Prisma engine binary:', err);
            }
          });
        },
      });
    }

    return config;
  },
  // Standard C10: Security Headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
