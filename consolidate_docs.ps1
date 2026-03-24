# PowerShell script to consolidate all .md files into one
$outputFile = "PROJECT_DOCUMENTATION.md"
$mdFiles = Get-ChildItem -Path . -Filter "*.md" -File

# Clear the output file if it exists
if (Test-Path $outputFile) { Remove-Item $outputFile }

foreach ($file in $mdFiles) {
    # Add a header for each file
    Add-Content -Path $outputFile -Value "# $($file.Name)"
    Add-Content -Path $outputFile -Value ""
    # Add the content
    Get-Content $file.FullName | Add-Content -Path $outputFile
    Add-Content -Path $outputFile -Value ""
    Add-Content -Path $outputFile -Value "---"
    Add-Content -Path $outputFile -Value ""
}

Write-Host "Consolidation complete. Output file: $outputFile"