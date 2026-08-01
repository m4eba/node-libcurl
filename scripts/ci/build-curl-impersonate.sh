#!/bin/bash
set -euo pipefail

# args: <version> <dest_folder>
# We ignore version usually as we use the submodule, but we respect the interface.
DEST_FOLDER=$2
BUILD_FOLDER=$DEST_FOLDER/build/curl-impersonate
SOURCE_FOLDER=$DEST_FOLDER/source/curl-impersonate

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

# curl-impersonate expects an out-of-tree build dir: mkdir build && cd build && ../configure
mkdir -p build
cd build

echo "Configuring curl-impersonate..."
# Static only, matching build-libcurl.sh - the addon links libcurl into the
# .node file, so a shared build would leave a runtime dependency behind.
CONFIGURE_ARGS=( "--prefix=$BUILD_FOLDER" )
CONFIGURE_ARGS+=( "--enable-static" )
CONFIGURE_ARGS+=( "--disable-shared" )

../configure "${CONFIGURE_ARGS[@]}"

echo "Running make build..."
# Downloads and builds the dependencies (BoringSSL, brotli, nghttp2, ...) too
make build

echo "Running make install..."
make install

# Check if we have what we need
if [ ! -f "$BUILD_FOLDER/bin/curl-impersonate-config" ]; then
  echo "Error: curl-impersonate-config not found in $BUILD_FOLDER/bin"
  exit 1
fi

# build.sh and binding.gyp resolve link flags through `curl-config`, which
# curl-impersonate installs under its own name.
ln -sf "$BUILD_FOLDER/bin/curl-impersonate-config" "$BUILD_FOLDER/bin/curl-config"

echo "Build complete. Output in $BUILD_FOLDER"
