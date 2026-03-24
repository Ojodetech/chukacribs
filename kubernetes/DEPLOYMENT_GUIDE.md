# Kubernetes Deployment Guide - Chuka Cribs

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Cluster Setup](#cluster-setup)
3. [Image Registry Setup](#image-registry-setup)
4. [Deployment](#deployment)
5. [Configuration](#configuration)
6. [Monitoring](#monitoring)
7. [Scaling](#scaling)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software
- **kubectl** (v1.24+): Kubernetes command-line tool
- **Docker**: Container runtime for building and pushing images
- **Helm** (optional): Package manager for Kubernetes
- **git**: Version control system

### Required Knowledge
- Basic Kubernetes concepts (Pods, Deployments, Services)
- Container orchestration basics
- kubectl commands

### System Requirements
- Kubernetes cluster (v1.24+)
- Minimum 6GB RAM across cluster
- Minimum 10GB disk space for databases
- LoadBalancer or Ingress controller configured

### Installation

#### kubectl
```bash
# macOS
brew install kubectl

# Linux
sudo apt-get update && sudo apt-get install -y kubectl

# Windows
choco install kubernetes-cli
# Or download from https://kubernetes.io/docs/tasks/tools/
```

#### Docker
```bash
# Follow official documentation
# https://docs.docker.com/install/
```

## Cluster Setup

### Local Environment (Minikube)

```bash
# Install Minikube
curl -LO https://github.com/kubernetes/minikube/releases/latest/download/minikube-darwin-amd64
sudo install minikube-darwin-amd64 /usr/local/bin/minikube

# Start cluster
minikube start --cpus=4 --memory=8192

# Enable required addons
minikube addons enable ingress
minikube addons enable metrics-server
minikube addons enable monitoring
```

### Docker Desktop Kubernetes

```bash
# Enable in Docker Desktop Settings
# Settings > Kubernetes > Enable Kubernetes

# Verify cluster
kubectl cluster-info
```

### Cloud Kubernetes Services

#### Google Kubernetes Engine (GKE)
```bash
# Create cluster
gcloud container clusters create chuka-cribs \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type n1-standard-2 \
  --enable-stackdriver-kubernetes

# Get credentials
gcloud container clusters get-credentials chuka-cribs --zone us-central1-a
```

#### Amazon EKS
```bash
# Create cluster using eksctl
eksctl create cluster --name chuka-cribs --version 1.24

# Update kubeconfig
aws eks update-kubeconfig --region us-east-1 --name chuka-cribs
```

#### Azure AKS
```bash
# Create cluster
az aks create --resource-group myResourceGroup \
  --name chuka-cribs --node-count 3

# Get credentials
az aks get-credentials --resource-group myResourceGroup --name chuka-cribs
```

### Verify Cluster

```bash
# Check cluster info
kubectl cluster-info

# Check nodes
kubectl get nodes

# Check system pods
kubectl get pods -n kube-system
```

## Image Registry Setup

### GitHub Container Registry (GHCR)

```bash
# Login to GHCR
echo $GH_PAT | docker login ghcr.io -u USERNAME --password-stdin

# Create personal access token
# GitHub > Settings > Developer settings > Personal access tokens
# Scopes: write:packages, read:packages, delete:packages

# Tag image
docker tag chuka-cribs:latest ghcr.io/your-username/chuka-cribs:latest

# Push image
docker push ghcr.io/your-username/chuka-cribs:latest

# Create Kubernetes secret for private registry
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=your-username \
  --docker-password=$GH_PAT \
  --docker-email=your-email@example.com \
  -n chuka-cribs
```

### Docker Hub

```bash
# Login to Docker Hub
docker login

# Tag image
docker tag chuka-cribs:latest your-username/chuka-cribs:latest

# Push image
docker push your-username/chuka-cribs:latest

# Create secret
kubectl create secret docker-registry dockerhub-secret \
  --docker-server=docker.io \
  --docker-username=your-username \
  --docker-password=your-token \
  -n chuka-cribs
```

### Private Registry

```bash
# For self-hosted registry
docker login registry.example.com

docker tag chuka-cribs:latest registry.example.com/chuka-cribs:latest

docker push registry.example.com/chuka-cribs:latest
```

## Deployment

### Step 1: Build and Push Image

```bash
# Build Docker image
docker build -t ghcr.io/your-org/chuka-cribs:latest .

# Push to registry
docker push ghcr.io/your-org/chuka-cribs:latest

# Tag as latest for production
docker tag ghcr.io/your-org/chuka-cribs:latest ghcr.io/your-org/chuka-cribs:1.0.0
docker push ghcr.io/your-org/chuka-cribs:1.0.0
```

### Step 2: Configure Secrets

```bash
# Copy secrets template
cp kubernetes/secrets-template.yaml kubernetes/secrets.yaml

# Edit with real values (DO NOT commit this file!)
nano kubernetes/secrets.yaml

# Apply secrets
kubectl apply -f kubernetes/secrets.yaml -n chuka-cribs
```

### Step 3: Run Deployment Script

#### Linux/macOS
```bash
# Make script executable
chmod +x kubernetes/deploy.sh

# Run deployment
./kubernetes/deploy.sh deploy

# Or use with custom configuration
export IMAGE_TAG=1.0.0
export MONGODB_PASSWORD=your-secure-password
./kubernetes/deploy.sh deploy
```

#### Windows
```batch
# Run deployment script
kubernetes\deploy.bat deploy
```

### Step 4: Verify Deployment

```bash
# Check deployment status
kubectl get deployments -n chuka-cribs

# Check pods
kubectl get pods -n chuka-cribs

# Check services
kubectl get svc -n chuka-cribs

# Get logs
kubectl logs -f deployment/chuka-cribs -n chuka-cribs

# Describe deployment for issues
kubectl describe deployment chuka-cribs -n chuka-cribs
```

## Configuration

### Environment Variables

Configuration is managed through:
1. **ConfigMaps** (non-sensitive data)
2. **Secrets** (sensitive data)

### Update Configuration

```bash
# Edit ConfigMap
kubectl edit configmap chuka-cribs-config -n chuka-cribs

# Edit Secrets
kubectl edit secret chuka-cribs-secrets -n chuka-cribs

# Redeploy to apply changes
kubectl rollout restart deployment/chuka-cribs -n chuka-cribs
```

### Database Configuration

#### MongoDB Connection
- **Host**: mongodb.chuka-cribs.svc.cluster.local
- **Port**: 27017
- **Database**: chuka-cribs
- **Replica Set**: chuka-cribs-rs

#### Redis Connection
- **Host**: redis.chuka-cribs.svc.cluster.local
- **Port**: 6379
- **DB**: 0

## Monitoring

### Prometheus

```bash
# Install Prometheus Operator (if not already installed)
helm install prometheus prometheus-community/kube-prometheus-stack \
  -n monitoring --create-namespace

# Verify ServiceMonitor is created
kubectl get servicemonitor -n chuka-cribs
```

### View Metrics

```bash
# Port forward Prometheus
kubectl port-forward -n monitoring svc/prometheus-operated 9090:9090

# Access at http://localhost:9090
```

### Grafana Dashboard

```bash
# Port forward Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80

# Access at http://localhost:3000
# Default credentials: admin / prom-operator
```

### Alerts

Prometheus rules are defined in `kubernetes/monitoring.yaml`:
- Pod availability
- High CPU usage
- High memory usage
- Database connection errors
- Redis connection errors
- High error rates
- Disk usage alerts

### View Alert Status

```bash
# Check Prometheus targets
kubectl port-forward -n monitoring svc/prometheus-operated 9090:9090

# Navigate to Status > Targets
# Navigate to Alerts to see configured alerts
```

## Scaling

### Manual Scaling

```bash
# Scale deployment
kubectl scale deployment chuka-cribs -n chuka-cribs --replicas=5

# Check status
kubectl get deployment chuka-cribs -n chuka-cribs
```

### Horizontal Pod Autoscaler (HPA)

HPA is configured to automatically scale based on:
- CPU usage > 70%
- Memory usage > 80%

```bash
# Check HPA status
kubectl get hpa -n chuka-cribs

# Watch HPA
kubectl get hpa -n chuka-cribs -w

# Describe HPA
kubectl describe hpa chuka-cribs -n chuka-cribs

# Update HPA
kubectl autoscale deployment chuka-cribs \
  --min=3 --max=10 \
  -n chuka-cribs

# Edit HPA
kubectl edit hpa chuka-cribs -n chuka-cribs
```

### Database Scaling

```bash
# Scale MongoDB StatefulSet
kubectl scale statefulset mongodb -n chuka-cribs --replicas=5

# Scale Redis StatefulSet
kubectl scale statefulset redis -n chuka-cribs --replicas=5
```

## Troubleshooting

### Common Issues

#### Pods not starting
```bash
# Check pod status
kubectl describe pod <pod-name> -n chuka-cribs

# Check logs
kubectl logs <pod-name> -n chuka-cribs

# Previous logs (if crashed)
kubectl logs <pod-name> -n chuka-cribs --previous
```

#### Database connection issues
```bash
# Check MongoDB connectivity
kubectl exec -it mongodb-0 -n chuka-cribs -- mongo --eval "db.adminCommand('ping')"

# Check Redis connectivity
kubectl exec -it redis-0 -n chuka-cribs -- redis-cli ping
```

#### Service not accessible
```bash
# Check service
kubectl describe svc chuka-cribs -n chuka-cribs

# Check endpoints
kubectl get endpoints -n chuka-cribs

# Port forward for testing
kubectl port-forward svc/chuka-cribs 3000:80 -n chuka-cribs

# Access at http://localhost:3000
```

#### Memory/CPU issues
```bash
# Check resource usage
kubectl top nodes
kubectl top pods -n chuka-cribs

# Check resource requests/limits
kubectl describe node <node-name>

# Edit resource limits
kubectl set resources deployment chuka-cribs \
  --requests=cpu=250m,memory=256Mi \
  --limits=cpu=500m,memory=512Mi \
  -n chuka-cribs
```

#### Certificate issues
```bash
# Check certificate
kubectl get certificate -n chuka-cribs

# Check cert-manager logs
kubectl logs -f -n cert-manager deploy/cert-manager

# Describe certificate
kubectl describe certificate chuka-cribs-tls -n chuka-cribs
```

### Debug Commands

```bash
# Get all resources
kubectl get all -n chuka-cribs

# Get detailed resource info
kubectl describe all -n chuka-cribs

# Check events
kubectl get events -n chuka-cribs --sort-by='.lastTimestamp'

# Execute command in pod
kubectl exec -it <pod-name> -n chuka-cribs -- /bin/sh

# Copy files from pod
kubectl cp chuka-cribs/<pod-name>:/app/logs ./logs -n chuka-cribs

# Check network connectivity
kubectl run debug --image=busybox -n chuka-cribs -- sleep 3600
kubectl exec -it debug -n chuka-cribs -- wget -O- http://chuka-cribs:80/health
```

### Health Checks

```bash
# Manual health check
kubectl port-forward svc/chuka-cribs 3000:80 -n chuka-cribs
curl http://localhost:3000/health
curl http://localhost:3000/api/live
curl http://localhost:3000/api/ready

# Check in pod
kubectl exec <pod-name> -n chuka-cribs -- curl http://localhost:3000/health
```

## Updates and Rollouts

### Rolling Update

```bash
# Update image
kubectl set image deployment/chuka-cribs \
  chuka-cribs=ghcr.io/your-org/chuka-cribs:1.1.0 \
  -n chuka-cribs

# Check rollout status
kubectl rollout status deployment/chuka-cribs -n chuka-cribs

# View rollout history
kubectl rollout history deployment/chuka-cribs -n chuka-cribs
```

### Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/chuka-cribs -n chuka-cribs

# Rollback to specific revision
kubectl rollout undo deployment/chuka-cribs --to-revision=2 -n chuka-cribs

# Check rollout status
kubectl rollout status deployment/chuka-cribs -n chuka-cribs
```

## Backup and Recovery

### MongoDB Backup

```bash
# Create backup
kubectl exec -it mongodb-0 -n chuka-cribs -- mongodump --out /backup

# Copy backup out
kubectl cp chuka-cribs/mongodb-0:/backup ./mongodb-backup

# Restore from backup
kubectl cp ./mongodb-backup chuka-cribs/mongodb-0:/restore
kubectl exec -it mongodb-0 -n chuka-cribs -- mongorestore /restore
```

### Persistent Volume Backup

```bash
# Check PersistentVolumes
kubectl get pv -n chuka-cribs

# Backup PV data
kubectl cp chuka-cribs/mongodb-0:/data/db ./mongodb-data

# Create snapshot (cloud-specific)
# GKE: gcloud compute disks snapshot <disk-name>
# EKS: aws ec2 create-snapshot --volume-id <volume-id>
# AKS: az snapshot create --resource-group <rg> --source <disk>
```

## Security Best Practices

1. **Network Policies**: Restrict traffic between pods
2. **RBAC**: Implement least privilege access
3. **Secrets Management**: Use sealed-secrets or external-secrets
4. **Pod Security**: Run as non-root, read-only filesystem
5. **Image Scanning**: Scan images for vulnerabilities
6. **TLS**: Use TLS for all communications
7. **Resource Quotas**: Limit resource usage per namespace

### Implement Security Policies

```bash
# Apply network policies
kubectl apply -f kubernetes/network-policy.yaml

# Apply RBAC
kubectl apply -f kubernetes/rbac.yaml

# Create network policy for ingress
kubectl apply -f kubernetes/network-policy.yaml

# Security context in Pod
# Already configured in deployment.yaml
```

## Cleanup

### Remove Application

```bash
# Delete all resources
./kubernetes/deploy.sh cleanup

# Or manually
kubectl delete -f kubernetes/ -n chuka-cribs

# Delete namespace
kubectl delete namespace chuka-cribs

# Delete persistent volumes (data will be lost)
kubectl delete pv -n chuka-cribs --all
```

## References

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [Docker to Kubernetes](https://docs.docker.com/get-started/kube-orchestration/)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
