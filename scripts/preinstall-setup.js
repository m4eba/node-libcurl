#!/usr/bin/env node
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const moduleRoot = path.resolve(__dirname, '..')
const impersonateDir = path.join(moduleRoot, 'curl-impersonate')
const installDir = path.join(impersonateDir, 'install')
const isWindows = process.platform === 'win32'
const builtFiles = isWindows
  ? ['lib/libcurl-impersonate.dll', 'lib/libcurl-impersonate_imp.lib']
  : ['bin/curl-impersonate-config', 'lib/libcurl-impersonate.a']

function isBuilt() {
  return builtFiles.every((file) => fs.existsSync(path.join(installDir, file)))
}

function hasSubmodule() {
  return fs.existsSync(path.join(impersonateDir, 'CMakeLists.txt'))
}

async function main() {
  console.log('[node-libcurl] Checking curl-impersonate status...')

  // CI builds curl-impersonate once up front and points the addon at it
  // through these variables. Building a second copy in the module folder would
  // just repeat ~20 minutes of BoringSSL and curl compilation for nothing.
  const existingBuild =
    process.env.npm_config_curl_config_bin ||
    process.env.CURL_IMPERSONATE_PREFIX
  if (existingBuild) {
    console.log(
      '[node-libcurl] Using the existing curl-impersonate build:',
      existingBuild,
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
  // and node-pre-gyp falls back to building, scripts/curl-config.js (or
  // scripts/curl-impersonate-win-info.js on Windows) reports the missing
  // curl-impersonate with instructions.
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
    const buildCommand = isWindows
      ? `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\\ci\\windows\\build-curl-impersonate.ps1 -Prefix "${installDir}"`
      : 'bash scripts/curl-impersonate-build.sh'
    execSync(buildCommand, {
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
