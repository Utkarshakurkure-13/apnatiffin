Add-Type -AssemblyName System.Device
$watcher = New-Object System.Device.Location.GeoCoordinateWatcher([System.Device.Location.GeoPositionAccuracy]::High)
$watcher.Start()
for ($i = 0; $i -lt 15; $i++) {
    Start-Sleep -Milliseconds 250
    if ($watcher.Status -eq [System.Device.Location.GeoPositionStatus]::Ready) {
        break
    }
}
if ($watcher.Status -eq [System.Device.Location.GeoPositionStatus]::Ready) {
    Write-Output "SUCCESS:$($watcher.Position.Location.Latitude),$($watcher.Position.Location.Longitude),Accuracy:$($watcher.Position.Location.HorizontalAccuracy)"
} else {
    Write-Output "STATUS:$($watcher.Status)"
}
$watcher.Stop()
