# Registra a Tarefa Agendada que roda o backup dos anexos a cada logon.
# Precisa ser executado como ADMINISTRADOR (a criacao de tarefas exige elevacao).
$ErrorActionPreference = "Stop"
$log = "$env:TEMP\instalar-tarefa-backup.log"
try {
    $user = (whoami).Trim()
    $scriptPath = Join-Path $PSScriptRoot "backup-anexos.ps1"

    $action = New-ScheduledTaskAction -Execute "powershell.exe" `
        -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$scriptPath`""

    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $trigger.Delay = "PT2M"  # espera 2 min apos o logon (rede/OneDrive prontos)

    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
        -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -ExecutionTimeLimit (New-TimeSpan -Hours 1)

    $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited

    Register-ScheduledTask -TaskName "Backup Anexos Gestao Processos" `
        -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
        -Description "Backup off-site dos anexos dos processos para o OneDrive, em pastas por numero. Roda a cada logon (2 min apos)." `
        -Force | Out-Null

    "OK $(Get-Date -Format o) user=$user" | Out-File -FilePath $log -Encoding utf8
} catch {
    "ERRO $(Get-Date -Format o): $($_.Exception.Message)" | Out-File -FilePath $log -Encoding utf8
}