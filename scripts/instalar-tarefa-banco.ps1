# Registra a Tarefa Agendada que roda o backup do BANCO a cada logon.
# Precisa ser executado como ADMINISTRADOR (a criacao de tarefas exige elevacao).
$ErrorActionPreference = "Stop"
$log = "$env:TEMP\instalar-tarefa-banco.log"
try {
    $user = (whoami).Trim()
    $scriptPath = Join-Path $PSScriptRoot "backup-banco.ps1"

    $action = New-ScheduledTaskAction -Execute "powershell.exe" `
        -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""

    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $trigger.Delay = "PT3M"  # 3 min apos o logon (depois do backup de anexos)

    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
        -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -ExecutionTimeLimit (New-TimeSpan -Hours 1)

    $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited

    Register-ScheduledTask -TaskName "Backup Banco Gestao Processos" `
        -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
        -Description "Backup off-site do banco de dados para o OneDrive. Roda a cada logon (3 min apos)." `
        -Force | Out-Null

    "OK $(Get-Date -Format o) user=$user" | Out-File -FilePath $log -Encoding utf8
} catch {
    "ERRO $(Get-Date -Format o): $($_.Exception.Message)" | Out-File -FilePath $log -Encoding utf8
}