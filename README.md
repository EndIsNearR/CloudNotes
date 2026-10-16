# Azure SQL Notes: App Service + Azure SQL via Bicep and GitHub Actions

## Layout
- `app/` : Node.js (Express + mssql) app. Reads `SQL_CONNECTION_STRING` from environment.
- `infra/main.bicep` : SQL Server, SQL Database, App Service Plan, App Service.
- `.github/workflows/deploy.yml` : create resources, get connection string, deploy app, test.

## One-time Azure setup (OIDC, no stored Azure password)
```bash
SUB=$(az account show --query id -o tsv)
az ad app create --display-name gh-deploy-webapp --query appId -o tsv      # -> APP_ID
az ad sp create --id <APP_ID>
az role assignment create --assignee <APP_ID> --role Contributor --scope /subscriptions/$SUB
az ad app federated-credential create --id <APP_ID> --parameters '{
  "name": "github-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:<GITHUB_USER>/<REPO>:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"]
}'
```

## GitHub settings (Settings > Secrets and variables > Actions)
Secrets: `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `SQL_ADMIN_LOGIN`, `SQL_ADMIN_PASSWORD`
Variables: `AZURE_RESOURCE_GROUP` (e.g. `rg-student-webapp`), `AZURE_LOCATION` (e.g. `eastus`)

The SQL password must be 8+ characters with three of: upper, lower, digit, symbol. Avoid `'` in it.

## Run
Push to `main` (or run the workflow manually). Open the URL printed by the Bicep output / Azure Portal.

## Clean up
`az group delete --name <RESOURCE_GROUP> --yes`
