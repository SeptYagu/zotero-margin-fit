param([string]$ZoteroPath = 'C:\Program Files\Zotero\zotero.exe')
$ErrorActionPreference = 'Stop'
$projectPath = Split-Path $PSScriptRoot -Parent
$runDirectory = Join-Path $projectPath ('.test-harness\' + [guid]::NewGuid().ToString('N'))
$profileDirectory = Join-Path $runDirectory 'profile'
$dataDirectory = Join-Path $env:LOCALAPPDATA ('Temp\ZoteroMarginFitTests\' + (Split-Path $runDirectory -Leaf) + '\data')
New-Item -ItemType Directory -Path $profileDirectory,$dataDirectory -Force | Out-Null
$resultPath = Join-Path $runDirectory 'result.json'
$xpiPath = & node (Join-Path $projectPath 'scripts\build.cjs')
if ($LASTEXITCODE -ne 0) { throw 'XPI build failed' }
$fixtures = & node (Join-Path $PSScriptRoot 'make-fixtures.cjs')
if ($LASTEXITCODE -ne 0) { throw 'Fixture generation failed' }
$port = 50237
$prefs = [ordered]@{
    'extensions.zotero.dataDir' = $dataDirectory
    'extensions.zotero.useDataDir' = $true
    'extensions.zotero.firstRun2' = $false
    'extensions.zotero.sync.autoSync' = $false
    'extensions.zotero.repository.autoUpdate' = $false
    'extensions.zotero.firstRunGuidance' = $false
    'app.update.auto' = $false
    'app.update.enabled' = $false
    'extensions.update.enabled' = $false
    'extensions.autoDisableScopes' = 0
    'extensions.startupScanScopes' = 15
    'xpinstall.signatures.required' = $false
    'marginfit.integrationProfile' = $true
    'marginfit.integrationResult' = $resultPath
    'marginfit.integrationXPI' = $xpiPath
    'marginfit.integrationFixtures' = $fixtures
    'devtools.debugger.remote-enabled' = $true
    'devtools.debugger.chrome-enabled' = $true
    'devtools.debugger.prompt-connection' = $false
    'devtools.debugger.remote-port' = $port
}
$lines = foreach ($key in $prefs.Keys) {
    $encodedValue = ConvertTo-Json -InputObject $prefs[$key] -Compress
    'user_pref("' + $key + '", ' + $encodedValue + ');'
}
$lines | Set-Content -LiteralPath (Join-Path $profileDirectory 'user.js') -Encoding utf8
$headlessBefore = $env:MOZ_HEADLESS
$peakPrivateBytes = 0L
function Get-TestTreePrivateBytes {
    $allProcesses = @(Get-CimInstance Win32_Process -Filter "name='zotero.exe'")
    $testIds = [System.Collections.Generic.HashSet[int]]::new()
    foreach ($entry in $allProcesses) {
        if ($entry.CommandLine -and $entry.CommandLine.Contains($profileDirectory)) { [void]$testIds.Add([int]$entry.ProcessId) }
    }
    do {
        $previousCount = $testIds.Count
        foreach ($entry in $allProcesses) {
            if ($testIds.Contains([int]$entry.ParentProcessId)) { [void]$testIds.Add([int]$entry.ProcessId) }
        }
    } while ($testIds.Count -gt $previousCount)
    $sum = 0L
    foreach ($testId in $testIds) {
        $testProcess = Get-Process -Id $testId -ErrorAction SilentlyContinue
        if ($testProcess) { $sum += $testProcess.PrivateMemorySize64 }
    }
    return $sum
}
try {
    $env:MOZ_HEADLESS = '1'
    $process = Start-Process -FilePath $ZoteroPath -ArgumentList @('-no-remote', '-profile', ('"' + $profileDirectory + '"'), '-chrome', 'chrome://zotero/content/zoteroPane.xhtml', '-ZoteroDebugText', '-ZoteroSkipBundledFiles', '-debugger') -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runDirectory 'stdout.log') -RedirectStandardError (Join-Path $runDirectory 'stderr.log')
    Write-Output "Test output: $runDirectory"
    $deadline = (Get-Date).AddSeconds(180)
    while ((Get-Date) -lt $deadline -and !(Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort $port -State Listen -ErrorAction SilentlyContinue)) { Start-Sleep -Milliseconds 500 }
    & node (Join-Path $PSScriptRoot 'debugger-driver.cjs') $port (Join-Path $PSScriptRoot 'integration-bootstrap.js')
    if ($LASTEXITCODE -ne 0) { throw 'Could not start isolated test driver.' }
    while ((Get-Date) -lt $deadline -and !(Test-Path -LiteralPath $resultPath)) {
        $peakPrivateBytes = [Math]::Max($peakPrivateBytes,(Get-TestTreePrivateBytes))
        Start-Sleep -Milliseconds 500
    }
    if (!(Test-Path -LiteralPath $resultPath)) { throw "No test result; inspect $runDirectory" }
    $result = Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
    $result.measurements | Add-Member -NotePropertyName processTreePeakPrivateBytesSampled -NotePropertyValue $peakPrivateBytes
    $result.measurements | Add-Member -NotePropertyName nominalMemorySamplingIntervalMs -NotePropertyValue 500
    [System.IO.File]::WriteAllText($resultPath,($result | ConvertTo-Json -Depth 12),[System.Text.UTF8Encoding]::new($false))
    $result | ConvertTo-Json -Depth 8
    if (!$result.passed) { throw $result.error }
}
finally {
    $env:MOZ_HEADLESS = $headlessBefore
    Get-CimInstance Win32_Process -Filter "name='zotero.exe'" |
        Where-Object { $_.CommandLine -and $_.CommandLine.Contains($profileDirectory) } |
        ForEach-Object { Stop-Process -Id $_.ProcessId -ErrorAction SilentlyContinue }
}
