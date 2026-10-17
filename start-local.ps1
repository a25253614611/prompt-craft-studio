$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodePath = (Get-Command node -ErrorAction Stop).Source
$ollamaUrl = 'http://127.0.0.1:11434/api/tags'
$ollamaReady = $false
try { $null = Invoke-RestMethod -Uri $ollamaUrl -TimeoutSec 2; $ollamaReady = $true } catch {}
if (-not $ollamaReady) {
  $portable = Join-Path $env:LOCALAPPDATA 'Programs\OllamaPortable\ollama.exe'
  if (Test-Path -LiteralPath $portable) { $ollamaPath = $portable }
  else { $ollamaPath = (Get-Command ollama -ErrorAction SilentlyContinue).Source }
  if ($ollamaPath) {
    $env:OLLAMA_NO_CLOUD = '1'
    Start-Process -FilePath $ollamaPath -ArgumentList 'serve' -WorkingDirectory (Split-Path -Parent $ollamaPath) -WindowStyle Hidden
  }
}
$healthUrl = 'http://127.0.0.1:4173/__prompt-studio-health'
$ready = $false
try {
  $existing = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
  $ready = $existing.app -eq 'prompt-craft-studio'
} catch {}
if (-not $ready) {
  $scriptPath = Join-Path $projectRoot 'local-server.mjs'
  Start-Process -FilePath $nodePath -ArgumentList ('"' + $scriptPath + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    Start-Sleep -Milliseconds 250
    try {
      $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 2
      if ($response.app -eq 'prompt-craft-studio') { $ready = $true; break }
    } catch {}
  }
}
if (-not $ready) { throw 'Local website could not start. Check port 4173.' }
Start-Process 'http://127.0.0.1:4173/'
