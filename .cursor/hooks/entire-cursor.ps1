# Strip UTF-8 BOM from Cursor hook stdin before handing off to Entire.
# Cursor on Windows often prefixes JSON with EF BB BF; Entire's parser rejects it.
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Event
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command entire -ErrorAction SilentlyContinue)) {
    exit 0
}

$stdin = [Console]::OpenStandardInput()
$reader = New-Object System.IO.StreamReader($stdin, [System.Text.Encoding]::UTF8, $true)
try {
    $payload = $reader.ReadToEnd()
}
finally {
    $reader.Dispose()
}

if ([string]::IsNullOrEmpty($payload)) {
    exit 0
}

if ($payload[0] -eq [char]0xFEFF) {
    $payload = $payload.Substring(1)
}

# Entire 0.10.2 sanitizes C:\foo to C--foo. Cursor uses c-foo.
# Point Entire at the real agent-transcripts directory.
$repoRoot = (git rev-parse --show-toplevel 2>$null)
if ($repoRoot) {
    $slug = [regex]::Replace([System.IO.Path]::GetFullPath($repoRoot), '[^A-Za-z0-9]', '-')
    $slug = ($slug -replace '-{2,}', '-').Trim('-')
    if ($slug.Length -gt 0) {
        $slug = $slug.Substring(0, 1).ToLowerInvariant() + $slug.Substring(1)
    }
    $transcripts = Join-Path $env:USERPROFILE ".cursor\projects\$slug\agent-transcripts"
    if (Test-Path -LiteralPath $transcripts) {
        $env:ENTIRE_TEST_CURSOR_PROJECT_DIR = $transcripts
    }
}

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = 'entire'
$psi.Arguments = "hooks cursor $Event"
$psi.UseShellExecute = $false
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true
if ($env:ENTIRE_TEST_CURSOR_PROJECT_DIR) {
    $psi.EnvironmentVariables['ENTIRE_TEST_CURSOR_PROJECT_DIR'] = $env:ENTIRE_TEST_CURSOR_PROJECT_DIR
}

$proc = [System.Diagnostics.Process]::Start($psi)
$proc.StandardInput.Write($payload)
$proc.StandardInput.Close()
$stdout = $proc.StandardOutput.ReadToEnd()
$stderr = $proc.StandardError.ReadToEnd()
$proc.WaitForExit()

if ($stdout) { [Console]::Out.Write($stdout) }
if ($stderr) { [Console]::Error.Write($stderr) }
exit $proc.ExitCode
