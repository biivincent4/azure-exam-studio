param(
    [Parameter(Mandatory = $true)]
    [string] $SubscriptionId,
    [string] $ResourceGroup = "rg-exam-studio-69256d28",
    [string] $AppName = "exam-studio-69256d28",
    [string] $Location = "eastus2"
)

$ErrorActionPreference = "Stop"
foreach ($tool in @("az", "swa", "node")) {
    Get-Command $tool -ErrorAction Stop | Out-Null
}

node (Join-Path $PSScriptRoot "stage.mjs")
if ($LASTEXITCODE -ne 0) { throw "Staging failed; nothing was deployed." }

az group create --name $ResourceGroup --location $Location --subscription $SubscriptionId --tags purpose=certification-practice --output none --only-show-errors
if ($LASTEXITCODE -ne 0) { throw "Resource group creation failed. Resolve the Azure sign-in/MFA or policy error before retrying." }

$sitesJson = az staticwebapp list --resource-group $ResourceGroup --subscription $SubscriptionId --output json --only-show-errors
if ($LASTEXITCODE -ne 0) { throw "Could not check the target static web app." }
$site = @($sitesJson | ConvertFrom-Json) | Where-Object { $_.name -eq $AppName }
if ($site) {
    if ($site.sku.name -ne "Free") { throw "The target app is not on the approved Free plan; refusing to change or deploy it." }
} else {
    $siteJson = az staticwebapp create --name $AppName --resource-group $ResourceGroup --location $Location --sku Free --subscription $SubscriptionId --output json --only-show-errors
    if ($LASTEXITCODE -ne 0) { throw "Free Static Web App creation failed; deployment has stopped." }
    $site = $siteJson | ConvertFrom-Json
}
if ($site.sku.name -ne "Free" -or -not $site.defaultHostname) {
    throw "Azure did not return the expected Free app and hostname; deployment has stopped."
}

$previousToken = $env:SWA_CLI_DEPLOYMENT_TOKEN
try {
    $env:SWA_CLI_DEPLOYMENT_TOKEN = az staticwebapp secrets list --name $AppName --resource-group $ResourceGroup --subscription $SubscriptionId --query properties.apiKey --output tsv --only-show-errors
    if ($LASTEXITCODE -ne 0 -or -not $env:SWA_CLI_DEPLOYMENT_TOKEN) {
        throw "Could not obtain a deployment token. No content was uploaded."
    }
    # Keep the deployment credential out of command arguments, output and files.
    swa deploy (Join-Path $PSScriptRoot ".azure-publish") --env production --app-name $AppName --resource-group $ResourceGroup --subscription-id $SubscriptionId --no-use-keychain
    if ($LASTEXITCODE -ne 0) { throw "Static content deployment failed. Do not configure the redirect until the site is verified." }
} finally {
    $env:SWA_CLI_DEPLOYMENT_TOKEN = $previousToken
}

$url = "https://$($site.defaultHostname)/"
$response = Invoke-WebRequest $url -UseBasicParsing
if ($response.StatusCode -ne 200 -or $response.Content -notmatch "Azure Exam Studio") {
    throw "Azure returned unexpected homepage content. Do not configure the Cloudflare redirect."
}
Write-Output "Website URL: $url"
Write-Output "Verify the interactive question bank at this URL before enabling a Cloudflare redirect."
