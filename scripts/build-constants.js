const fs = require('fs')
const path = require('path')
const { inspect } = require('util')
const { execSync } = require('child_process')

const { optionKindMap, optionKindValueMap } = require('./data/options')

const {
  convertCurlConstantToCamelCase,
} = require('./utils/convertCurlConstantToCamelCase')
const {
  createConstantsFile,
  getDescriptionCommentForOption,
} = require('./utils/createConstantsFile')
const { createSetOptOverloads } = require('./utils/createSetOptOverloads')
const { curlOptionsBlacklist } = require('./utils/curlOptionsBlacklist')
const { multiOptionsBlacklist } = require('./utils/multiOptionsBlacklist')
const { retrieveConstantList } = require('./utils/retrieveConstantList')

const run = async () => {
  const curlOptionsFilePath = path.resolve(
    __dirname,
    '../lib/generated/CurlOption.ts',
  )

  const curlInfoFilePath = path.resolve(
    __dirname,
    '../lib/generated/CurlInfo.ts',
  )

  const multiOptionFilePath = path.resolve(
    __dirname,
    '../lib/generated/MultiOption.ts',
  )

  const allowedCurlOptions = await retrieveConstantList({
    url: 'https://curl.se/libcurl/c/curl_easy_setopt.html',
    constantPrefix: 'CURLOPT_',
    blacklist: curlOptionsBlacklist,
  })

  // Manually add curl-impersonate options
  const impersonateOptions = [
    {
      name: 'IMPERSONATE',
      description:
        'curl-impersonate: The master option for setting an impersonate target',
    },
    {
      name: 'SSL_SIG_HASH_ALGS',
      description: 'curl-impersonate: A list of TLS signature hash algorithms',
    },
    {
      name: 'SSL_CERT_COMPRESSION',
      description:
        'curl-impersonate: Comma-separated list of certificate compression algorithms',
    },
    {
      name: 'HTTP2_PSEUDO_HEADERS_ORDER',
      description:
        'curl-impersonate: Set the order of the HTTP/2 pseudo headers',
    },
    {
      name: 'HTTP2_SETTINGS',
      description: 'curl-impersonate: HTTP2 settings frame keys and values',
    },
    {
      name: 'HTTP2_STREAMS',
      description:
        'curl-impersonate: Set the initial streams settings for http2',
    },
    {
      name: 'TLS_EXTENSION_ORDER',
      description: 'curl-impersonate: set tls extension order',
    },
    {
      name: 'TLS_DELEGATED_CREDENTIALS',
      description: 'curl-impersonate: firefox delegated credentials',
    },
    {
      name: 'SSL_ENABLE_ALPS',
      description: 'curl-impersonate: Whether to enable ALPS in TLS or not',
    },
    {
      name: 'SSL_ENABLE_TICKET',
      description: 'Enable/disable TLS session ticket extension',
    },
    {
      name: 'SSL_PERMUTE_EXTENSIONS',
      description:
        'curl-impersonate: Whether to enable Boringssl permute extensions',
    },
    {
      name: 'HTTP2_WINDOW_UPDATE',
      description: 'curl-impersonate: HTTP2 initial window update',
    },
    {
      name: 'TLS_GREASE',
      description: 'curl-impersonate: enable tls grease',
    },
    {
      name: 'STREAM_EXCLUSIVE',
      description: 'curl-impersonate: Set stream exclusiveness',
    },
    {
      name: 'TLS_KEY_USAGE_NO_CHECK',
      description: 'curl-impersonate: enable tls key usage check',
    },
    {
      name: 'TLS_SIGNED_CERT_TIMESTAMPS',
      description: 'curl-impersonate: enable tls signed cert stamps',
    },
    {
      name: 'TLS_STATUS_REQUEST',
      description: 'curl-impersonate: enable tls status request',
    },
    {
      name: 'TLS_RECORD_SIZE_LIMIT',
      description: 'curl-impersonate: firefox record size limit',
    },
    {
      name: 'TLS_KEY_SHARES_LIMIT',
      description: 'curl-impersonate: firefox key_shares_limit',
    },
    {
      name: 'TLS_USE_NEW_ALPS_CODEPOINT',
      description: 'curl-impersonate: Use the new ALPS code point',
    },
    {
      name: 'HTTP2_NO_PRIORITY',
      description:
        'curl-impersonate: Do not set the priority bit in http2 header frame',
    },
    {
      name: 'PROXY_CREDENTIAL_NO_REUSE',
      description:
        'curl-impersonate: Do not reuse TLS sessions or connections from different proxy credentials',
    },
    {
      name: 'HTTPBASEHEADER',
      description:
        'curl-impersonate: A list of headers used by the impersonated browser',
    },
  ]

  allowedCurlOptions.push(
    ...impersonateOptions.map((option) => ({
      constantOriginal: `CURLOPT_${option.name}`,
      constantName: option.name,
      constantNameCamelCase: convertCurlConstantToCamelCase(option.name),
      description: option.description,
    })),
  )

  await createConstantsFile({
    constants: allowedCurlOptions,
    variableName: 'CurlOption',
    filePath: curlOptionsFilePath,
    shouldGenerateCamelCaseMap: true,
    extraHeaderText: `
      import { CurlChunk } from '../enum/CurlChunk'
      import { CurlFnMatchFunc } from '../enum/CurlFnMatchFunc'
      import { CurlFtpMethod } from '../enum/CurlFtpMethod'
      import { CurlFtpSsl } from '../enum/CurlFtpSsl'
      import { CurlGssApi } from '../enum/CurlGssApi'
      import { CurlHeader } from '../enum/CurlHeader'
      import { CurlHsts, CurlHstsCacheCount, CurlHstsCacheEntry } from '../enum/CurlHsts'
      import { CurlHttpVersion } from '../enum/CurlHttpVersion'
      import { CurlInfoDebug } from '../enum/CurlInfoDebug'
      import { CurlIpResolve } from '../enum/CurlIpResolve'
      import { CurlMimeOpt } from '../enum/CurlMimeOpt'
      import { CurlNetrc } from '../enum/CurlNetrc'
      import { CurlPreReqFunc } from '../enum/CurlPreReqFunc'
      import { CurlProgressFunc } from '../enum/CurlProgressFunc'
      import { CurlProtocol } from '../enum/CurlProtocol'
      import { CurlProxy } from '../enum/CurlProxy'
      import { CurlRtspRequest } from '../enum/CurlRtspRequest'
      import { CurlSshAuth } from '../enum/CurlSshAuth'
      import { CurlSshKeyType, CurlSshKeyMatch } from '../enum/CurlSshKey'
      import { CurlSslOpt } from '../enum/CurlSslOpt'
      import { CurlSslVersion } from '../enum/CurlSslVersion'
      import { CurlTimeCond } from '../enum/CurlTimeCond'
      import { CurlUseSsl } from '../enum/CurlUseSsl'
      import { CurlWsOptions } from '../enum/CurlWs'
      import { Easy } from "../Easy"
      import { Share } from "../Share"
      import { CurlMime } from "../CurlMime"
    `,
  })

  const allowedCurlInfos = await retrieveConstantList({
    url: 'https://curl.se/libcurl/c/curl_easy_getinfo.html',
    constantPrefix: 'CURLINFO_',
    blacklist: [
      // time constants at the bottom
      'NAMELOOKUP',
      'CONNECT',
      'APPCONNECT',
      'PRETRANSFER',
      'STARTTRANSFER',
      'TOTAL',
      'REDIRECT',
    ],
  })
  await createConstantsFile({
    constants: allowedCurlInfos,
    variableName: 'CurlInfo',
    filePath: curlInfoFilePath,
  })

  const allowedMultiOptions = await retrieveConstantList({
    url: 'https://curl.se/libcurl/c/curl_multi_setopt.html',
    constantPrefix: 'CURLMOPT_',
    blacklist: multiOptionsBlacklist,
  })
  await createConstantsFile({
    constants: allowedMultiOptions,
    variableName: 'MultiOption',
    filePath: multiOptionFilePath,
  })

  // add extra types to CurlOption
  const union = (arr) => arr.map((i) => inspect(i)).join(' | ')

  let optionsValueTypeData = [
    'import { FileInfo, HttpPostField } from "../types"',
    `export type DataCallbackOptions = ${union(optionKindMap.dataCallback)}`,
    `export type ProgressCallbackOptions = ${union(
      optionKindMap.progressCallback,
    )}`,
    `export type StringListOptions = ${union(optionKindMap.stringList)}`,
    `export type BlobOptions = ${union(optionKindMap.blob)}`,
    `export type SpecificOptions = DataCallbackOptions | ProgressCallbackOptions | StringListOptions | BlobOptions | ${union(
      optionKindMap.other,
    )}`,
  ]

  // Now we must create the type for the curl.<http-verb> options param
  optionsValueTypeData = [
    ...optionsValueTypeData,
    `
    /**
     * @public
     */
    export type CurlOptionValueType = {`,
  ]

  for (const option of allowedCurlOptions) {
    const optionDescription = getDescriptionCommentForOption(option)

    const optionValueType =
      Object.entries(optionKindMap).reduce((acc, [kind, kindOptions]) => {
        if (acc) return acc

        return (
          kindOptions.includes(option.constantName) &&
          (optionKindValueMap[kind] || optionKindValueMap[option.constantName])
        )
      }, null) || optionKindValueMap._

    optionsValueTypeData = [
      ...optionsValueTypeData,
      `${optionDescription}${option.constantName}?: ${optionValueType} | null`,
      `${optionDescription}${option.constantNameCamelCase}?: ${optionValueType} | null`,
    ]
  }

  optionsValueTypeData = [...optionsValueTypeData, '}']

  fs.writeFileSync(curlOptionsFilePath, optionsValueTypeData.join('\n'), {
    flag: 'a+',
  })

  const easyBindingFilePath = path.resolve(__dirname, '../lib/Easy.ts')
  const curlClassFilePath = path.resolve(__dirname, '../lib/Curl.ts')

  createSetOptOverloads(easyBindingFilePath)
  createSetOptOverloads(curlClassFilePath, 'this')

  execSync(
    `pnpm prettier ${curlOptionsFilePath} ${curlInfoFilePath} ${multiOptionFilePath} ${easyBindingFilePath} ${curlClassFilePath}`,
  )
}

run()
