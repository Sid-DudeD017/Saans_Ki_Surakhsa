# Saans G0 Repository Safety Net - Manual Checklist

Before considering G0 complete, manually verify the following outside of code:

## 1. AWS Foundation
- [ ] Ensure AWS SSO or local profile `saans` is configured.
- [ ] Run `aws sts get-caller-identity --profile saans` and verify the expected account ID.
- [ ] Verify that the target region is `ap-south-1`.
- [ ] Ensure **no credentials** (access keys/secret keys) are committed in any file, including `.env.example` or GitHub Actions.
- [ ] Billing alarms and actual infrastructure deployment are **deferred until G7**. Do not create AWS resources now.

## 2. GitHub Foundation
- [ ] Verify `main` branch protection is enabled, requiring pull requests for all merges.
- [ ] Ensure the required status check for pull requests is configured (e.g., matching the CI workflow job name `build-and-test`).
- [ ] Review `.github/CODEOWNERS` to ensure accurate ownership for all major components.

*Note: This checklist ensures we maintain a secure, protected repository before actual application development or infrastructure deployment begins.*
