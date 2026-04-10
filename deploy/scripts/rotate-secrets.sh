#!/usr/bin/env bash
set -euo pipefail

NAMESPACE=${NAMESPACE:-nexus-ai}
SECRET_NAME=${SECRET_NAME:-nexus-secrets}

required=(DATABASE_URL)
for key in "${required[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    echo "Missing required env var: $key"
    exit 1
  fi
done

kubectl -n "$NAMESPACE" create secret generic "$SECRET_NAME" \
  --from-literal=DATABASE_URL="$DATABASE_URL" \
  --from-literal=VECTOR_ENDPOINT="${VECTOR_ENDPOINT:-}" \
  --from-literal=VECTOR_API_KEY="${VECTOR_API_KEY:-}" \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl -n "$NAMESPACE" rollout restart deploy/nexus-backend
kubectl -n "$NAMESPACE" rollout status deploy/nexus-backend --timeout=120s

echo "Secret rotation completed for $SECRET_NAME in $NAMESPACE"
