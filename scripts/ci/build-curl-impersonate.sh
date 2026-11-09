#!/bin/bash
set -euo pipefail

# args: <version> <dest_folder>
# The version is ignored because the submodule decides what gets built, but
# this keeps the interface of the other build-*.sh scripts. Run from repo root.
DEST_FOLDER=$2
SOURCE_FOLDER=$DEST_FOLDER/source/curl-impersonate
# scripts/curl-impersonate-build.sh installs into the submodule instead.
BUILD_FOLDER=${CURL_IMPERSONATE_PREFIX:-$DEST_FOLDER/build/curl-impersonate}

REPO_ROOT=$(pwd)
IMPERSONATE_SUBMODULE="$REPO_ROOT/curl-impersonate"

echo "Building curl-impersonate to $BUILD_FOLDER"

# Check if already built
if [[ -f $BUILD_FOLDER/lib/libcurl-impersonate.a ]] || [[ -f $BUILD_FOLDER/lib/libcurl-impersonate.so ]]; then
  echo "curl-impersonate seems to be already built at $BUILD_FOLDER"
  if [[ "${FORCE_REBUILD:-}" != "true" ]]; then
    echo "Skipping rebuild. Set FORCE_REBUILD=true to force."
    exit 0
  fi
fi

if [ ! -f "$IMPERSONATE_SUBMODULE/CMakeLists.txt" ]; then
  echo "Error: curl-impersonate submodule not found at $IMPERSONATE_SUBMODULE"
  exit 1
fi

# Build out of a copy so the submodule checkout stays clean.
rm -rf "$SOURCE_FOLDER"
mkdir -p "$BUILD_FOLDER" "$SOURCE_FOLDER"

echo "Copying source to $SOURCE_FOLDER..."
if command -v rsync &> /dev/null; then
  rsync -a --exclude .git --exclude /install "$IMPERSONATE_SUBMODULE/" "$SOURCE_FOLDER/"
else
  cp -R "$IMPERSONATE_SUBMODULE/"* "$SOURCE_FOLDER/"
fi

cd "$SOURCE_FOLDER"

# Drop c-ares and fall back to curl's threaded resolver. curl-impersonate always
# builds with c-ares outside of Android, and has no option to turn it off, but
# c-ares fails to resolve when the system has several DNS servers configured,
# which is why upstream node-libcurl stopped shipping it:
# https://github.com/JCMais/node-libcurl/issues/280
# It breaks the CI runners the same way, and it would ship the same DNS bug to
# anyone using the prebuilt binaries. c-ares is DNS only, so impersonation is
# unaffected. A patch rather than a sed, so a bump that moves this code fails.
echo "Disabling c-ares in favour of the threaded resolver"
patch -p1 < "$REPO_ROOT/scripts/ci/curl-impersonate-no-cares.patch"

# The copy has no .git for curl-impersonate to read its version from.
IMPERSONATE_VERSION=$(git -C "$IMPERSONATE_SUBMODULE" describe --tags --exact-match HEAD 2>/dev/null | sed 's/^v//' || true)

# The Debian multiarch and Fedora lib64 layouts would otherwise move lib/, which
# is where the rest of the build looks. libidn2 stays off to match what the
# addon has always shipped.
CMAKE_ARGS=(
  "-DCMAKE_INSTALL_PREFIX=$BUILD_FOLDER"
  "-DCMAKE_INSTALL_LIBDIR=lib"
  "-DUSE_LIBIDN2=OFF"
  "-DCURL_IMPERSONATE_VERSION=$IMPERSONATE_VERSION"
)

echo "cmake ${CMAKE_ARGS[*]}"
cmake -S . -B build "${CMAKE_ARGS[@]}"

echo "Building..."
# Downloads and builds the dependencies (BoringSSL, brotli, nghttp2, ...) too
cmake --build build

echo "Installing..."
cmake --build build --target install-all

for file in bin/curl-impersonate-config lib/libcurl-impersonate.a include/curl/curl.h; do
  if [ ! -f "$BUILD_FOLDER/$file" ]; then
    echo "Error: $file not found in $BUILD_FOLDER" >&2
    exit 1
  fi
done

# build.sh and binding.gyp resolve link flags through `curl-config`, which
# curl-impersonate installs under its own name.
ln -sf "$BUILD_FOLDER/bin/curl-impersonate-config" "$BUILD_FOLDER/bin/curl-config"

echo "Build complete. Output in $BUILD_FOLDER"
