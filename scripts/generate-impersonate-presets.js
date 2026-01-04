const fs = require('fs')
const path = require('path')

const run = () => {
  const impersonateCPath = path.resolve(
    __dirname,
    '../curl-impersonate/curl-8_17_0/lib/impersonate.c',
  )
  const outputPath = path.resolve(
    __dirname,
    '../lib/generated/ImpersonatePresets.ts',
  )

  const content = fs.readFileSync(impersonateCPath, 'utf8')
  const regex = /\.target\s*=\s*"([^"]+)"/g
  const targets = []
  let match

  while ((match = regex.exec(content)) !== null) {
    targets.push(match[1])
  }

  const uniqueTargets = [...new Set(targets)]

  // Sort naturally
  uniqueTargets.sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
  )

  const lines = [
    '/**' +
      '\n * Copyright (c) Jonathan Cardoso Machado. All Rights Reserved.' +
      '\n *' +
      '\n * This source code is licensed under the MIT license found in the' +
      '\n * LICENSE file in the root directory of this source tree.' +
      '\n */',
    '// START AUTOMATICALLY GENERATED CODE - DO NOT EDIT',
    '/**',
    ' * Presets available for `CURLOPT_IMPERSONATE`',
    ' *',
    ' * @public',
    ' */',
    'export const Impersonate = {',
  ]

  uniqueTargets.forEach((target) => {
    // Basic camel case conversion: chrome100 -> Chrome100, safari_ios_15_5 -> SafariIos155
    const key = target
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('')
    lines.push(`  ${key}: '${target}',`)
  })

  lines.push('} as const', '')
  lines.push('/**')
  lines.push(' * @public')
  lines.push(' */')
  lines.push(
    'export type Impersonate = typeof Impersonate[keyof typeof Impersonate]',
  )
  lines.push('')
  lines.push('// END AUTOMATICALLY GENERATED CODE - DO NOT EDIT')
  lines.push('')

  fs.writeFileSync(outputPath, lines.join('\n'))
  console.log(`Generated ${uniqueTargets.length} presets to ${outputPath}`)
}

run()
