# Kubernetes Deployment - Chuka Cribs

This directory contains all Kubernetes manifests and deployment scripts for deploying the Chuka Cribs application to a Kubernetes cluster.

## 📁 Directory Structure

```
kubernetes/
├── deployment.yaml              # Main application deployment
├── service.yaml                 # Kubernetes services (ClusterIP, NodePort)
├── ingress.yaml                 # Ingress configuration with TLS
├── configmap.yaml               # Non-sensitive configuration
├── secrets-template.yaml        # Template for sensitive data (DO NOT COMMIT)
├── mongodb-statefulset.yaml     # MongoDB replica set configuration
├── redis-statefulset.yaml       # Redis cache configuration
├── hpa.yaml                     # Horizontal Pod Autoscaler
├── rbac.yaml                    # Role-Based Access Control
├── network-policy.yaml          # Network policies and PDB
├── monitoring.yaml              # Prometheus rules and ServiceMonitor
├── values.yaml                  # Helm chart values
├── deploy.sh                    # Linux/macOS deployment script
├── deploy.bat                   # Windows deployment script
├── DEPLOYMENT_GUIDE.md          # Comprehensive deployment guide
└── README.md                    # This file
```

## 🚀 Quick Start

### Prerequisites
- Kubernetes cluster (v1.24+)
- kubectl configured to access your cluster
- Docker installed (for building images)
- Helm (optional, for advanced deployments)

### Deploy in 3 Steps

#### 1. Build and Push Image
```bash
docker build -t ghcr.io/your-org/chuka-cribs:latest .
docker push ghcr.io/your-org/chuka-cribs:latest
```

#### 2. Configure Secrets
```bash
cp kubernetes/secrets-template.yaml kubernetes/secrets.yaml
# Edit kubernetes/secrets.yaml with your actual values
```

#### 3. Run Deployment
```bash
# Linux/macOS
chmod +x kubernetes/deploy.sh
./kubernetes/deploy.sh deploy

# Windows
kubernetes\deploy.bat deploy
```

## 📋 Manifest Details

### deployment.yaml
- **Replicas**: 3 (configurable via HPA)
- **Strategy**: RollingUpdate
- **Resource Limits**: 512Mi RAM, 500m CPU per pod
- **Health Checks**: Liveness, Readiness, Startup probes
- **Security**: Non-root user, read-only filesystem
- **Init Containers**: Database and cache readiness checks

### service.yaml
Three service types for flexibility:
1. **ClusterIP**: Internal cluster communication
2. **NodePort**: External access on port 30000
3. **Headless Service**: For StatefulSet communication

### ingress.yaml
- **Controller**: NGINX
- **TLS**: Automatic with cert-manager
- **Domains**: 
  - chukacribs.co.ke
  - www.chukacribs.co.ke
  - api.chukacribs.co.ke

### configmap.yaml
Non-sensitive configuration:
- Node environment (production/development)
- Database connection parameters
- Cache configuration
- API settings
- Feature flags
- Metrics configuration

### secrets-template.yaml
**IMPORTANT**: This is a template. Create actual secrets file and add to .gitignore

Contains:
- Database credentials
- API keys and secrets
- Payment gateway credentials
- Email service credentials
- JWT secrets
- Registry credentials

### mongodb-statefulset.yaml
- **Replicas**: 3 (replica set)
- **Storage**: 20Gi per instance
- **Configuration**: Replica set initialization
- **Health Checks**: MongoDB ping probes
- **Security**: Non-root user, restricted access

### redis-statefulset.yaml
- **Replicas**: 3 (cluster mode)
- **Storage**: 10Gi per instance
- **Configuration**: Persistence, memory limits
- **Health Checks**: PING probes
- **Auto-eviction**: LRU policy for memory

### hpa.yaml
Horizontal Pod Autoscaler:
- **Min Replicas**: 3
- **Max Replicas**: 10
- **CPU Threshold**: 70%
- **Memory Threshold**: 80%
- **Scale-up**: Immediate (15s period)
- **Scale-down**: Conservative (5m stabilization)

### rbac.yaml
- **ServiceAccount**: chuka-cribs
- **Namespace Role**: ConfigMaps, Secrets, Pods access
- **Cluster Role**: Node and metrics access
- **Security**: Least privilege principle

### network-policy.yaml
- **Ingress**: From NGINX ingress controller only
- **Egress**: MongoDB, Redis, DNS, external HTTPS
- **Pod Disruption Budget**: Minimum 2 pods available
- **Database PDB**: Minimum 2 MongoDB/Redis instances

### monitoring.yaml
Prometheus integration:
- **ServiceMonitor**: Scrape metrics from pods
- **PrometheusRule**: 10+ alert rules
- **Metrics Path**: /metrics (port 3000)
- **Scrape Interval**: 30 seconds

## 🔧 Configuration

### Environment-Specific Values

#### Development
```yaml
replicas: 1
resources:
  limits:
    memory: "256Mi"
    cpu: "250m"
autoscaling:
  enabled: false
```

#### Staging
```yaml
replicas: 2
resources:
  limits:
    memory: "512Mi"
    cpu: "500m"
autoscaling:
  minReplicas: 2
  maxReplicas: 5
```

#### Production
```yaml
replicas: 3
resources:
  limits:
    memory: "512Mi"
    cpu: "500m"
autoscaling:
  minReplicas: 3
  maxReplicas: 10
```

### Update Configuration

```bash
# Edit ConfigMap
kubectl edit configmap chuka-cribs-config -n chuka-cribs

# Edit Secrets
kubectl patch secret chuka-cribs-secrets -n chuka-cribs -p '{"data":{"MONGODB_PASSWORD":"new-password"}}'

# Restart deployment to apply changes
kubectl rollout restart deployment/chuka-cribs -n chuka-cribs
```

## 📊 Monitoring & Observability

### Prometheus Metrics
- HTTP request duration
- HTTP request count
- Database connection pool
- Cache hit/miss rates
- Error rates
- Pod resource usage

### Alert Rules
- Pod availability (critical)
- High CPU usage (warning)
- High memory usage (warning)
- Database connection errors (critical)
- Redis connection errors (critical)
- High error rate (critical)
- Disk usage (warning)
- Pod restart rate (warning)

### Access Monitoring Dashboards

```bash
# Prometheus
kubectl port-forward -n monitoring svc/prometheus-operated 9090:9090
# Visit: http://localhost:9090

# Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
# Visit: http://localhost:3000
# Default: admin / prom-operator
```

## 🔐 Security

### Network Security
- NetworkPolicy restricts pod communication
- Only NGINX ingress can reach pods
- Pods can only reach MongoDB, Redis, and external services

### Pod Security
- Non-root user (UID 1001)
- Read-only root filesystem
- No privilege escalation
- Dropped all Linux capabilities

### Data Security
- Secrets stored in etcd (encrypted at rest)
- TLS for all external communication
- JWT-based authentication
- Database credentials not in ConfigMap

### RBAC
- ServiceAccount with limited permissions
- Only necessary access to cluster resources
- Separate roles for apps and infrastructure

## 🔄 Updates & Rollouts

### Update Image
```bash
kubectl set image deployment/chuka-cribs \
  chuka-cribs=ghcr.io/your-org/chuka-cribs:1.1.0 \
  -n chuka-cribs
```

### Check Rollout Status
```bash
kubectl rollout status deployment/chuka-cribs -n chuka-cribs
```

### Rollback
```bash
kubectl rollout undo deployment/chuka-cribs -n chuka-cribs
```

## 💾 Backup & Recovery

### Backup Database
```bash
# MongoDB
kubectl exec -it mongodb-0 -n chuka-cribs -- mongodump --out /data/backup

# Redis
kubectl exec -it redis-0 -n chuka-cribs -- redis-cli --rdb /data/backup.rdb
```

### Restore Database
```bash
# MongoDB
kubectl exec -it mongodb-0 -n chuka-cribs -- mongorestore /data/backup

# Redis
kubectl exec -it redis-0 -n chuka-cribs -- redis-cli bgrewriteaof
```

## 🐛 Troubleshooting

### Common Issues

#### Pods not starting
```bash
kubectl describe pod <pod-name> -n chuka-cribs
kubectl logs <pod-name> -n chuka-cribs
```

#### Database connection failed
```bash
# Check MongoDB
kubectl get statefulset mongodb -n chuka-cribs
kubectl logs mongodb-0 -n chuka-cribs

# Check Redis
kubectl get statefulset redis -n chuka-cribs
kubectl logs redis-0 -n chuka-cribs
```

#### Service not accessible
```bash
# Check service endpoints
kubectl get endpoints -n chuka-cribs

# Test connectivity
kubectl port-forward svc/chuka-cribs 3000:80 -n chuka-cribs
curl http://localhost:3000/health
```

#### Resource issues
```bash
# Check resource usage
kubectl top nodes
kubectl top pods -n chuka-cribs

# Check resource quotas
kubectl describe resourcequota -n chuka-cribs
```

### Debug Tools

```bash
# Interactive debugging
kubectl run -it --image=busybox --rm debug -- /bin/sh

# Check network connectivity
kubectl exec -it <pod> -n chuka-cribs -- nslookup mongodb

# View events
kubectl get events -n chuka-cribs --sort-by='.lastTimestamp'
```

## 📈 Scaling

### Manual Scaling
```bash
kubectl scale deployment chuka-cribs --replicas=5 -n chuka-cribs
```

### Automatic Scaling Configuration
Edit HPA in `hpa.yaml`:
- `minReplicas`: Minimum number of pods
- `maxReplicas`: Maximum number of pods
- `targetCPUUtilizationPercentage`: CPU threshold
- `targetMemoryUtilizationPercentage`: Memory threshold

## 🧹 Cleanup

### Remove Application
```bash
./kubernetes/deploy.sh cleanup
# or
kubectl delete -f kubernetes/ -n chuka-cribs
```

### Delete Namespace
```bash
kubectl delete namespace chuka-cribs
```

### Delete Persistent Volumes (⚠️ Data Loss)
```bash
kubectl delete pv -n chuka-cribs --all
```

## 📚 Resources

- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Comprehensive deployment guide
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)

## 🔗 Related Documentation

- [Project README](../README.md)
- [Environment Setup](../ENVIRONMENT_SETUP_GUIDE.md)
- [API Documentation](../API.md)
- [Database Schema](../DATABASE.md)

## 📞 Support

For deployment issues:
1. Check [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
2. Review logs: `kubectl logs -f deployment/chuka-cribs -n chuka-cribs`
3. Check events: `kubectl get events -n chuka-cribs`
4. Open an issue with:
   - Kubernetes version
   - Cluster type (local, GKE, EKS, AKS)
   - Error messages
   - Pod logs

## 📝 Notes

- **DO NOT** commit `secrets.yaml` to version control
- Customize image registry in deployment.yaml before deploying
- Ensure cluster has enough resources (6GB RAM minimum)
- TLS certificates are auto-generated with cert-manager
- MongoDB and Redis use persistent storage
- Network policies restrict external traffic

## ✅ Deployment Checklist

- [ ] Kubernetes cluster is running and accessible
- [ ] Docker image is built and pushed to registry
- [ ] secrets.yaml is created with actual values
- [ ] Registry credentials configured (if private)
- [ ] Ingress controller is installed
- [ ] cert-manager is installed (for TLS)
- [ ] Prometheus operator installed (for monitoring)
- [ ] Sufficient cluster resources available
- [ ] DNS records point to load balancer/ingress
- [ ] Backup strategy is in place

## 📄 License

Same as the main project. See [LICENSE](../LICENSE) for details.
