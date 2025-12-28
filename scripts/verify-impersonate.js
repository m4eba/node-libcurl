const { Curl } = require('../dist')

console.log('Curl Version Info:', Curl.getVersionInfo())
console.log('Curl Version:', Curl.getVersion())

const version = Curl.getVersion()
if (version.toLowerCase().includes('impersonate')) {
  console.log('SUCCESS: curl-impersonate detected in version string.')
} else {
  console.log(
    'INFO: curl-impersonate not found in version string, checking detailed info.',
  )
  // curl-impersonate might not change the version string directly in all builds,
  // but the ssl version might indicate boringSSL which is typical for it.
  const info = Curl.getVersionInfo()
  console.log('SSL Version:', info.sslVersion)
  if (info.sslVersion && info.sslVersion.toLowerCase().includes('boringssl')) {
    console.log('SUCCESS: BoringSSL detected (used by curl-impersonate).')
  } else {
    console.log('WARNING: Neither curl-impersonate nor BoringSSL detected.')
    // This fails if the build didn't actually pick up the right library despite ldd saying so,
    // (which is unlikely) or if the version strings are conservative.
  }
}

console.log('\n--- Version Comparison ---')
const curlInfo = Curl.getVersionInfo()

const nodeBrotli = process.versions.brotli
const curlBrotli = curlInfo.brotliVersion

const nodeZlib = process.versions.zlib
const curlZlib = curlInfo.libzVersion

console.log(`Node.js Brotli: ${nodeBrotli}`)
console.log(`Curl Brotli:    ${curlBrotli}`)
if (nodeBrotli && curlBrotli && curlBrotli.includes(nodeBrotli)) {
  console.log(
    'SUCCESS: Brotli versions line up (Node.js version found in Curl string).',
  )
} else {
  console.log('NOTICE: Brotli versions might differ or formatting varies.')
}

console.log(`Node.js Zlib:   ${nodeZlib}`)
console.log(`Curl Zlib:      ${curlZlib}`)
if (nodeZlib && curlZlib && curlZlib.includes(nodeZlib)) {
  console.log(
    'SUCCESS: Zlib versions line up (Node.js version found in Curl string).',
  )
} else {
  // node version is '1.3.0.1-motley-780819f', curl might be '1.3.0.1-motley'
  // Let's do a looser check
  if (
    nodeZlib &&
    curlZlib &&
    (nodeZlib.startsWith(curlZlib) || curlZlib.startsWith(nodeZlib))
  ) {
    console.log('SUCCESS: Zlib versions appear compatible (prefix match).')
  } else {
    console.log('NOTICE: Zlib versions might differ or formatting varies.')
  }
}
