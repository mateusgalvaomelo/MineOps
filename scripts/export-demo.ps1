$ErrorActionPreference = 'Stop'
$exportDirectory = Join-Path $PSScriptRoot '..\data\exports'
New-Item -ItemType Directory -Path $exportDirectory -Force | Out-Null
Invoke-WebRequest -Uri 'http://localhost:3000/api/export' -OutFile (Join-Path $exportDirectory 'mineops-demo.zip')
Write-Output "Synthetic CSV files, XLSX workbook and dictionary saved to $exportDirectory"
