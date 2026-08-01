#!/usr/bin/env node
/**
 * Copyright (c) Jonathan Cardoso Machado. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// very crude CLI just to allow us to print a better error message when curl-config is not present
// but hey, there is no need for it to be more complex than this. :)

const { exec } = require('child_process')

const { argv } = process

if (!argv[2]) {
  console.error('Missing argument to curl-config')
  process.exit(1)
}

// Determine which curl-config to use
const arg = argv[2].trim()
let curlConfigCmd = 'curl-config'

if (process.platform !== 'win32') {
  // On Unix, always use curl-impersonate-config
  const path = require('path')
  const fs = require('fs')
  const moduleRoot = path.resolve(__dirname, '..')
  const impersonateConfig = path.join(
    moduleRoot,
    'curl-impersonate',
    'install',
    'bin',
    'curl-impersonate-config',
  )

  if (fs.existsSync(impersonateConfig)) {
    curlConfigCmd = impersonateConfig
  } else {
    // binding.gyp calls this script, so preinstall has already run by now -
    // a missing config binary means the build did not produce one.
    console.error('[node-libcurl] ERROR: curl-impersonate-config not found!')
    console.error('[node-libcurl] Expected at:', impersonateConfig)
    console.error('[node-libcurl] Run: npm run build:impersonate:deps')
    process.exit(1)
  }
}

exec(`"${curlConfigCmd}" ${arg}`, function (error, stdout, stderr) {
  if (error != null) {
    console.error(
      `Could not run ${curlConfigCmd}, please make sure curl-impersonate is built.`,
    )
    console.error('Output: ' + stderr)
    process.exit(1)
  }

  console.log(stdout)
  process.exit(0)
})
