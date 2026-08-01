#!/bin/bash
set -e

# Directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$DIR/.."
CURL_IMPERSONATE_DIR="$ROOT_DIR/curl-impersonate"

cd "$CURL_IMPERSONATE_DIR"

echo "Building curl-impersonate in $CURL_IMPERSONATE_DIR"

# Configure with local prefix
# We use a subdirectory 'install' inside curl-impersonate to keep it contained
INSTALL_DIR="$CURL_IMPERSONATE_DIR/install"

# Check if already built
if [ -f "$INSTALL_DIR/bin/curl-impersonate-config" ] && [ -f "$INSTALL_DIR/lib/libcurl-impersonate.a" ]; then
    echo "curl-impersonate already built at $INSTALL_DIR"
    if [ "${FORCE_REBUILD:-}" != "true" ]; then
        echo "Skipping rebuild. Set FORCE_REBUILD=true to force."
        exit 0
    fi
fi

mkdir -p "$INSTALL_DIR"

# Only configure if Makefile doesn't exist to save time on re-runs
if [ ! -f "Makefile" ]; then
    echo "Configuring..."
    ./configure --prefix="$INSTALL_DIR"
else
    echo "Already configured, skipping configuration."
fi

echo "Building..."
make build

echo "Installing..."
make install

echo "Copying headers..."
# We need to find the curl source directory to copy headers
# Assuming one curl-* directory exists
CURL_SRC=$(find . -maxdepth 1 -type d -name "curl-*" | head -n 1)
if [ -d "$CURL_SRC/include/curl" ]; then
    mkdir -p "$INSTALL_DIR/include"
    cp -r "$CURL_SRC/include/curl" "$INSTALL_DIR/include/"
else
    echo "Warning: Could not find curl source directory to copy headers."
fi

echo "Done. curl-impersonate installed to $INSTALL_DIR"
