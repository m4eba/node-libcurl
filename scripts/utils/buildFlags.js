// Proudly copied from https://github.com/nodegit/nodegit/blob/977251b4aae52eef75cf4f188b4d5a63ba98fa7b/utils/buildFlags.js
const fs = require('fs')
const path = require('path')

let isGitRepo

try {
  fs.statSync(path.resolve(__dirname, '..', '..', '.git'))
  isGitRepo = true
} catch {
  isGitRepo = false
}

const curlImpersonateInstallDir = path.join(
  __dirname,
  '..',
  '..',
  'curl-impersonate',
  'install',
)
const curlImpersonateConfigBin = path.join(
  curlImpersonateInstallDir,
  'bin',
  'curl-impersonate-config',
)

module.exports = {
  debugBuild: !!process.env.BUILD_DEBUG,
  isElectron: process.env.npm_config_runtime === 'electron',
  isGitRepo,
  isNwjs: process.env.npm_config_runtime === 'node-webkit',
  mustBuild: !!(isGitRepo || process.env.BUILD_DEBUG || process.env.BUILD_ONLY),
  skipCleanup: process.env.NODE_LIBCURL_POSTINSTALL_SKIP_CLEANUP === 'true',
  curlImpersonateInstallDir,
  curlImpersonateConfigBin,
  isCurlImpersonateBuilt:
    fs.existsSync(curlImpersonateConfigBin) &&
    fs.existsSync(
      path.join(curlImpersonateInstallDir, 'lib', 'libcurl-impersonate.a'),
    ),
}
