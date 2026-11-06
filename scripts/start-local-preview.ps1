$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$url = 'http://127.0.0.1:4196'
$node = (Get-Command node.exe).Source
function Test-WebsitePreview {
  try {
    $response = Invoke-WebRequest -Uri $url -TimeoutSec 2 -UseBasicParsing
    return $response.StatusCode -eq 200 -and $response.Content.Contains('Monitor cameras.')
  } catch { return $false }
}
if (Test-WebsitePreview) { Write-Output "E-VMS public website already running at $url"; return }
if (Get-NetTCPConnection -LocalPort 4196 -State Listen -ErrorAction SilentlyContinue) {
  throw 'Port 4196 is in use by a different service. No listener was stopped.'
}
Push-Location -LiteralPath $root
try {
  & $node scripts/build.js
  if ($LASTEXITCODE -ne 0) { throw 'Website build failed.' }
  $process = Start-Process -FilePath $node -ArgumentList 'scripts/local-preview.js' -WorkingDirectory $root -WindowStyle Hidden -PassThru
  for ($attempt=0; $attempt -lt 20; $attempt++) {
    Start-Sleep -Milliseconds 350
    if (Test-WebsitePreview) { Write-Output "E-VMS public website at $url (PID $($process.Id))"; return }
    if ($process.HasExited) { throw "Website process exited with $($process.ExitCode)." }
  }
  throw 'The preview did not answer in time. No other listener was stopped.'
} finally { Pop-Location }