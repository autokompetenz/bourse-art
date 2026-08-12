# Configure les secrets SMTP (Hostinger) de l'Edge Function notify-artist-sale.
# Prérequis : supabase CLI installée + projet lié (supabase link).
# Usage : powershell -ExecutionPolicy Bypass -File scripts\configure-smtp.ps1

$ErrorActionPreference = "Stop"

if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
  Write-Host "ERREUR : la CLI Supabase n'est pas installee." -ForegroundColor Red
  Write-Host "Installation : scoop install supabase  ou  choco install supabase" -ForegroundColor Yellow
  exit 1
}

$projectRef = supabase projects list 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "ERREUR : impossible de lister les projets. Connectez-vous (supabase login) puis liez le projet (supabase link --project-ref asiaqrkldaqotjttmcjd)." -ForegroundColor Red
  exit 1
}

$hostname = Read-Host "SMTP_HOST (defaut: smtp.hostinger.com)"
if (-not $hostname) { $hostname = "smtp.hostinger.com" }

$port = Read-Host "SMTP_PORT (defaut: 465)"
if (-not $port) { $port = "465" }

$user = Read-Host "SMTP_USER (email Hostinger, ex: admin@votredomaine.com)"
$securePass = Read-Host "SMTP_PASSWORD" -AsSecureString
$pass = [System.Net.NetworkCredential]::new("", $securePass).Password

$from = Read-Host "SMTP_FROM (expediteur, ex: Bourse&Art <admin@votredomaine.com>)"
if (-not $from) { $from = $user }

$envFile = Join-Path (Split-Path $PSScriptRoot -Parent) ".env.smtp"

if (Test-Path $envFile) {
  Write-Host "Utilisation du fichier $envFile (remplis-le puis relance)." -ForegroundColor Cyan
  $lines = Get-Content -LiteralPath $envFile | Where-Object { $_ -match "^\s*[A-Za-z_][A-Za-z0-9_]*=" }
  $values = @{}
  foreach ($line in $lines) {
    $key, $rest = $line -split "=", 2
    $values[$key.Trim()] = $rest.Trim()
  }
  $hostname = if ($values["SMTP_HOST"]) { $values["SMTP_HOST"] } else { "smtp.hostinger.com" }
  $port = if ($values["SMTP_PORT"]) { $values["SMTP_PORT"] } else { "465" }
  $user = $values["SMTP_USER"]
  $pass = $values["SMTP_PASSWORD"]
  $from = if ($values["SMTP_FROM"]) { $values["SMTP_FROM"] } else { $user }
  if (-not $user -or -not $pass) {
    Write-Host "ERREUR : SMTP_USER et SMTP_PASSWORD doivent etre remplis dans $envFile" -ForegroundColor Red
    exit 1
  }
} else {
  $hostname = Read-Host "SMTP_HOST (defaut: smtp.hostinger.com)"
  if (-not $hostname) { $hostname = "smtp.hostinger.com" }

  $port = Read-Host "SMTP_PORT (defaut: 465)"
  if (-not $port) { $port = "465" }

  $user = Read-Host "SMTP_USER (email Hostinger, ex: admin@votredomaine.com)"
  $securePass = Read-Host "SMTP_PASSWORD" -AsSecureString
  $pass = [System.Net.NetworkCredential]::new("", $securePass).Password

  $from = Read-Host "SMTP_FROM (expediteur, ex: Bourse&Art <admin@votredomaine.com>)"
  if (-not $from) { $from = $user }
}

$tmpEnv = Join-Path ([System.IO.Path]::GetTempPath()) "supabase-smtp-$([guid]::NewGuid()).env"
@(
  "SMTP_HOST=$hostname",
  "SMTP_PORT=$port",
  "SMTP_USER=$user",
  "SMTP_PASSWORD=$pass",
  "SMTP_FROM=$from"
) | Set-Content -Path $tmpEnv -Encoding UTF8

try {
  Write-Host "Envoi des secrets vers Supabase..." -ForegroundColor Cyan
  supabase secrets set --env-file $tmpEnv
  if ($LASTEXITCODE -ne 0) {
    Write-Host "ERREUR lors de la configuration des secrets." -ForegroundColor Red
    exit 1
  }
  Write-Host "Secrets SMTP configures avec succes." -ForegroundColor Green

  $deploy = Read-Host "Deployer la fonction notify-artist-sale maintenant ? (o/N)"
  if ($deploy -match "^(o|O|y|Y|oui)$") {
    supabase functions deploy notify-artist-sale
    if ($LASTEXITCODE -eq 0) {
      Write-Host "Fonction notifee : deployment OK." -ForegroundColor Green
    }
  }
} finally {
  if (Test-Path $tmpEnv) {
    Remove-Item -LiteralPath $tmpEnv -Force
    Write-Host "Fichier temporaire des secrets supprime." -ForegroundColor DarkGray
  }
}
