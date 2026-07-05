#!/usr/bin/env node
/**
 * Guards against running dev from the wrong folder or with polluted parent lockfiles.
 * Parent Coding_projects/package-lock.json causes Next.js to watch sibling projects.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cwd = process.cwd()

function portInUse(port) {
  try {
    const out = execSync(`lsof -ti:${port} 2>/dev/null || true`, { encoding: 'utf8' }).trim()
    return out.length > 0 ? out.split('\n').filter(Boolean) : []
  } catch {
    return []
  }
}

if (path.resolve(cwd) !== projectRoot) {
  console.error('\n❌ Wrong directory — npm run dev must run inside Dispatch_system only.\n')
  console.error(`   Expected: ${projectRoot}`)
  console.error(`   Got:      ${cwd}\n`)
  console.error('   Fix:')
  console.error(`   cd "${projectRoot}"`)
  console.error('   npm run dev\n')
  process.exit(1)
}

if (!fs.existsSync(path.join(projectRoot, 'node_modules', 'next', 'package.json'))) {
  console.error('\n❌ Dependencies not installed.\n')
  console.error(`   cd "${projectRoot}"`)
  console.error('   npm install\n')
  process.exit(1)
}

const parentLock = path.join(projectRoot, '..', 'package-lock.json')
const parentNodeModules = path.join(projectRoot, '..', 'node_modules')
const homeLock = path.join(process.env.HOME || '', 'package-lock.json')

if (fs.existsSync(parentLock) || fs.existsSync(parentNodeModules)) {
  console.warn('\n⚠️  Detected npm project files in the parent Coding_projects/ folder.')
  console.warn('   This often makes Next.js watch ALL sibling projects and freeze/crash.')
  console.warn('   Safe fix (when you are ready): remove these from Coding_projects/:')
  console.warn('     • package.json')
  console.warn('     • package-lock.json')
  console.warn('     • node_modules/\n')
}

if (fs.existsSync(homeLock)) {
  console.warn('⚠️  ~/package-lock.json exists — can confuse Next.js workspace detection.\n')
}

const busy = portInUse(3000)
if (busy.length > 0) {
  console.warn(`⚠️  Port 3000 is in use (pid: ${busy.join(', ')}).`)
  console.warn('   Run: npm run kill:dev\n')
}

const nextDevDir = path.join(projectRoot, '.next', 'dev')
const requiredDevFiles = [
  path.join(nextDevDir, 'routes-manifest.json'),
  path.join(nextDevDir, 'server', 'middleware-manifest.json'),
]
const nextDevPartial =
  fs.existsSync(nextDevDir) &&
  requiredDevFiles.some((f) => !fs.existsSync(f))

if (nextDevPartial) {
  console.error('\n❌ Corrupted .next cache (missing dev manifest files).')
  console.error('   Fix: npm run dev:clean\n')
  process.exit(1)
}

console.log(`✓ Dev environment OK — ${path.basename(projectRoot)}`)
