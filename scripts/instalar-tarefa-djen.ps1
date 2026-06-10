# instalar-tarefa-djen.ps1 — CPA Advogados
# Registra a tarefa de sincronização DJEN no Agendador do Windows.
# Execute como Administrador.

$NomeTarefa = "CPA-SyncDJEN"
$NodeCmd    = Get-Command node -ErrorAction SilentlyContinue
$NodeExe    = if ($NodeCmd) { $NodeCmd.Source } else { $null }

if (-not $NodeExe) {
  Write-Error "Node.js não encontrado. Instale em https://nodejs.org/"
  exit 1
}

$ScriptPath = Resolve-Path (Join-Path $PSScriptRoot "..\scripts\sync-djen-local.mjs")

# Variáveis de ambiente — preencha antes de rodar
$BaseUrl    = "https://processos.cpaadvogados.com.br"   # <-- substitua pela URL do Vercel
$CronSecret = "76b760b60bd3ee427072911871333fdeff8426443076cd647af9a895d92c2b83"                # <-- substitua pelo CRON_SECRET

$Argumento = "`"$ScriptPath`" --base `"$BaseUrl`" --secret `"$CronSecret`""

# Remove tarefa anterior se existir
Unregister-ScheduledTask -TaskName $NomeTarefa -Confirm:$false -ErrorAction SilentlyContinue

$Acao     = New-ScheduledTaskAction -Execute $NodeExe -Argument $Argumento -WorkingDirectory (Split-Path $ScriptPath)
$Gatilho  = New-ScheduledTaskTrigger -Daily -At "09:00"
$Config   = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -RestartCount 0
$Principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest

Register-ScheduledTask -TaskName $NomeTarefa -Action $Acao -Trigger $Gatilho -Settings $Config -Principal $Principal -Description 'CPA Advogados - Sync DJEN diario' -Force

Write-Host ''
Write-Host ('Tarefa ' + $NomeTarefa + ' instalada!') -ForegroundColor Green
Write-Host '  Executa todo dia as 09:00 (ou assim que o PC ligar, se estava desligado)'
