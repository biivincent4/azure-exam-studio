# Azure Exam Studio

Independent practice website for AI-103, AI-200 and AI-500. Includes 450 original
multiple-choice scenarios (150 per exam), explanations and official Microsoft Learn
references. All 35 study modules have multiple scenarios, but this bank is
not exhaustive syllabus coverage, official exam material, or a readiness test.
Questions are original learning content, not copied from practice assessments.

| Certification | Available practice questions |
| --- | ---: |
| AI-103: Apps and Agents Developer | 150 |
| AI-200: AI Cloud Developer | 150 |
| AI-500: Multi-Agent AI Solutions | 150 |
| **Total** | **450** |

This is a self-paced practice bank, not a timed exam simulator. All 150 questions
for the selected certification are available; domain, status and search filters
narrow the list. Microsoft says most certification exams contain 40-60 questions,
but actual counts vary: see [exam duration and experience](https://learn.microsoft.com/en-us/credentials/support/exam-duration-exam-experience).
The bank size is not a prediction of the number or content on a real exam.

## Run locally

No runtime dependencies, model, subscription or API keys are needed. Open a
terminal in the repository root (the `exam-practice` folder in the original workspace):

```powershell
npm start
```

Open http://127.0.0.1:4173. Use another terminal for checks:

```powershell
npm test
```

Choose a certification, filter by domain/status, and answer before reading the
explanation. Progress and bookmarks are stored in localStorage on this browser
and origin; they do not sync across devices or from localhost to Azure.
Accuracy uses the latest saved answer, not first-attempt or weighted exam scoring.
Try again removes that answer and its bookmark. Reset asks for confirmation.
Unavailable/corrupt browser storage displays a warning; there is no cloud backup.
The original 45 question IDs and answer choices are preserved, so existing saved
answers remain compatible with the expanded bank.

## GitHub Actions

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| Website checks | Main pushes, pull requests, manual | Validate all 450 questions, progress handling, HTTP serving and public asset staging. |
| Deploy to Azure | Manual on main; main pushes when enabled | Test, stage the public site, deploy to Azure Static Web Apps and verify the HTTPS homepage. |

Both workflows use pinned official action revisions and read-only GitHub
permissions. Pull requests never receive an Azure deployment credential.
Only the nine staged public assets are uploaded, not the repository or source
workspace. The frontend and checks need no package installation.

### Configure Azure deployment

1. Create a **Free Azure Static Web App**, using the local deployment script
   below or the Azure portal. Azure authorization and MFA requirements must be
   satisfied; these workflows do not create resources or bypass Azure policy.
2. In GitHub, create the **azure-production** environment and restrict its
   deployment branches to **main**. Add required reviewers if appropriate.
3. Retrieve the app's deployment token from the Azure portal and save it as the
   environment secret **AZURE_STATIC_WEB_APPS_API_TOKEN**. Never commit the token
   or paste it into an issue, discussion or workflow file.
4. Run **Actions > Deploy to Azure > Run workflow** on **main**.
5. After a successful deployment, optionally set the repository Actions
   variable **AZURE_DEPLOYMENT_ENABLED** to **true** to deploy future main pushes.

Automatic deployment is disabled until explicitly enabled. Manually triggering
deployment without the secret fails with an explicit configuration error.
Website checks still run without any Azure account. The deployment workflow
uses the token for one existing Static Web App; it does not provision paid tiers,
databases, Azure identities or Cloudflare rules.

## Azure hosting and optional path redirect

A path such as `https://example.com/certifications` can redirect to the deployed
Azure HTTPS website without moving the existing homepage. The address bar
changes to the Azure URL; this is not a reverse proxy or custom-domain binding.

### Deploy to the Free Azure plan

Complete your own Azure CLI browser/device sign-in and MFA first; do not share
passwords, deployment tokens or MFA codes. `az account show` succeeding is not
proof that Azure will permit resource creation.

With Azure CLI, SWA CLI and Node installed, run:

```powershell
.\deploy.ps1 -SubscriptionId "<approved subscription ID>"
```

The script stages only the public assets in `.azure-publish`, reuses the target
resource group and Free app (creating them only if missing), keeps its deployment token in the child
process environment, deploys to production, and checks homepage content. It
stops on Azure errors and refuses an existing non-Free app. It does not configure
Cloudflare, upgrade plans or create a database. `.azure-publish` is generated
output, not the source folder.

Before enabling the redirect, open the returned Azure URL and verify all three
question banks, answer feedback and persistence. User progress is origin-local:
localhost progress will not appear at the Azure hostname.

### Add only the Cloudflare redirect

In the Cloudflare dashboard, select **your domain > Rules > Overview > Create rule >
Redirect Rule**. Choose **Custom filter expression**, not all incoming requests:

```text
(http.host eq "example.com" and
 http.request.method in {"GET" "HEAD"} and
 http.request.uri.path in {"/certifications" "/certifications/"})
```

Replace `example.com` with the actual domain. Use a **static** target equal to the verified Azure HTTPS root URL, including
its trailing slash. Start with **302** (temporary), with **Preserve query string**
off. This matches the entry page only, not other pages, APIs or
`/certifications-other`. No placeholder Azure URL should be activated.

Cloudflare Single Redirects require the source hostname to be **already proxied**
by Cloudflare. If the hostname is DNS-only, stop and review the existing hosting before
changing proxy status. Do not change A, AAAA or CNAME targets, nameservers, SSL
mode, existing rules or the homepage. Review existing redirect-rule ordering
before adding a rule.

Verify that `/certifications` and `/certifications/` return 302 with the Azure
URL in `Location`, the Azure page loads correctly, and the homepage and an
existing unrelated page behave as before. Rollback is disabling just this new
redirect rule. See [Cloudflare Single Redirects](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/create-dashboard/).

### Publishing scope

This is a static site: publish ONLY index.html, styles.css, app.js, core.js,
questions.js, bank-ai103.js, bank-ai200.js, bank-ai500.js and (for Azure Static
Web Apps) staticwebapp.config.json. The three bank modules are required by
questions.js. Do not upload the parent certifications folder, SQLite files,
virtual environments, personal preparation notes or Azure credentials.

The approved Azure Free plan is a public study site, not a production SLA or
authenticated assessment service. Security headers are supplied by
staticwebapp.config.json; answers remain downloadable by design. Do not upgrade
to paid tiers or add other Azure services without separate approval.
