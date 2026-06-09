<#
.SYNOPSIS
    Backup off-site dos anexos dos processos para o OneDrive, em pastas por numero.

.DESCRIPTION
    Le o manifesto de anexos da aplicacao (em producao ou local) e baixa cada
    arquivo para  <Dest>\<numero-do-processo>\<nome-do-arquivo>.
    Como o destino padrao fica dentro do OneDrive, a sincronizacao da nuvem leva
    a copia para fora do servidor (backup off-site real).

    E incremental e ADITIVO: so baixa arquivos que faltam ou cujo tamanho mudou,
    e NUNCA apaga nada local (seguro para usar como backup).

.PARAMETER BaseUrl
    URL base da aplicacao. Ex.: https://gestao.suacidade.gov.br
    Tambem pode vir da variavel de ambiente GP_BASE_URL.

.PARAMETER CronSecret
    Valor do CRON_SECRET configurado na aplicacao (autentica o backup).
    Tambem pode vir da variavel de ambiente GP_CRON_SECRET.

.PARAMETER Dest
    Pasta de destino. Padrao: <OneDrive>\Backups\Anexos Processos

.EXAMPLE
    .\backup-anexos.ps1 -BaseUrl "https://gestao.exemplo.gov.br" -CronSecret "xxx"

.EXAMPLE
    # Usando variaveis de ambiente (recomendado para Agendador de Tarefas)
    $env:GP_BASE_URL = "https://gestao.exemplo.gov.br"
    $env:GP_CRON_SECRET = "xxx"
    .\backup-anexos.ps1
#>

[CmdletBinding()]
param(
    [string]$BaseUrl   = $env:GP_BASE_URL,
    [string]$CronSecret = $env:GP_CRON_SECRET,
    [string]$Dest       = (Join-Path ([Environment]::GetFolderPath('UserProfile')) 'OneDrive\Backups\Anexos Processos')
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    throw "Informe -BaseUrl ou defina a variavel de ambiente GP_BASE_URL."
}
if ([string]::IsNullOrWhiteSpace($CronSecret)) {
    throw "Informe -CronSecret ou defina a variavel de ambiente GP_CRON_SECRET."
}

$BaseUrl = $BaseUrl.TrimEnd('/')
$headers = @{ 'x-cron-secret' = $CronSecret }

Write-Host "==> Backup de anexos" -ForegroundColor Cyan
Write-Host "    Origem : $BaseUrl"
Write-Host "    Destino: $Dest"

# 1) Busca o manifesto.
#    Le os bytes crus e decodifica como UTF-8 explicitamente: o Windows
#    PowerShell 5.1 assume ISO-8859-1 quando o charset nao vem no Content-Type,
#    o que corromperia acentos nos nomes (ex.: "Petição" -> "PetiÃ§Ã£o").
try {
    $resp = Invoke-WebRequest -Uri "$BaseUrl/api/backup/anexos/manifest" -Headers $headers -Method Get -UseBasicParsing
    $json = [System.Text.Encoding]::UTF8.GetString($resp.RawContentStream.ToArray())
    $manifest = $json | ConvertFrom-Json
} catch {
    throw "Falha ao obter o manifesto: $($_.Exception.Message)"
}

Write-Host "    Manifesto: $($manifest.totalProcesses) processo(s), $($manifest.totalFiles) anexo(s)." -ForegroundColor Gray

New-Item -ItemType Directory -Force -Path $Dest | Out-Null

$baixados = 0
$pulados  = 0
$erros    = 0

foreach ($proc in $manifest.processes) {
    $procDir = Join-Path $Dest $proc.folder
    New-Item -ItemType Directory -Force -Path $procDir | Out-Null

    foreach ($file in $proc.files) {
        $destFile = Join-Path $procDir $file.name

        # Pula se ja existe com o mesmo tamanho
        if (Test-Path $destFile) {
            $localSize = (Get-Item $destFile).Length
            if ($localSize -eq $file.size) { $pulados++; continue }
        }

        $tmp = "$destFile.partial"
        try {
            Invoke-WebRequest -Uri "$BaseUrl/api/backup/anexos/file?id=$($file.id)" `
                -Headers $headers -Method Get -OutFile $tmp -UseBasicParsing
            Move-Item -Force -Path $tmp -Destination $destFile
            $baixados++
            Write-Host "    [novo] $($proc.folder)\$($file.name)" -ForegroundColor Green
        } catch {
            $erros++
            Write-Warning "    [erro] $($proc.folder)\$($file.name): $($_.Exception.Message)"
            if (Test-Path $tmp) { Remove-Item -Force $tmp -ErrorAction SilentlyContinue }
        }
    }
}

Write-Host ""
Write-Host "==> Concluido: $baixados baixado(s), $pulados ja existente(s), $erros erro(s)." -ForegroundColor Cyan
if ($erros -gt 0) { exit 1 }
