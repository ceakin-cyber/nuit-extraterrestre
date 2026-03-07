$KEY="4499935ec87d3efff30b32ee5b221c6e"

$root = (Get-Location).Path

Get-ChildItem -Recurse -File |
Where-Object {
  $_.FullName -notmatch '\\node_modules\\' -and
  $_.Name -ne 'package-lock.json'
} |
ForEach-Object {
  $rel = $_.FullName.Substring($root.Length + 1).Replace('\','/')
  Write-Host "Uploading $rel"
  curl.exe -H "Authorization: Bearer $KEY" -F "$rel=@$($_.FullName)" https://neocities.org/api/upload | Out-Host
}