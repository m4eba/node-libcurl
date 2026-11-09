# Builds curl-impersonate with Visual Studio's clang-cl and installs it into
# -Prefix. Windows counterpart of scripts/ci/build-curl-impersonate.sh, and also
# run by scripts/preinstall-setup.js, so it has to work on Windows PowerShell 5.1.
param(
    [Parameter(Mandatory = $true)]
    [string]$Prefix
)

$ErrorActionPreference = 'Stop'
# robocopy reports success through non-zero exit codes, so exit codes are checked by hand.
$PSNativeCommandUseErrorActionPreference = $false

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$Submodule = Join-Path $RepoRoot 'curl-impersonate'
$NoCaresPatch = Join-Path $RepoRoot 'scripts\ci\curl-impersonate-no-cares.patch'
$ExpectedFiles = @(
    'lib\libcurl-impersonate.dll',
    'lib\libcurl-impersonate_imp.lib',
    'include\curl\curl.h'
)

function Get-MissingFiles {
    return @($ExpectedFiles | Where-Object { -not (Test-Path (Join-Path $Prefix $_)) })
}

if ((Get-MissingFiles).Count -eq 0 -and $env:FORCE_REBUILD -ne 'true') {
    Write-Host "curl-impersonate is already built at $Prefix, skipping."
    exit 0
}

if (-not (Test-Path (Join-Path $Submodule 'CMakeLists.txt'))) {
    throw "curl-impersonate submodule not found at $Submodule"
}

$VcVars = switch ($env:PROCESSOR_ARCHITECTURE) {
    'AMD64' { 'vcvars64' }
    'ARM64' { 'vcvarsarm64' }
    default { throw "Unsupported architecture: $env:PROCESSOR_ARCHITECTURE" }
}

$VsWhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
if (-not (Test-Path $VsWhere)) {
    throw 'Visual Studio was not found.'
}
$VsInstall = & $VsWhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Llvm.Clang -property installationPath
if (-not $VsInstall) {
    throw 'Visual Studio with the "C++ Clang tools for Windows" component was not found.'
}

# A short path outside the module folder: the dependency builds nest deeply
# enough to hit MAX_PATH from a consumer's node_modules.
$WorkDir = Join-Path ([IO.Path]::GetTempPath()) ('ci-' + [Guid]::NewGuid().ToString('N').Substring(0, 8))

try {
    Write-Host "Copying curl-impersonate to $WorkDir"
    robocopy $Submodule $WorkDir /E /NFL /NDL /NJH /NJS /NP /XF .git /XD .git "$Submodule\install" "$Submodule\build" "$Submodule\packages" | Out-Null
    if ($LASTEXITCODE -ge 8) {
        throw "robocopy failed with exit code $LASTEXITCODE"
    }

    # See scripts/ci/build-curl-impersonate.sh for why c-ares is disabled.
    # --ignore-whitespace because either file may have been checked out with CRLF.
    Write-Host 'Disabling c-ares in favour of the threaded resolver'
    Push-Location $WorkDir
    try {
        git apply --ignore-whitespace $NoCaresPatch
        if ($LASTEXITCODE -ne 0) {
            throw 'Could not apply curl-impersonate-no-cares.patch'
        }
    } finally {
        Pop-Location
    }

    # Through cmd because redirecting a native command's stderr in PowerShell 5.1
    # raises a terminating error under ErrorActionPreference=Stop.
    $Version = (cmd /c "git -C `"$Submodule`" describe --tags --exact-match HEAD 2>nul") -replace '^v', ''
    $InstallPrefix = $Prefix.Replace('\', '/')

    # Same steps as win/build.bat, which cannot set the install prefix or version.
    # A separate script because vcvars only affects the cmd session it runs in.
    $BuildScript = Join-Path $WorkDir 'node-libcurl-build.cmd'
    @"
@echo off
set "PATH=%PATH:LLVM=Dummy%"
call "$VsInstall\VC\Auxiliary\Build\$VcVars.bat" || exit /b 1
cd /d "$WorkDir" || exit /b 1
cmake -S . -B build -GNinja -DCMAKE_BUILD_TYPE=Release "-DCMAKE_INSTALL_PREFIX=$InstallPrefix" -DCMAKE_INSTALL_LIBDIR=lib -DUSE_LIBIDN2=OFF "-DCURL_IMPERSONATE_VERSION=$Version" -DCMAKE_POLICY_DEFAULT_CMP0091=NEW -DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded -DCMAKE_C_COMPILER=clang-cl.exe -DCMAKE_CXX_COMPILER=clang-cl.exe -DCMAKE_LINKER=link.exe || exit /b 1
cmake --build build --config Release --target install-all || exit /b 1
"@ | Set-Content -Path $BuildScript -Encoding Ascii

    & cmd /c "`"$BuildScript`""
    if ($LASTEXITCODE -ne 0) {
        throw "curl-impersonate build failed with exit code $LASTEXITCODE"
    }
} finally {
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue $WorkDir
}

$Missing = Get-MissingFiles
if ($Missing.Count -gt 0) {
    throw "Missing from ${Prefix}: $($Missing -join ', ')"
}

Write-Host "Build complete. Output in $Prefix"
