# @m4eba/node-libcurl-impersonate<!-- omit in toc -->

[![NPM version][npm-image]][npm-url]
[![license][license-image]][license-url]

[npm-image]:https://img.shields.io/npm/v/@m4eba/node-libcurl-impersonate.svg?style=flat-square
[npm-url]:https://www.npmjs.org/package/@m4eba/node-libcurl-impersonate
[license-image]:https://img.shields.io/npm/l/@m4eba/node-libcurl-impersonate?style=flat-square
[license-url]:https://raw.githubusercontent.com/m4eba/node-libcurl/develop/LICENSE

> Node.js bindings for [curl-impersonate](https://github.com/lexiforest/curl-impersonate) — libcurl with browser TLS/JA3 and HTTP/2 fingerprint impersonation.

A fork of [node-libcurl](https://github.com/JCMais/node-libcurl) that links against
`libcurl-impersonate` instead of a stock libcurl. Everything node-libcurl does still
works — the `Curl`, `Easy`, `Multi` and `curly` APIs are unchanged — with the addition
that requests can be made to look like a real browser at the TLS and HTTP/2 layers.

Why this exists: it is currently the only native Node binding that does **impersonated
WebSockets**. `node-libcurl-ja3` has no WebSocket support, and the CLI wrappers cannot
stream frames.

```js
const { Curl, Impersonate, impersonate } = require('@m4eba/node-libcurl-impersonate')

const curl = new Curl()
curl.setOpt('URL', 'https://example.com')
impersonate(curl, Impersonate.Chrome142)
curl.perform()
```

**Platform support**: Linux (glibc and musl, x64 and arm64) and macOS (x64 and arm64),
with prebuilt binaries for Node 22, 24, 25 and 26. **Windows is not supported yet** — see
[Impersonation](#impersonation).

- [Impersonation](#impersonation)
  - [Choosing a target](#choosing-a-target)
  - [Impersonated WebSockets](#impersonated-websockets)
  - [Differences from stock node-libcurl](#differences-from-stock-node-libcurl)
- [Quick Start](#quick-start)
  - [Install](#install)
  - [Simple Request - Async / Await using curly](#simple-request---async--await-using-curly)
  - [Simple Request - Using Curl class](#simple-request---using-curl-class)
  - [Setting HTTP headers](#setting-http-headers)
  - [Form Submission (Content-Type: application/x-www-form-urlencoded)](#form-submission-content-type-applicationx-www-form-urlencoded)
  - [MultiPart Upload / HttpPost libcurl Option (Content-Type: multipart/form-data)](#multipart-upload--httppost-libcurl-option-content-type-multipartform-data)
  - [Binary Data](#binary-data)
- [SSL](#ssl)
- [API](#api)
- [Special Notes](#special-notes)
  - [`READFUNCTION` option](#readfunction-option)
- [Common Issues](#common-issues)
- [Benchmarks](#benchmarks)
- [Security](#security)
- [Bundled libcurl](#bundled-libcurl)
- [Detailed Installation](#detailed-installation)
  - [Important Notes on Prebuilt Binaries / Direct Installation](#important-notes-on-prebuilt-binaries--direct-installation)
    - [Missing Packages](#missing-packages)
  - [Electron / NW.js](#electron--nwjs)
    - [NW.js (aka node-webkit)](#nwjs-aka-node-webkit)
    - [Electron (aka atom-shell)](#electron-aka-atom-shell)
  - [Building on Linux](#building-on-linux)
  - [Building on macOS](#building-on-macos)
    - [Xcode \>= 10 | macOS \>= Mojave](#xcode--10--macos--mojave)
  - [Building on Windows](#building-on-windows)
    - [Note on outdated node-gyp version](#note-on-outdated-node-gyp-version)
- [Getting Help](#getting-help)
- [Contributing](#contributing)
- [Credits](#credits)

## Impersonation

### Choosing a target

`impersonate()` sets the target on a `Curl` or `Easy` handle. Everything else — the
cipher list, TLS extension order, HTTP/2 SETTINGS and the browser headers — is applied
by libcurl-impersonate itself.

```js
const { Curl, Impersonate, impersonate } = require('@m4eba/node-libcurl-impersonate')

const curl = new Curl()
curl.setOpt('URL', 'https://tls.peet.ws/api/all')
impersonate(curl, Impersonate.Chrome142)
```

`Impersonate` lists every target compiled into the bundled curl-impersonate — Chrome,
Edge, Firefox, Safari and Tor builds. The individual options (`IMPERSONATE`,
`SSL_SIG_HASH_ALGS`, `SSL_CERT_COMPRESSION`, `HTTP2_SETTINGS`, `TLS_GREASE`,
`SSL_PERMUTE_EXTENSIONS`, …) are also available through `setOpt` if you want to build a
fingerprint by hand.

> **Always set a target.** Without one you get curl's TLS fingerprint combined with
> Chrome's HTTP/2 settings, because curl-impersonate patches those defaults into libcurl.
> That mismatched combination is easier to flag than plain curl.

### Impersonated WebSockets

WebSockets go through libcurl's `CONNECT_ONLY` mode and are impersonated on the
handshake, same as any other request:

```js
const { Easy, CurlWs, Impersonate, impersonate } = require('@m4eba/node-libcurl-impersonate')

const easy = new Easy()
easy.setOpt('URL', 'wss://echo.websocket.org')
easy.setOpt('CONNECT_ONLY', 2)
impersonate(easy, Impersonate.Chrome142)
easy.perform()

easy.wsSend(Buffer.from('hello'), CurlWs.Text)

const buffer = Buffer.alloc(4096)
const result = easy.wsRecv(buffer)
console.log(buffer.subarray(0, result.bytesReceived).toString())

easy.wsSend(Buffer.alloc(0), CurlWs.Close)
easy.close()
```

The ClientHello matches the browser here too, with ALPN correctly narrowed to
`http/1.1` — browsers do not offer h2 for WebSocket connections.

### Differences from stock node-libcurl

- **c-ares is not used.** curl-impersonate enables it by default, but it fails to resolve
  when the host has several DNS servers configured
  ([JCMais/node-libcurl#280](https://github.com/JCMais/node-libcurl/issues/280)), so this
  fork builds with curl's threaded resolver instead. `CURLOPT_DNS_SERVERS` and the other
  c-ares specific options are therefore unavailable.
- **Windows is not supported yet.** The prebuilt binaries cover Linux and macOS only.
- The bundled curl version is reported at runtime by `Curl.getVersion()`, and pinned by
  the `curl-impersonate` submodule rather than by this package's version number.

## Quick Start

> **Note**:
> - This library cannot be used in a browser, it depends on native code.

### Install

```shell
npm i @m4eba/node-libcurl-impersonate --save
```
or
```shell
pnpm i @m4eba/node-libcurl-impersonate --save
```
or
```shell
yarn add @m4eba/node-libcurl-impersonate
```
### Simple Request - Async / Await using curly
> this API is experimental and is subject to changes without a major version bump

```javascript
const { curly } = require('@m4eba/node-libcurl-impersonate');

const { statusCode, data, headers } = await curly.get('https://www.google.com')
```

Any option can be passed using their `FULLNAME` or a `lowerPascalCase` format:
```javascript
const querystring = require('querystring');
const { curly } = require('@m4eba/node-libcurl-impersonate');

const { statusCode, data, headers } = await curly.post('https://httpbin.com/post', {
  postFields: querystring.stringify({
    field: 'value',
  }),
  // can use `postFields` or `POSTFIELDS`
})
```

JSON POST example:
```javascript
const { curly } = require('@m4eba/node-libcurl-impersonate')
const { data } = await curly.post('https://httpbin.com/post', {
  postFields: JSON.stringify({ field: 'value' }),
  httpHeader: [
    'Content-Type: application/json',
    'Accept: application/json'
  ],
})

console.log(data)
```

### Simple Request - Using Curl class
```javascript
const { Curl } = require('@m4eba/node-libcurl-impersonate');

const curl = new Curl();

curl.setOpt('URL', 'www.google.com');
curl.setOpt('FOLLOWLOCATION', true);

curl.on('end', function (statusCode, data, headers) {
  console.info(statusCode);
  console.info('---');
  console.info(data.length);
  console.info('---');
  console.info(this.getInfo( 'TOTAL_TIME'));
  
  this.close();
});

curl.on('error', curl.close.bind(curl));
curl.perform();
```

### Setting HTTP headers

Pass an array of strings specifying headers
```javascript
curl.setOpt(Curl.option.HTTPHEADER,
  ['Content-Type: application/x-amz-json-1.1'])
```

### Form Submission (Content-Type: application/x-www-form-urlencoded)
```javascript
const querystring = require('querystring');
const { Curl } = require('@m4eba/node-libcurl-impersonate');

const curl = new Curl();
const close = curl.close.bind(curl);

curl.setOpt(Curl.option.URL, '127.0.0.1/upload');
curl.setOpt(Curl.option.POST, true)
curl.setOpt(Curl.option.POSTFIELDS, querystring.stringify({
  field: 'value',
}));

curl.on('end', close);
curl.on('error', close);
```

### MultiPart Upload / HttpPost libcurl Option (Content-Type: multipart/form-data)

```javascript
const { Curl } = require('@m4eba/node-libcurl-impersonate');

const curl = new Curl();
const close = curl.close.bind(curl);

curl.setOpt(Curl.option.URL, '127.0.0.1/upload.php');
curl.setOpt(Curl.option.HTTPPOST, [
    { name: 'input-name', file: '/file/path', type: 'text/html' },
    { name: 'input-name2', contents: 'field-contents' }
]);

curl.on('end', close);
curl.on('error', close);
```

### Binary Data

When requesting binary data make sure to do one of these:
- Pass your own `WRITEFUNCTION` (https://curl.haxx.se/libcurl/c/CURLOPT_WRITEFUNCTION.html):
```javascript
curl.setOpt('WRITEFUNCTION', (buffer, size, nmemb) => {
  // something
})
```
- Enable one of the following flags:
```javascript
curl.enable(CurlFeature.NoDataParsing)
// or
curl.enable(CurlFeature.Raw)
```

The reasoning behind this is that by default, the `Curl` instance will try to decode the received data and headers to utf8 strings, as can be seen here: https://github.com/JCMais/node-libcurl/blob/b55b13529c9d11fdcdd7959137d8030b39427800/lib/Curl.ts#L391

For more examples check the [examples folder](./examples).

## SSL

## API

API documentation for the latest stable version is available at [https://node-libcurl-docs.netlify.app/modules/_lib_index_.html](https://node-libcurl-docs.netlify.app/modules/_lib_index_.html).

Develop branch documentation is available at [https://develop--node-libcurl-docs.netlify.app/modules/_lib_index_.html](https://develop--node-libcurl-docs.netlify.app/modules/_lib_index_.html).

This library provides Typescript type definitions.

Almost all [CURL options](https://curl.haxx.se/libcurl/c/curl_easy_setopt.html) are supported, if you pass one that is not, an error will be thrown.

For more usage examples check the [examples folder](./examples).

## Special Notes

### `READFUNCTION` option

The buffer passed as first parameter to the callback set with the [`READFUNCTION`](https://curl.haxx.se/libcurl/c/CURLOPT_READFUNCTION.html) option is initialized with the size libcurl is using in their upload buffer (which can be set with [`UPLOAD_BUFFERSIZE`](https://curl.haxx.se/libcurl/c/CURLOPT_UPLOAD_BUFFERSIZE.html)), this is initialized using `node::Buffer::Data(buf);` which is basically the same than `Buffer#allocUnsafe` and therefore, it has all the implications as to its correct usage: https://nodejs.org/pt-br/docs/guides/buffer-constructor-deprecation/#regarding-buffer-allocunsafe

So, be careful, make sure to return **exactly** the amount of data you have written to the buffer on this callback. Only that specific amount is going to be copied and handed over to libcurl.

## Common Issues

See [COMMON_ISSUES.md](./COMMON_ISSUES.md)

## Benchmarks

See [./benchmark](./benchmark)

## Security

See [SECURITY.md](./SECURITY.md)

## Bundled libcurl

The libcurl version is not chosen by you: it is pinned by the `curl-impersonate`
submodule and compiled into the prebuilt binaries. Check what you actually have with:

```js
const { Curl } = require('@m4eba/node-libcurl-impersonate')
console.log(Curl.getVersion())
// libcurl/8.17.0-IMPERSONATE BoringSSL zlib/... brotli/... nghttp2/... ngtcp2/... nghttp3/...
```

Note the TLS backend is **BoringSSL**, not OpenSSL — that is what makes the browser
fingerprints reproducible, and it means OpenSSL specific behaviour may differ.

## Detailed Installation

The latest version of this package has prebuilt binaries (thanks to [node-pre-gyp](https://github.com/mapbox/node-pre-gyp/)) 
 available for:
* Node.js: Latest two versions on active LTS + Current version (see https://github.com/nodejs/Release)
* Electron: Latest 2 major versions

And on the following platforms:
* Linux 64 bits & ARM64 & Alpine (musl, 64 bits)
* macOS 64 bits (Intel) & ARM64 (M1+)
* Windows 64 bits

Installing with `yarn add @m4eba/node-libcurl-impersonate` or `npm install @m4eba/node-libcurl-impersonate` should download a prebuilt binary and no compilation will be needed. However if you are trying to install on `nw.js` or `electron` additional steps will be required, check their corresponding section below.

The prebuilt binary is statically built with the following library versions, features and protocols (library versions may change between Node.js versions):
```
Version: libcurl/8.17.0 OpenSSL/3.5.2 zlib/1.3.1 brotli/1.1.0 zstd/1.5.7 libidn2/2.1.1 libssh2/1.10.0 nghttp2/1.66.0 ngtcp2/1.17.0 nghttp3/1.12.0 OpenLDAP/2.6.9
Protocols: dict, file, ftp, ftps, gopher, gophers, http, https, imap, imaps, ldap, ldaps, mqtt, pop3, pop3s, rtsp, scp, sftp, smb, smbs, smtp, smtps, telnet, tftp, ws, wss
Features: AsynchDNS, IDN, IPv6, Largefile, NTLM, SSL, libz, brotli, TLS-SRP, HTTP2, UnixSockets, HTTPS-proxy, alt-svc
```

If there is no prebuilt binary available that matches your system, or if the installation fails, then you will need an environment capable of compiling Node.js addons, which means:
- [python 3.x](https://www.python.org/downloads/) installed
- updated C++ compiler able to compile C++17 (C++20 for Electron >= v32).

If you don't want to use the prebuilt binary even if it works on your system, you can pass a flag when installing:
> With `npm`
```sh
npm install @m4eba/node-libcurl-impersonate --build-from-source
```
> With `yarn`
```sh
npm_config_build_from_source=true yarn add @m4eba/node-libcurl-impersonate
```

### Important Notes on Prebuilt Binaries / Direct Installation

> Those notes are not important when building on Windows

The prebuilt binaries are statically linked with `brotli`, `libidn2`, `libssh2`, `openLDAP`, `OpenSSL` `nghttp2`, `zstd` and `zlib`.

The `brotli`, `nghttp2`, `OpenSSL` and `zlib` versions **must** match the version Node.js uses, this is necessary to avoid any possible issues by mixing library symbols of different versions, since Node.js also exports some of the symbols of their deps.

In case you are building the addon yourself with the libraries mentioned above, you must make sure their version is ABI compatible with the one Node.js uses, otherwise you are probably going to hit a Segmentation Fault.

If you want to build a statically linked version of the addon yourself, you need to pass the `curl_static_build=true` flag when calling install.

> If using `npm`:
```sh
npm install @m4eba/node-libcurl-impersonate --build-from-source --curl_static_build=true
```
> If using `yarn` or `pnpm`:
```sh
npm_config_build_from_source=true npm_config_curl_static_build=true yarn/pnpm add node-libcurl
```

The build process will use `curl-config` available on path, if you want to overwrite it to your own libcurl installation one, you can set the `curl_config_bin` variable, like mentioned above for `curl_static_build`.

And if you don't want to use `curl-config`, you can pass two extra variables to control the build process:
- `curl_include_dirs`
    Space separated list of directories to search for header files
- `curl_libraries`
    Space separated list of flags to pass to the linker

#### Missing Packages

The statically linked version currently does not have support for `GSS-API`, `SPNEGO`, `KERBEROS`, `RTMP`, `Metalink`, `PSL` and `Alt-svc`.

The scripts to build Kerberos exists on the `./scripts/ci` folder, but it was removed for two reasons:
- If built with Heimdal, the addon becomes too big
- If built with MIT Kerberos, the addon would be bound to their licensing terms.

### Electron / NW.js

If building for a `Electron` or `NW.js` you need to pass additional parameters to the install command.

If you do not want to use the prebuilt binary, pass the `npm_config_build_from_source=true` / `--build-from-source` flag to the install command.

#### NW.js (aka node-webkit)
For building from source on NW.js you first need to make sure you have nw-gyp installed globally:
`yarn global add nw-gyp` or `npm i -g nw-gyp` or `pnpm i -g nw-gyp`

> If on Windows, you also need addition steps, currently the available win_delay_load_hook.cc on `nw-gyp` is not working with this addon, so it's necessary to apply a patch to it. The patch can be found on `./scripts/ci/patches/win_delay_load_hook.cc.patch`, and should be applied to the file on `<nw-gyp-folder>/src/win_delay_load_hook.cc`.

Then:
> yarn
```
npm_config_runtime=node-webkit npm_config_target=0.38.2 yarn add @m4eba/node-libcurl-impersonate
```
> npm
```bash
npm install @m4eba/node-libcurl-impersonate --runtime=node-webkit --target=0.38.2 --save
```

where `--target` is the current version of NW.js you are using

#### Electron (aka atom-shell)

> yarn
```bash
npm_config_runtime=electron npm_config_target=X.Y.Z npm_config_disturl=https://www.electronjs.org/headers yarn add @m4eba/node-libcurl-impersonate
```

> npm
```bash
npm install @m4eba/node-libcurl-impersonate --runtime=electron --target=X.Y.Z --disturl=https://www.electronjs.org/headers --save
```

Where `--target` is the version of electron you are using, in our case, we are just using the version returned by the locally installed `electron` binary.

You can also put those args in a .npmrc file, like so:

```bash
runtime = electron
target = 5.0.1
target_arch = x64
dist_url = https://atom.io/download/atom-shell
```

### Building on Linux

To build the addon on linux based systems you must have:
- gcc >= 7
- libcurl dev files
- python >= 3
- OS that is not past their EOL.

If you are on a debian based system, you can get those by running:
```bash
sudo apt-get install python libcurl4-openssl-dev build-essential
```

If you don't want to use the libcurl version shipped with your system, since it's probably very old, you can install libcurl from source, for the addon to use that libcurl version you can use the variable mentioned above, `curl_config_bin`.

In case you want some examples check the CI configuration files ([`.travis.yml`](./.travis.yml), [`.circleci/config.yml`](./.circleci/config.yml)) and the [`scripts/ci/`](./scripts/ci) folder.

### Building on macOS

On macOS you must have:
- macOS >= 13 (Sonoma)
- Xcode Command Line Tools

You can check if you have Xcode Command Line Tools be running:
```sh
xcode-select -p
```

It should return their path, in case it returns nothing, you must install it by running:
```sh
xcode-select --install
```

#### Xcode >= 10 | macOS >= Mojave
In case you have errors installing the addon from source, and you are using macOS version >= Mojave, check if the error you are receiving is the following one:
```
  CXX(target) Release/obj.target/node_libcurl/src/node_libcurl.o
  clang: error: no such file or directory: '/usr/include'
```

If that is the case, it's because newer versions of the Command Line Tools does not add the `/usr/include` folder by default. Check [Xcode 10 release notes](https://developer.apple.com/documentation/xcode_release_notes/xcode_10_release_notes#3035624) for details.

The `/usr/include` is now available on `$(xcrun --show-sdk-path)/usr/include`. To correctly build libcurl you then need to pass that path to the `npm_config_curl_include_dirs` environment variable:
```
npm_config_curl_include_dirs="$(xcrun --show-sdk-path)/usr/include" yarn add @m4eba/node-libcurl-impersonate
```

#### Homebrew

In the case you got
```
error: use of undeclared identifier 'curl_ws_start_frame'; did you mean 'curl_ws_frame'?
```

It means your system is using the macOS SDK's libcurl headers, which are outdated (version below 8.16, which requireds for WebSocket support).

You must use `curl` install via Homebrew, you can use the following steps to make sure the system picks up the Homebrew `curl` headers/libs when building from source.

1. Install `curl` with Homebrew (if you don't already have it):

```bash
brew install curl
```

2. Add Homebrew's `curl` to your environment so build tools can find headers, libraries and `curl-config`:

```zsh
export PATH="$(brew --prefix curl)/bin:$PATH" # optional

export CPPFLAGS="-I$(brew --prefix curl)/include"
export LDFLAGS="-L$(brew --prefix curl)/lib"
export PKG_CONFIG_PATH="$(brew --prefix curl)/lib/pkgconfig"
```

Note: On Intel macs Homebrew is typically installed under `/usr/local` and on Apple Silicon under `/opt/homebrew`. Using `$(brew --prefix curl)` is the most portable option across both architectures.

3. Build & install `node-libcurl` from source.

Optional: remove a previously installed local copy of `node-libcurl` first to ensure a clean build:

```zsh
# remove previously installed copy (local environment only)
rm -rf node_modules/node-libcurl
```

Then build from source. Depending on your macOS Xcode/CLT version you may need to also point to the SDK's `/usr/include` directory:

If you prefer to explicitly use the Homebrew-installed `curl` headers instead of the SDK include path, you can use:

```zsh
npm_config_curl_include_dirs="$(brew --prefix curl)/include" npm_config_curl_libraries="-L$(brew --prefix curl)/lib -lcurl" npm install @m4eba/node-libcurl-impersonate --build-from-source
```

Or if you want to use the SDK's include path:
```zsh
# build & install
npm_config_curl_include_dirs="$(xcrun --show-sdk-path)/usr/include" npm install @m4eba/node-libcurl-impersonate --build-from-source
```

This should allow your machine to build the addon using the Homebrew `curl` installation.

### Building on Windows

If installing using a prebuilt binary you only need to have the [visual c++ 2017 runtime library](https://visualstudio.microsoft.com/downloads/#microsoft-visual-c-redistributable-for-visual-studio-2017).

If building from source, you must have:
- Python 3.x
- [Visual Studio >= 2019](https://visualstudio.microsoft.com/downloads/) (with Clang/LLVM support enabled, see the next item)
- [Clang/LLVM support on Visual Studio](https://learn.microsoft.com/en-us/cpp/build/clang-support-msbuild?view=msvc-170)
- [nasm](https://www.nasm.us/)

Python 3.x and the Visual Studio compiler can be installed by running:
```sh
npm install --global --production windows-build-tools
```

`nasm` can be obtained from their website, which is linked above, or using chocolatey:
```
choco install nasm
```

Currently there is no support to use other libcurl version than the one provided by the [curl-for-windows](https://github.com/JCMais/curl-for-windows) submodule (help is appreciated on adding this feature).

An important note about building the addon on Windows is that we have to do some "hacks" with the header files included by `node-gyp`/`nw-gyp`. The reason for that is because as we are using a standalone version of OpenSSL, we don't want to use the OpenSSL headers provided by Node.js, which are by default added to `<nw-gyp-or-node-gyp-folder>/include/node/openssl`, so what we do is that before compilation that folder is renamed to `openssl.disabled`. After a successful installation the folder is renamed back to their original name, **however** if any error happens during compilation the folder will stay renamed until the addon is compiled successfully. More info on why that was needed and some context can be found on issue [#164](https://github.com/JCMais/node-libcurl/issues/164).

#### Note on outdated node-gyp version

NPM has its own internal version of `node-gyp`, which may not be the most up-to-date version. If you see an output like this:
```
[info] it worked if it ends with ok
[info] using node-pre-gyp@2.0.0
[info] using node@24.9.0 | win32 | x64 
gyp info it worked if it ends with ok
gyp info using node-gyp@10.1.0
gyp info using node@24.9.0 | win32 | x64
gyp info ok 
gyp info it worked if it ends with ok
gyp info using node-gyp@10.1.0
gyp info using node@24.9.0 | win32 | x64
```

Where the node-gyp version is `10.1.0`, you will probably face issues related to ClangCL like this:
```
C:\Users\internal\AppData\Local\node\corepack\v1\pnpm\9.9.0\dist\node_modules\node-gyp\src\win_delay_load_hook.cc(37,9): warning : unknown pragma ignored [-Wunknown-pragmas] [F:\jc\node-libcurl\build\deps\
curl-for-windows\libcurl.vcxproj]
  /LTCG:INCREMENTAL: no such file or directory
D:\Software\Microsoft Visual Studio\2019\Community\MSBuild\Microsoft\VC\v160\Microsoft.CppCommon.targets(1522,5): error MSB6006: "llvm-lib.exe" exited with code 1. [F:\jc\node-libcurl\build\deps\curl-fo
r-windows\libcurl.vcxproj]
C:\Users\internal\AppData\Local\node\corepack\v1\pnpm\9.9.0\dist\node_modules\node-gyp\src\win_delay_load_hook.cc(12,9): warning : unknown pragma ignored [-Wunknown-pragmas] [F:\jc\node-libcurl\build\deps\
curl-for-windows\brotli\brotli.vcxproj]
C:\Users\internal\AppData\Local\node\corepack\v1\pnpm\9.9.0\dist\node_modules\node-gyp\src\win_delay_load_hook.cc(37,9): warning : unknown pragma ignored [-Wunknown-pragmas] [F:\jc\node-libcurl\build\deps\
curl-for-windows\brotli\brotli.vcxproj]
  /LTCG:INCREMENTAL: no such file or directory
D:\Software\Microsoft Visual Studio\2019\Community\MSBuild\Microsoft\VC\v160\Microsoft.CppCommon.targets(1522,5): error MSB6006: "llvm-lib.exe" exited with code 1. [F:\jc\node-libcurl\build\deps\curl-fo
r-windows\brotli\brotli.vcxproj]
```

The only solution to this is to install a globally available node-gyp version:
```powershell
npm install --global node-gyp@latest
```

and then use it in the install command by setting the `npm_config_node_gyp` environment variable (this assumes powershell):
```powershell
$globalNodeGypPath = Join-Path (npm prefix -g) "node_modules\node-gyp\bin\node-gyp.js"
$env:npm_config_node_gyp=$globalNodeGypPath
pnpm install @m4eba/node-libcurl-impersonate
```

## Getting Help

If your question is directly related to the addon or their usage, you can get help the following ways:
- Post a question on `stack-overflow` and use the `node-libcurl` tag.
- [Join our Discord server](https://discord.gg/3vacxRY) and send your question there.

## Contributing

Read [CONTRIBUTING.md](./CONTRIBUTING.md)

## Credits

This package is a thin layer over other people's work:

- [node-libcurl](https://github.com/JCMais/node-libcurl) by Jonathan Cardoso Machado —
  the bindings this is forked from, and the source of essentially all of the API
  documented above. If this package is useful to you, consider supporting him:
  [Patreon](https://www.patreon.com/jonathancardoso).
- [curl-impersonate](https://github.com/lexiforest/curl-impersonate) by lexiforest, and
  before it [lwthiker's original](https://github.com/lwthiker/curl-impersonate) — the
  patches that make curl look like a browser.
- [curl](https://github.com/curl/curl) itself.

_node-libcurl was originally based on [jiangmiao/node-curl](https://github.com/jiangmiao/node-curl); most if not all of that code has since been rewritten._
