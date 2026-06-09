# instalar-tarefa-djen.ps1 — CPA Advogados
# Registra a tarefa de sincronização DJEN no Agendador do Windows.
# Execute como Administrador.

$NomeTarefa = "CPA-SyncDJEN"
$NodeExe    = (Get-Command node -ErrorAction SilentlyContinue)?.Source

if (-not $NodeExe) {
  Write-Error "Node.js não encontrado. Instale em https://nodejs.org/"
  exit 1
}

$ScriptPath = Resolve-Path (Join-Path $PSScriptRoot "..\scripts\sync-djen-local.mjs")

# Variáveis de ambiente — preencha antes de rodar
$BaseUrl    = "https://SEU-PROJETO.vercel.app"   # <-- substitua pela URL do Vercel
$CronSecret = "SUA-CHAVE-SECRETA"                # <-- substitua pelo CRON_SECRET

Unregister-ScheduledTask -TaskName $NomeTarefa -Confirm:$false -ErrorAction SilentlyContinue

$Env = @(
  New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
)

$Acao = New-ScheduledTaskAction `
  -Execute $NodeExe `
  -Argument "`"$ScriptPath`" --base `"$BaseUrl`" --secret `"$CronSecret`"" `
  -WorkingDirectory (Split-Path $ScriptPath)

$Gatilho1 = New-ScheduledTaskTrigger -AtLogOn
$Gatilho2 = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes 30) `
  -At "06:00" -Daily -RepetitionDuration (New-TimeSpan -Hours 16)

$Config = New-ScheduledTaskSettingsSet `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 10) `
  -RestartCount 2 -RestartInterval (New-TimeSpan -Minutes 5) `
  -StartWhenAvailable

Register-ScheduledTask `
  -TaskName $NomeTarefa `
  -Action $Acao `
  -Trigger $Gatilho1, $Gatilho2 `
  -Settings $Config `
  -Principal (New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest) `
  -Description "CPA Advogados — Sincronização automática de publicações DJEN"

Write-Host ""
Write-Host "Tarefa '$NomeTarefa' instalada!" -ForegroundColor Green
Write-Host "  Executa ao fazer login e a cada 30 min das 06h às 22h"
