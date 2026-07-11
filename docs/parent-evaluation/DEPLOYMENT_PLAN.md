# Deployment Plan — Google Apps Script

## Source

Repository: `anuchit1tube168-cmd/RTAFNC-Evaluation-Analyzer`

Source directory: `google-apps-script/`

Deployment ID: stored in workflow secret with current default fallback

## Automated Flow

```text
push main (google-apps-script/** or workflow)
→ checkout
→ setup Node
→ run parent evaluation validation gate
→ copy .gs/.html/appsscript.json to gas-dist
→ append sorted ZZ_*.gs to Code.gs last
→ clasp push --force
→ redeploy existing deployment ID
→ fail workflow on deployment error text
```

## Required Secrets

- `CLASP_JSON`
- `CLASPRC_JSON`
- `APPS_SCRIPT_DEPLOYMENT_ID` (recommended)

## Pre-deploy Gate

Run:

```bash
python3 scripts/validate_parent_evaluation.py
```

Must pass:

- required files
- skill/spec templates
- JavaScript syntax
- route markers
- schema safety
- manifest scopes

## Runtime Verification

After deployment:

1. Open `/exec`
2. Confirm Modern Dashboard and `แผนกปกครอง วพอ.พอ.`
3. Open `/exec?mode=parent`
4. Open `/exec?mode=upload`
5. Run Health
6. Run Self Test
7. Run Diagnostic with authorized admin session
8. Confirm version `parent-evaluation-v1.3.0`
9. Test public response
10. Test PDF output

## Manual Fallback

When workflow fails:

1. Download repository ZIP
2. Open existing Apps Script project
3. Create/update all `.gs` and `.html` files from `google-apps-script/`
4. Ensure `Parent_Evaluation_Helpers.gs` exists
5. Copy `appsscript.json`
6. Do not merge/remove files manually unless documented
7. Run Self Test
8. Run Diagnostic
9. Deploy → Manage deployments → Edit existing deployment → New version
10. Verify all three routes

## Rollback

1. Identify last runtime-PASS commit
2. Revert failing commit or reset branch through approved change
3. Run validation gate
4. Redeploy same deployment ID
5. Verify routes and Diagnostic
6. Record rollback receipt

## Evidence Receipt

Store:

- commit SHA
- workflow run URL/log
- deployment description/version
- live URL
- screenshots desktop/mobile
- Self Test JSON
- Diagnostic JSON
- sample PDF URL
- rollback commit
- known risks

## Release Status

- Static PASS alone = REVIEW
- Workflow PASS but runtime unverified = REVIEW
- Runtime + Diagnostic + visual PDF check + evidence = PASS
