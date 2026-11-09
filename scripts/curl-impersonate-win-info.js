#!/usr/bin/env node
// binding.gyp calls this on Windows, where there is no curl-config to ask.
const fs = require('fs')
const path = require('path')

if (process.platform !== 'win32') {
  process.exit(0)
}

const moduleRoot = path.resolve(__dirname, '..')
const prefix =
  process.env.CURL_IMPERSONATE_PREFIX ||
  path.join(moduleRoot, 'curl-impersonate', 'install')

// The DLL is linked rather than the static library because static BoringSSL
// would clash with the OpenSSL symbols node.exe exports, and because the
// static library uses a different C runtime (/MT) than the addon (/MD).
const paths = {
  '--include-dir': path.join(prefix, 'include'),
  '--libs': path.join(prefix, 'lib', 'libcurl-impersonate_imp.lib'),
  '--dll': path.join(prefix, 'lib', 'libcurl-impersonate.dll'),
}

const target = paths[process.argv[2]]

if (!target) {
  console.error(`Expected one of: ${Object.keys(paths).join(', ')}`)
  process.exit(1)
}

if (!fs.existsSync(target)) {
  console.error('[node-libcurl] ERROR: curl-impersonate build not found!')
  console.error('[node-libcurl] Expected at:', target)
  console.error(
    '[node-libcurl] From a git clone, run: git submodule update --init --recursive',
  )
  console.error(
    '[node-libcurl] Otherwise set CURL_IMPERSONATE_PREFIX to an existing build.',
  )
  process.exit(1)
}

// Forward slashes, as gyp and the compiler both treat backslashes as escapes.
console.log(target.split(path.sep).join('/'))
