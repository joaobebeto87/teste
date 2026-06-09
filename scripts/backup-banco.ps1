<#
.SYNOPSIS
    Backup off-site do BANCO DE DADOS para o OneDrive.

.DESCRIPTION
    1) Pede ao sistema para gerar um novo snapshot do banco (POST /api/cron/backup).
    2) Baixa esse arquivo .db para <Dest> (por padrao dentro do OneDrive).
    Mantem localmente os ultimos -KeepLocal arquivos (poda os mais antigos).

.PARAMETER BaseUrl     URL do sistema (ou env GP_BASE_URL).
.PARAMETER CronSecret  Valor do CRON_SECRET (ou env GP_CRON_SECRET).
.PARAMETER Dest        Pasta de destino. Padrao: <OneDrive>\Backups\Banco
.PARAMETER KeepLocal   Quantos backups manter localmente (padrao 30).
#>

[CmdletBinding()]
param(
    [string]$BaseUrl    = $env:GP_BASE_URL,
    [string]$CronSecret = $env:GP_CRON_SECRET,
    [string]$Dest       = (Join-Path ([Environment]::GetFolderPath('UserProfile')) 'OneDrive\Backups\Banco'),
    [int]$KeepLocal     = 30
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($BaseUrl))    { throw "Informe -BaseUrl ou defina GP_BASE_URL." }
if ([string]::IsNullOrWhiteSpace($CronSecret)) { throw "Informe -CronSecret ou defina GP_CRON_SECRET." }

$BaseUrl = $BaseUrl.TrimEnd('/')
$headers = @{ 'x-cron-secret' = $CronSecret }

Write-Host "==> Backup do banco" -ForegroundColor Cyan
Write-Host "    Origem : $BaseUrl"
Write-Host "    Destino: $Dest"

# 1) Gera um novo snapshot no servidor e recebe o nome do arquivo
try {
    $resp = Invoke-WebRequest -Uri "$BaseUrl/api/cron/backup" -Headers $headers -Method Post -UseBasicParsing
    $json = [System.Text.Encoding]::UTF8.GetString($resp.RawContentStream.ToArray()) | ConvertFrom-Json
} catch {
    throw "Falha ao gerar o backup: $($_.Exception.Message)"
}
$filename = $json.filename
if ([string]::IsNullOrWhiteSpace($filename)) { throw "O servidor nao retornou o nome do backup." }
Write-Host "    Snapshot gerado: $filename ($([math]::Round($json.size/1KB,1)) KB)" -ForegroundColor Gray

# 2) Baixa o arquivo para o destino
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
$destFile = Join-Path $Dest $filename
if (Test-Path $destFile) {
    Write-Host "    Ja existe localmente, nada a baixar." -ForegroundColor Gray
} else {
    $tmp = "$destFile.partial"
    try {
        Invoke-WebRequest -Uri "$BaseUrl/api/backup/download?file=$filename" -Headers $headers -Method Get -OutFile $tmp -UseBasicParsing
        Move-Item -Force -Path $tmp -Destination $destFile
        Write-Host "    [novo] $filename baixado." -ForegroundColor Green
    } catch {
        if (Test-Path $tmp) { Remove-Item -Force $tmp -ErrorAction SilentlyContinue }
        throw "Falha ao baixar o backup: $($_.Exception.Message)"
    }
}

# 3) Poda local: mantem os $KeepLocal mais recentes
$todos = Get-ChildItem -Path $Dest -Filter 'gestao-*.db' | Sort-Object LastWriteTime -Descending
if ($todos.Count -gt $KeepLocal) {
    $todos | Select-Object -Skip $KeepLocal | ForEach-Object {
        Remove-Item -Force $_.FullName -ErrorAction SilentlyContinue
    }
}

Write-Host "==> Concluido. Backups locais: $((Get-ChildItem -Path $Dest -Filter 'gestao-*.db').Count)" -ForegroundColor Cyan
