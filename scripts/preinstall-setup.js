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

  // CI builds curl-impersonate once up front and points the addon at it
  // through this variable. Building a second copy in the module folder would
  // just repeat ~20 minutes of BoringSSL and curl compilation for nothing.
  if (process.env.npm_config_curl_config_bin) {
    console.log(
      '[node-libcurl] curl_config_bin provided, using the existing build:',
      process.env.npm_config_curl_config_bin,
    )
    return
  }

  if (isBuilt()) {
    console.log('[node-libcurl] curl-impersonate already built, skipping.')
    return
  }

  // The published tarball does not carry the submodule, so this is the normal
  // path for an npm install: there is nothing to build here and node-pre-gyp
  // downloads a prebuilt binary in the install step that follows. Failing here
  // would make the package impossible to install at all. If no prebuilt matches
  // and node-pre-gyp falls back to building, scripts/curl-config.js reports the
  // missing curl-impersonate with instructions.
  if (!hasSubmodule()) {
    console.log(
      '[node-libcurl] No curl-impersonate sources here, expecting a prebuilt binary.',
    )
    console.log(
      '[node-libcurl] Building from a git clone? Run: git submodule update --init --recursive',
    )
    return
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
