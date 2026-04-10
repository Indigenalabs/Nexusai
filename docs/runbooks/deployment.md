# Deployment Runbook

## Prerequisites
- Container registry access
- Kubernetes cluster access
- Secrets prepared from `deploy/k8s/secret.example.yaml`

## Build and push
1. `docker build -t ghcr.io/<org>/nexus-ai-run:<tag> .`
2. `docker push ghcr.io/<org>/nexus-ai-run:<tag>`

## Deploy
1. `kubectl apply -f deploy/k8s/namespace.yaml`
2. `kubectl apply -f deploy/k8s/configmap.yaml`
3. `kubectl apply -f deploy/k8s/secret.yaml`
4. Update image tag in `deploy/k8s/deployment.yaml`
5. `kubectl apply -f deploy/k8s/deployment.yaml -f deploy/k8s/service.yaml -f deploy/k8s/hpa.yaml -f deploy/k8s/pdb.yaml -f deploy/k8s/ingress.yaml`

## Validate
1. `kubectl -n nexus-ai get pods`
2. `kubectl -n nexus-ai logs deploy/nexus-backend --tail=100`
3. Check `/health`, `/v4/slo`, `/v4/observability`
