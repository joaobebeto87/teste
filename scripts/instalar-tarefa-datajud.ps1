# instalar-tarefa-datajud.ps1 — CPA Advogados
# Instala a tarefa agendada CPA-SyncDatajud no Windows Task Scheduler.
# Execute como Administrador.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File scripts\instalar-tarefa-datajud.ps1
#
# A tarefa roda diariamente às 09:30 (30 min depois do sync DJEN às 09:00).

param(
    [string]$BaseUrl    = "https://processos.cpaadvogados.com.br",
    [string]$CronSecret = "",
    [string]$HoraInicio = "09:30"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ScriptPath = Join-Path $ScriptDir "sync-datajud-local.mjs"

if (-not (Test-Path $ScriptPath)) {
    Write-Error "Script nao encontrado: $ScriptPath"
    exit 1
}

if ([string]::IsNullOrEmpty($CronSecret)) {
    Write-Error "Informe o CRON_SECRET: -CronSecret 'SEU_SEGREDO'"
    exit 1
}

# Verificar se o Node.js está disponível
$NodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $NodeCmd) {
    Write-Error "Node.js nao encontrado. Instale de https://nodejs.org/"
    exit 1
}
$NodePath = $NodeCmd.Source
Write-Host "Node.js encontrado: $NodePath"

# Montar comando
$Cmd = "node `"$ScriptPath`" --base `"$BaseUrl`" --secret `"$CronSecret`""
$Action = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c `"$Cmd`" > `"%TEMP%\cpa-sync-datajud.log`" 2>&1"

$Trigger  = New-ScheduledTaskTrigger -Daily -At $HoraInicio
$Settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
    -MultipleInstances IgnoreNew `
    -StartWhenAvailable `
    -WakeToRun:$false

$Principal = New-ScheduledTaskPrincipal `
    -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
    -LogonType Interactive `
    -RunLevel Highest

$TaskName = "CPA-SyncDatajud"

# Remover tarefa anterior se existir
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Principal $Principal `
    -Description "CPA Advogados - Sincronizacao diaria de andamentos processuais via Datajud" `
    -Force | Out-Null

Write-Host ""
Write-Host "=========================================="
Write-Host "Tarefa '$TaskName' instalada com sucesso!"
Write-Host "  Horario : todos os dias as $HoraInicio"
Write-Host "  Log     : %TEMP%\cpa-sync-datajud.log"
Write-Host "=========================================="
Write-Host ""
Write-Host "Para testar agora:"
Write-Host "  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host ""
