#!/bin/bash
set -euo pipefail

# args: <version> <dest_folder>
# We ignore version usually as we use the submodule, but we respect the interface.
DEST_FOLDER=$2
BUILD_FOLDER=$DEST_FOLDER/build/curl-impersonate
SOURCE_FOLDER=$DEST_FOLDER/source/curl-impersonate

# curl-impersonate's Makefile declares .ONESHELL:, which needs GNU make >= 3.82.
# macOS ships GNU make 3.81, where each recipe line runs in its own shell, so
# the `cd` those rules rely on is lost and the brotli build ends up running
# cmake against the wrong directory. Homebrew's make package provides gmake.
MAKE=make
if [[ "$(uname)" == "Darwin" ]]; then
  MAKE=gmake
fi

if ! command -v "$MAKE" &> /dev/null; then
  echo "Error: $MAKE not found, needed to build curl-impersonate" >&2
  exit 1
fi

echo "Building curl-impersonate to $DEST_FOLDER"

# Check if already built
if [[ -f $BUILD_FOLDER/lib/libcurl-impersonate.a ]] || [[ -f $BUILD_FOLDER/lib/libcurl-impersonate.so ]]; then
  echo "curl-impersonate seems to be already built at $BUILD_FOLDER"
  if [[ "${FORCE_REBUILD:-}" != "true" ]]; then
    echo "Skipping rebuild. Set FORCE_REBUILD=true to force."
    exit 0
  fi
fi

mkdir -p $BUILD_FOLDER
mkdir -p $SOURCE_FOLDER

# Build out of a copy so the submodule checkout stays clean. Run from repo root.
REPO_ROOT=$(pwd)
IMPERSONATE_SUBMODULE="$REPO_ROOT/curl-impersonate"

if [ ! -d "$IMPERSONATE_SUBMODULE" ]; then
  echo "Error: curl-impersonate submodule not found at $IMPERSONATE_SUBMODULE"
  exit 1
fi

echo "Copying source to $SOURCE_FOLDER..."
if command -v rsync &> /dev/null; then
  rsync -a --exclude .git "$IMPERSONATE_SUBMODULE/" "$SOURCE_FOLDER/"
else
  cp -R "$IMPERSONATE_SUBMODULE/"* "$SOURCE_FOLDER/"
fi

cd $SOURCE_FOLDER

# Makefile.in hardcodes "-pthread -lc++", which is right on macOS but not on
# Linux or Alpine, where the toolchain is gcc and the C++ runtime is libstdc++.
# Without this curl's own configure fails with "C compiler cannot create
# executables", because it cannot link against a libc++ that is not installed.
# Safe to edit in place - this is the copy, not the submodule.
if [[ "$(uname)" == "Linux" ]]; then
  echo "Linux detected, linking against libstdc++ instead of libc++"
  sed -i 's/-lc++/-lstdc++/g' Makefile.in
fi

# Drop c-ares and fall back to curl's threaded resolver. curl-impersonate always
# builds with --enable-ares, but c-ares fails to resolve when the system has
# several DNS servers configured, which is why upstream node-libcurl stopped
# shipping it: https://github.com/JCMais/node-libcurl/issues/280
# It breaks the CI runners the same way, and it would ship the same DNS bug to
# anyone using the prebuilt binaries. c-ares is DNS only, so impersonation is
# unaffected.
echo "Disabling c-ares in favour of the threaded resolver"
sed -i.bak 's/ --enable-ares=[^"]*//' Makefile.in && rm -f Makefile.in.bak

if grep -q 'enable-ares' Makefile.in; then
  echo "Error: failed to remove --enable-ares from Makefile.in" >&2
  exit 1
fi

# curl-impersonate expects an out-of-tree build dir: mkdir build && cd build && ../configure
mkdir -p build
cd build

echo "Configuring curl-impersonate..."
# The addon links libcurl into the .node file, so build a static library.
# There is no --disable-shared here: curl-impersonate's configure does not
# define it and warns about an unrecognized option.
CONFIGURE_ARGS=( "--prefix=$BUILD_FOLDER" )
CONFIGURE_ARGS+=( "--enable-static" )

# zstd is mandatory for curl-impersonate and zlib is looked up the same way,
# and neither is guaranteed to be installed system wide on the CI images.
# build.sh has already built both, so point configure at those instead of
# relying on whatever the runner happens to ship.
if [[ -n "${ZLIB_BUILD_FOLDER:-}" ]]; then
  CONFIGURE_ARGS+=( "--with-zlib=$ZLIB_BUILD_FOLDER" )
fi
if [[ -n "${ZSTD_BUILD_FOLDER:-}" ]]; then
  CONFIGURE_ARGS+=( "--with-zstd=$ZSTD_BUILD_FOLDER" )
fi

echo "configure ${CONFIGURE_ARGS[*]}"
../configure "${CONFIGURE_ARGS[@]}"

# The addon is a shared object, so every static archive linked into it has to
# be position independent. curl-impersonate passes --with-pic to nghttp2,
# nghttp3 and ngtcp2 and sets POSITION_INDEPENDENT_CODE for BoringSSL, but
# c-ares gets neither, and linking it on aarch64 fails with:
#   relocation R_AARCH64_ADR_PREL_PG_HI21 against symbol ... can not be used
#   when making a shared object; recompile with -fPIC
# x86_64 happens to tolerate those relocations, aarch64 does not. The Makefile
# forwards CFLAGS to its cmake builds and the autotools sub-configures inherit
# it from the environment. Appended so the macOS arch flags set by build.sh
# survive.
export CFLAGS="${CFLAGS:-} -fPIC"
export CXXFLAGS="${CXXFLAGS:-} -fPIC"

echo "Running make build..."
echo "CFLAGS=$CFLAGS"
# Downloads and builds the dependencies (BoringSSL, brotli, nghttp2, ...) too
"$MAKE" build

echo "Running make install..."
"$MAKE" install

# Check if we have what we need
if [ ! -f "$BUILD_FOLDER/bin/curl-impersonate-config" ]; then
  echo "Error: curl-impersonate-config not found in $BUILD_FOLDER/bin"
  exit 1
fi

# build.sh and binding.gyp resolve link flags through `curl-config`, which
# curl-impersonate installs under its own name.
ln -sf "$BUILD_FOLDER/bin/curl-impersonate-config" "$BUILD_FOLDER/bin/curl-config"

# curl-impersonate installs its libraries and curl-impersonate-config, but not
# curl's public headers, so compiling the addon against this prefix fails with
# "curl/curl.h: No such file or directory". Copy them out of the curl tree that
# was just built. cwd is the build folder, and the Makefile unpacks curl into a
# directory named after its own CURL_VERSION.
CURL_DIR=$(sed -nE 's/^CURL_VERSION[[:space:]]*:=[[:space:]]*(.+)$/\1/p' ../Makefile.in)

if [[ -z "$CURL_DIR" || ! -d "$CURL_DIR/include/curl" ]]; then
  echo "Error: curl headers not found at $CURL_DIR/include/curl" >&2
  exit 1
fi

echo "Installing curl headers from $CURL_DIR into $BUILD_FOLDER/include"
mkdir -p "$BUILD_FOLDER/include"
cp -R "$CURL_DIR/include/curl" "$BUILD_FOLDER/include/"

if [ ! -f "$BUILD_FOLDER/include/curl/curl.h" ]; then
  echo "Error: curl/curl.h missing from $BUILD_FOLDER/include after copy" >&2
  exit 1
fi

echo "Build complete. Output in $BUILD_FOLDER"
