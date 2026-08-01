/**
 * Copyright (c) Jonathan Cardoso Machado. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import net from 'node:net'
import fs from 'node:fs'
import path from 'node:path'

import { describe, it, expect } from 'vitest'

import { Curl, Impersonate, impersonate } from '../../lib'

/**
 * These tests assert that the TLS ClientHello produced by a given impersonate
 * target matches the browser signature that curl-impersonate itself ships in
 * `tests/signatures`. Using those files as the source of truth means the
 * expectations follow the submodule on every bump instead of drifting from it.
 *
 * The ClientHello is captured off a plain TCP socket: curl is pointed at a
 * local `net` server which reads the first TLS record and then drops the
 * connection. The handshake never completes, which is fine - the ClientHello
 * is the only thing under test, and it keeps the test free of network access.
 */

const SIGNATURES_DIR = path.resolve(
  __dirname,
  '../../curl-impersonate/tests/signatures',
)

// GREASE values are randomised per connection (RFC 8701) and are filtered out
// of both the capture and the signature before comparing.
const GREASE = new Set([
  0x0a0a, 0x1a1a, 0x2a2a, 0x3a3a, 0x4a4a, 0x5a5a, 0x6a6a, 0x7a7a, 0x8a8a,
  0x9a9a, 0xaaaa, 0xbaba, 0xcaca, 0xdada, 0xeaea, 0xfafa,
])

// TLS extension numbers asserted on below.
const EXT_EC_POINT_FORMATS = 11
const EXT_COMPRESS_CERTIFICATE = 27
const EXT_RECORD_SIZE_LIMIT = 28
const EXT_DELEGATED_CREDENTIALS = 34
const EXT_APPLICATION_SETTINGS = 17613
const EXT_ENCRYPTED_CLIENT_HELLO = 65037

interface ClientHello {
  ciphers: number[]
  extensions: number[]
}

/**
 * Minimal ClientHello parser - only walks far enough to read the cipher suite
 * list and the extension types.
 */
function parseClientHello(buf: Buffer): ClientHello {
  let p = 5 // TLS record header
  p += 4 // handshake type + length
  p += 2 // client_version
  p += 32 // random
  p += 1 + buf[p] // session_id

  const ciphersLength = buf.readUInt16BE(p)
  p += 2
  const ciphers: number[] = []
  for (let i = 0; i < ciphersLength; i += 2) {
    ciphers.push(buf.readUInt16BE(p + i))
  }
  p += ciphersLength

  p += 1 + buf[p] // compression methods

  const extensionsLength = buf.readUInt16BE(p)
  p += 2
  const extensionsEnd = p + extensionsLength
  const extensions: number[] = []
  while (p + 4 <= extensionsEnd) {
    extensions.push(buf.readUInt16BE(p))
    p += 4 + buf.readUInt16BE(p + 2)
  }

  const withoutGrease = (values: number[]) =>
    values.filter((value) => !GREASE.has(value))

  return {
    ciphers: withoutGrease(ciphers),
    extensions: withoutGrease(extensions),
  }
}

/**
 * Points curl at a local TCP server and returns the ClientHello it sent.
 */
function captureClientHello(target: Impersonate | null): Promise<ClientHello> {
  return new Promise((resolve, reject) => {
    const server = net.createServer((socket) => {
      const chunks: Buffer[] = []
      let received = 0
      // The record is small enough to arrive in one segment on loopback, but
      // accumulate until it is complete rather than relying on that.
      let recordLength = Infinity

      socket.on('data', (chunk) => {
        chunks.push(chunk)
        received += chunk.length
        const buf = Buffer.concat(chunks)
        if (recordLength === Infinity && buf.length >= 5) {
          recordLength = buf.readUInt16BE(3) + 5
        }
        if (received < recordLength) return

        socket.destroy()
        server.close()
        try {
          resolve(parseClientHello(buf))
        } catch (error) {
          reject(error)
        }
      })
      socket.on('error', () => socket.destroy())
    })

    server.on('error', reject)

    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address === null || typeof address === 'string') {
        server.close()
        reject(new Error('failed to bind capture server'))
        return
      }

      const curl = new Curl()
      curl.setOpt('URL', `https://127.0.0.1:${address.port}/`)
      curl.setOpt('TIMEOUT', 10)
      if (target !== null) impersonate(curl, target)

      // The handshake is expected to fail - the ClientHello has already been
      // captured by the time the socket is dropped.
      curl.on('end', () => curl.close())
      curl.on('error', () => curl.close())
      curl.perform()
    })
  })
}

/**
 * Reads the `ciphersuites` list out of a curl-impersonate signature file.
 * Deliberately hand-rolled: the block is a flat list of integers, and this
 * avoids pulling a YAML parser in just for the test suite.
 */
function readSignatureCiphersuites(filePrefix: string): number[] {
  const file = fs
    .readdirSync(SIGNATURES_DIR)
    .find((name) => name.startsWith(filePrefix))

  if (file === undefined) {
    throw new Error(`no signature file starting with "${filePrefix}"`)
  }

  const lines = fs
    .readFileSync(path.join(SIGNATURES_DIR, file), 'utf8')
    .split('\n')
  const start = lines.findIndex((line) => line.trim() === 'ciphersuites:')

  if (start === -1) {
    throw new Error(`no ciphersuites block in ${file}`)
  }

  const ciphers: number[] = []
  for (const line of lines.slice(start + 1)) {
    const match = /^\s*-\s*(\S+)\s*$/.exec(line)
    if (match === null) break // end of the list
    // GREASE is randomised per connection and filtered from the capture too.
    if (match[1] === 'GREASE') continue
    ciphers.push(Number(match[1]))
  }

  return ciphers
}

// The submodule is not checked out in every environment; skip rather than fail.
const hasSignatures = fs.existsSync(SIGNATURES_DIR)

describe.skipIf(!hasSignatures)('Impersonate', () => {
  it('should send the Chrome 142 cipher suites from the curl-impersonate signature', async () => {
    const hello = await captureClientHello(Impersonate.Chrome142)

    expect(hello.ciphers).toEqual(readSignatureCiphersuites('chrome_142.'))
  })

  it('should send the Firefox 133 cipher suites from the curl-impersonate signature', async () => {
    const hello = await captureClientHello(Impersonate.Firefox133)

    expect(hello.ciphers).toEqual(readSignatureCiphersuites('firefox_133.'))
  })

  it('should send Chrome specific TLS extensions when impersonating Chrome', async () => {
    const hello = await captureClientHello(Impersonate.Chrome142)

    expect(hello.extensions).toContain(EXT_APPLICATION_SETTINGS)
    expect(hello.extensions).toContain(EXT_COMPRESS_CERTIFICATE)
    expect(hello.extensions).toContain(EXT_ENCRYPTED_CLIENT_HELLO)
  })

  it('should send Firefox specific TLS extensions when impersonating Firefox', async () => {
    const hello = await captureClientHello(Impersonate.Firefox133)

    expect(hello.extensions).toContain(EXT_DELEGATED_CREDENTIALS)
    expect(hello.extensions).toContain(EXT_RECORD_SIZE_LIMIT)
    // ALPS is Chromium only.
    expect(hello.extensions).not.toContain(EXT_APPLICATION_SETTINGS)
  })

  it('should change the ClientHello compared to a handle without a target', async () => {
    const [plain, chrome] = await Promise.all([
      captureClientHello(null),
      captureClientHello(Impersonate.Chrome142),
    ])

    expect(plain.ciphers).not.toEqual(chrome.ciphers)
    // Only curl offers these by default out of the two.
    expect(plain.extensions).toContain(EXT_EC_POINT_FORMATS)
    expect(plain.extensions).not.toContain(EXT_APPLICATION_SETTINGS)
  })

  it('should permute the extension order between connections when impersonating Chrome', async () => {
    const hellos = await Promise.all([
      captureClientHello(Impersonate.Chrome142),
      captureClientHello(Impersonate.Chrome142),
      captureClientHello(Impersonate.Chrome142),
    ])

    const orders = hellos.map((hello) => hello.extensions.join(','))
    const sets = hellos.map((hello) => [...hello.extensions].sort().join(','))

    // Same extensions every time...
    expect(new Set(sets).size).toBe(1)
    // ...but Chrome shuffles them, so at least one run must differ in order.
    expect(new Set(orders).size).toBeGreaterThan(1)
    // Cipher order is not permuted.
    expect(hellos[1].ciphers).toEqual(hellos[0].ciphers)
  })
})
