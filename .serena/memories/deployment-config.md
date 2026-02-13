# Deployment Configuration - Flent Secured

## Supabase Branch
**IMPORTANT:** All backend deployments MUST go to branch: `v2-backend-dev`

Do NOT deploy to main branch.

## Commands
```bash
# Switch to dev branch
supabase branches switch v2-backend-dev

# Deploy function to dev branch
supabase functions deploy <function-name> --project-ref <ref>

# Apply migration to dev branch
supabase db push --linked
```

## Figma File
- File Key: `HZaVuwWn6B6jOjrmxZ7Kzv`
- Name: Flent Secured v1.2 - Dev
- Total Screens: 100

## Documentation Source of Truth
- PRDs: `/pm-docs/screens/`
- Backend specs: `/pm-docs/specs/BACKEND_DEVELOPMENT_GUIDE.md`
- Gap analysis: `/pm-docs/specs/BACKEND_GAP_ANALYSIS.md`
- Screen list: `/pm-docs/COMPLETE_SCREEN_LIST.md`

## Golden Rules
1. NO design deviations from Figma
2. Production-ready only - no mocks
3. No reward hacking or shortcuts
4. Deploy to v2-backend-dev branch only
5. Use pm-docs as source of truth
