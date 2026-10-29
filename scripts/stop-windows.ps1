# Stops and removes the Prelegal container.
if (docker ps -aq --filter "name=^prelegal$") {
    docker rm -f prelegal | Out-Null
    Write-Host "Prelegal stopped"
} else {
    Write-Host "Prelegal was not running"
}
