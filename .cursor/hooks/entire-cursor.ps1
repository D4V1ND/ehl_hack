# Entire Cursor hook runner (Windows).
# Cursor pipes UTF-8 JSON with a BOM; Entire's JSON parser rejects the BOM.
# This strips the BOM, then fail-opens if `entire` is missing.
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [ValidateNotNullOrEmpty()]
    [string]$Hook
)

$ErrorActionPreference = 'Continue'

if (-not (Get-Command entire -ErrorAction SilentlyContinue)) {
    exit 0
}

$reader = [System.IO.StreamReader]::new(
    [Console]::OpenStandardInput(),
    $true  # detectEncodingFromByteOrderMarks — drops UTF-8 BOM
)
try {
    $raw = $reader.ReadToEnd()
}
finally {
    $reader.Dispose()
}

$raw | & entire hooks cursor $Hook
exit $LASTEXITCODE
