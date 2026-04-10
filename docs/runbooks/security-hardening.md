# Security Hardening Runbook (Phase 6)

## Scope
- Pod security hardening
- Service account least privilege
- Network isolation
- Image signing and verification
- Secret rotation operations

## Kubernetes hardening apply order
1. `kubectl apply -f deploy/k8s/namespace.yaml`
2. `kubectl apply -f deploy/k8s/configmap.yaml`
3. `kubectl apply -f deploy/k8s/secret.yaml`
4. `kubectl apply -f deploy/k8s/serviceaccount.yaml -f deploy/k8s/role.yaml -f deploy/k8s/rolebinding.yaml`
5. `kubectl apply -f deploy/k8s/deployment.yaml -f deploy/k8s/service.yaml -f deploy/k8s/hpa.yaml -f deploy/k8s/pdb.yaml -f deploy/k8s/ingress.yaml`
6. `kubectl apply -f deploy/k8s/networkpolicy.yaml`
7. Optional (Kyverno installed): `kubectl apply -f deploy/k8s/kyverno-verify-images.yaml`

## Secret rotation
- Use GitHub workflow: `Rotate Kubernetes Secrets`
- Or run manually:
  - export `DATABASE_URL`
  - optional `VECTOR_ENDPOINT`, `VECTOR_API_KEY`
  - `bash deploy/scripts/rotate-secrets.sh`

## Signed image verification
- Release workflow signs image via cosign keyless.
- Verify manually:
  - `cosign verify --certificate-oidc-issuer https://token.actions.githubusercontent.com --certificate-identity-regexp "https://github.com/<org>/<repo>/.github/workflows/release.yml@.*" ghcr.io/<org>/<repo>@<digest>`

## Post-deploy checks
- `kubectl -n nexus-ai get pods`
- `kubectl -n nexus-ai describe networkpolicy nexus-backend-restrict`
- `curl https://<api-host>/health`
- `curl https://<api-host>/v4/slo`
