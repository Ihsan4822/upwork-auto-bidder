import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, '../../'),
  transpilePackages: ['@upwork-bidder/core', '@upwork-bidder/config', '@upwork-bidder/db', '@upwork-bidder/ui'],
  outputFileTracingIncludes: {
    '/**/*': [
      '../../node_modules/.pnpm/@prisma+client*/**/*',
      '../../node_modules/.prisma/**/*',
    ],
    '/login': [
      '../../node_modules/.pnpm/@prisma+client*/**/*',
      '../../node_modules/.prisma/**/*',
    ],
    '/login/**/*': [
      '../../node_modules/.pnpm/@prisma+client*/**/*',
      '../../node_modules/.prisma/**/*',
    ],
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
          const copyPrismaEngines = () => {
            try {
              const dbPackageDir = path.resolve(__dirname, '../../packages/db');
              const dbRequire = createRequire(path.join(dbPackageDir, 'package.json'));
              const prismaClientPath = dbRequire.resolve('@prisma/client');
              const prismaEnginesDir = path.join(path.dirname(prismaClientPath), '../../.prisma/client');

              if (fs.existsSync(prismaEnginesDir)) {
                const targetDirs = [
                  path.resolve(__dirname, '.next/server/chunks'),
                  path.resolve(__dirname, '.next/server'),
                  path.resolve(__dirname, '.next/server/app'),
                  path.resolve(__dirname, '.next/server/app/login'),
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

                // Also copy to any other directory created under .next/server/app
                const appDir = path.resolve(__dirname, '.next/server/app');
                if (fs.existsSync(appDir)) {
                  const copyToSubdirs = (dir) => {
                    const entries = fs.readdirSync(dir, { withFileTypes: true });
                    for (const entry of entries) {
                      if (entry.isDirectory()) {
                        const subDir = path.join(dir, entry.name);
                        for (const file of files) {
                          if (file.endsWith('.node')) {
                            fs.copyFileSync(
                              path.join(prismaEnginesDir, file),
                              path.join(subDir, file)
                            );
                          }
                        }
                        copyToSubdirs(subDir);
                      }
                    }
                  };
                  copyToSubdirs(appDir);
                }
              }
            } catch (err) {
              console.warn('[Webpack] Could not copy Prisma engine binary:', err);
            }
          };

          compiler.hooks.afterEmit.tap('CopyPrismaEnginePlugin', copyPrismaEngines);
          compiler.hooks.done.tap('CopyPrismaEnginePluginDone', copyPrismaEngines);
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
