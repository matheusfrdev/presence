# Real-Time Presence — extração de ícone
# ------------------------------------------------------------
# Recebe o caminho de um executável e imprime, no stdout, o
# ícone associado a ele como PNG em base64. Usa apenas o que já
# vem com o Windows (System.Drawing) — nada de dependência extra.
#
# Uso:
#   powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File extract-icon.ps1 -Path "C:\...\app.exe"

param(
  [Parameter(Mandatory = $true)]
  [string]$Path
)

$ErrorActionPreference = 'Stop'

try {
  if (-not (Test-Path -LiteralPath $Path)) {
    exit 1
  }

  Add-Type -AssemblyName System.Drawing

  $icon = [System.Drawing.Icon]::ExtractAssociatedIcon($Path)
  if ($null -eq $icon) {
    exit 1
  }

  $bitmap = $icon.ToBitmap()
  $stream = New-Object System.IO.MemoryStream
  $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)

  [Convert]::ToBase64String($stream.ToArray())
  exit 0
} catch {
  exit 1
}
