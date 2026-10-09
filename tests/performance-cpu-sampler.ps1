param([string]$Repo='D:\OneDrive\AiPrograms\tools\zotero-margin-fit',[string]$CsvName='perf-cpu-samples.csv')
$ErrorActionPreference='SilentlyContinue'
$repo=$Repo
$out=Join-Path $repo ('.test-harness\'+$CsvName)
'Time,Phase,CpuSeconds,PrivateMB,ProcCount' | Set-Content -LiteralPath $out -Encoding ascii
$ids=@()
$launch=Get-Date
$end=(Get-Date).AddSeconds(85)
$observed=$false
while((Get-Date) -lt $end){
  $phaseFiles=@(Get-ChildItem -LiteralPath (Join-Path $repo '.test-harness') -Filter perf-phase.json -Recurse -File | Sort-Object LastWriteTime -Descending)
  if(!$phaseFiles.Count){Start-Sleep -Milliseconds 300;continue}
  $f=$phaseFiles[0]
  if($f.LastWriteTime -le $launch){Start-Sleep -Milliseconds 200;continue}
  $observed=$true
  $info=Get-Content -LiteralPath $f.FullName -Raw | ConvertFrom-Json
  if($info.phase -eq 'done' -and $observed){break}
  if(!$ids.Count){
    $profile=Join-Path $f.DirectoryName 'profile'
    $procs=@(Get-CimInstance Win32_Process -Filter "name='zotero.exe'")
    $parent=@($procs | Where-Object {$_.CommandLine -and $_.CommandLine.Contains($profile)})
    $ids=@($parent | ForEach-Object {[int]$_.ProcessId})
    $changed=$true
    while($changed) {
      $changed=$false
      foreach($item in $procs) {
        if(($ids -contains [int]$item.ParentProcessId) -and !($ids -contains [int]$item.ProcessId)){
          $ids+= [int]$item.ProcessId;$changed=$true
        }
      }
    }
  }
  $ps=@($ids|ForEach-Object {Get-Process -Id $_}|Where-Object {$_})
  $cpu=($ps | Measure-Object -Property CPU -Sum).Sum
  $mem=($ps | Measure-Object -Property PrivateMemorySize64 -Sum).Sum / 1MB
  $line=('{0},{1},{2:F4},{3:F2},{4}' -f (Get-Date -Format o),$info.phase,$cpu,$mem,$ps.Count)
  Add-Content -LiteralPath $out -Value $line -Encoding ascii
  Start-Sleep -Milliseconds 250
}
Write-Output ('PERF_CSV='+$out)