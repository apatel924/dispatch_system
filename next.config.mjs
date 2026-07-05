import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** Absolute project root — never infer from parent lockfiles */
const projectRoot = path.dirname(fileURLToPath(import.meta.url))
const parentDir = path.join(projectRoot, '..')

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['firebase-admin'],
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingRoot: projectRoot,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        aggregateTimeout: 400,
        ignored: [
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
          // Ignore sibling projects under Coding_projects/ (prevents watcher storms)
          path.join(parentDir, 'node_modules/**'),
          path.join(parentDir, '*/node_modules/**'),
          path.join(parentDir, '*/.next/**'),
          path.join(parentDir, '*/dist/**'),
        ],
      }
    }
    return config
  },
}

export default nextConfig
