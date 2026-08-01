#!/usr/bin/env node
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const moduleRoot = path.resolve(__dirname, '..')
const impersonateDir = path.join(moduleRoot, 'curl-impersonate')
const installDir = path.join(impersonateDir, 'install')
const configBin = path.join(installDir, 'bin', 'curl-impersonate-config')
const libFile = path.join(installDir, 'lib', 'libcurl-impersonate.a')

function isBuilt() {
  return fs.existsSync(configBin) && fs.existsSync(libFile)
}

function hasSubmodule() {
  return fs.existsSync(path.join(impersonateDir, 'configure'))
}

async function main() {
  // Windows uses vcpkg (keep existing behavior for now)
  if (process.platform === 'win32') {
    console.log('[node-libcurl] Windows detected, running vcpkg setup...')
    require('./vcpkg-setup')
    return
  }

  // Unix: build curl-impersonate
  console.log('[node-libcurl] Checking curl-impersonate status...')

  if (isBuilt()) {
    console.log('[node-libcurl] curl-impersonate already built, skipping.')
    return
  }

  if (!hasSubmodule()) {
    console.error('[node-libcurl] ERROR: curl-impersonate submodule not found!')
    console.error(
      '[node-libcurl] Please run: git submodule update --init --recursive',
    )
    process.exit(1)
  }

  console.log(
    '[node-libcurl] Building curl-impersonate (this may take a while)...',
  )

  try {
    // We need to make sure we are running the build script with the correct cwd
    execSync('bash scripts/curl-impersonate-build.sh', {
      cwd: moduleRoot,
      stdio: 'inherit',
      env: { ...process.env },
    })
    console.log('[node-libcurl] curl-impersonate build complete.')
  } catch (error) {
    console.error('[node-libcurl] ERROR: curl-impersonate build failed!')
    console.error(error.message)
    process.exit(1)
  }
}

main()
