# Kubernetes Infrastructure Setup - Complete Documentation

## 📋 Overview

This document summarizes the complete Kubernetes infrastructure setup for the Chuka Cribs application, including all manifests, configurations, and deployment procedures.

## 🗂️ Created Files and Directories

### Core Kubernetes Manifests

```
kubernetes/
├── README.md                    # Quick reference guide
├── DEPLOYMENT_GUIDE.md         # Comprehensive deployment guide
├── DEPLOYMENT_CHECKLIST.md     # Pre/post deployment checklist
├── Chart.yaml                  # Helm Chart metadata
├── values.yaml                 # Helm chart values and configuration
├── deploy.sh                   # Linux/macOS deployment script
├── deploy.bat                  # Windows deployment script
│
├── deployment.yaml             # Application deployment (3 replicas)
├── service.yaml               # Services (ClusterIP, NodePort, Headless)
├── ingress.yaml               # Ingress with TLS and routing
├── configmap.yaml             # Non-sensitive configuration
├── secrets-template.yaml      # Template for sensitive data
│
├── mongodb-statefulset.yaml   # MongoDB (3-node replica set, 20Gi storage)
├── redis-statefulset.yaml     # Redis (3-node cluster, 10Gi storage)
│
├── hpa.yaml                   # Horizontal Pod Autoscaler (3-10 replicas)
├── rbac.yaml                  # Role-Based Access Control
├── network-policy.yaml        # Network policies and PDB
└── monitoring.yaml            # Prometheus rules and ServiceMonitor
```

## 🚀 Key Features

### Application Deployment
- **Replicas**: 3 (managed by HPA: min 3, max 10)
- **Strategy**: RollingUpdate with gradual rollout
- **Resource Limits**: 512Mi RAM, 500m CPU per pod
- **Health Checks**: Liveness, Readiness, Startup probes
- **Security**: Non-root user, read-only filesystem, no privilege escalation

### Database Layer
- **MongoDB**: 3-node replica set with 20Gi persistent storage
- **Redis**: 3-node cache cluster with 10Gi persistent storage
- Both with automatic failover and replication

### Networking
- **Services**: ClusterIP, NodePort (30000), Headless
- **Ingress**: NGINX controller with automatic TLS
- **Domains**: chukacribs.co.ke, www.chukacribs.co.ke, api.chukacribs.co.ke
- **Network Policies**: Restrict pod-to-pod communication

### Autoscaling
- **Horizontal Pod Autoscaler**: Based on CPU (70%) and Memory (80%)
- **Scale-up**: Immediate (15-second period)
- **Scale-down**: Conservative (5-minute stabilization)
- **Pod Disruption Budget**: Ensures 2+ pods always available

### Monitoring & Observability
- **Prometheus**: Scrapes metrics from /metrics endpoint
- **Alert Rules**: 10+ critical and warning alerts
- **ServiceMonitor**: Integration with Prometheus Operator
- **Metrics**: Request duration, error rates, database connections, cache performance

### Security
- **RBAC**: Least-privilege service account and role
- **Network Policies**: Pod-to-pod traffic control
- **Secrets Management**: Encrypted secrets in etcd
- **Pod Security**: Non-root user, read-only filesystem, dropped capabilities
- **TLS/SSL**: Automatic certificate management with cert-manager

## 📊 Resource Specifications

### Application Pods
```yaml
Resources:
  Requests: 256Mi RAM, 250m CPU
  Limits: 512Mi RAM, 500m CPU
Replicas: 3 (HPA: 3-10)
```

### MongoDB
```yaml
Resources:
  Requests: 512Mi RAM, 250m CPU
  Limits: 1Gi RAM, 500m CPU
Storage: 20Gi per instance (3 instances = 60Gi)
Replicas: 3
```

### Redis
```yaml
Resources:
  Requests: 256Mi RAM, 100m CPU
  Limits: 512Mi RAM, 250m CPU
Storage: 10Gi per instance (3 instances = 30Gi)
Replicas: 3
```

### Total Cluster Requirements
- **Minimum RAM**: 6GB+ across cluster
- **Minimum CPU**: 3 cores+ across cluster
- **Minimum Storage**: ~100Gi persistent volume
- **Recommended**: 8GB+ RAM, 4 cores, cloud-managed Kubernetes

## 🔧 Configuration Management

### ConfigMap (configmap.yaml)
Non-sensitive configuration for:
- Node environment (production)
- Database connection parameters
- Cache configuration
- API settings
- Feature flags
- Logging configuration
- Monitoring settings

### Secrets Template (secrets-template.yaml)
Sensitive data template for:
- MongoDB credentials
- Redis password
- JWT secrets
- Email service credentials
- Payment gateway API keys
- Database credentials
- Docker registry credentials
- External service credentials

**IMPORTANT**: 
- Never commit actual secrets.yaml to git
- Use CI/CD to inject secrets securely
- Rotate secrets regularly
- Use secret management solution (Vault, sealed-secrets, external-secrets)

## 📈 Deployment Flow

### 1. Image Build & Push
```bash
docker build -t ghcr.io/org/chuka-cribs:latest .
docker push ghcr.io/org/chuka-cribs:latest
```

### 2. Namespace & RBAC Setup
```bash
kubectl create namespace chuka-cribs
kubectl apply -f kubernetes/rbac.yaml -n chuka-cribs
```

### 3. Configuration
```bash
kubectl apply -f kubernetes/configmap.yaml -n chuka-cribs
kubectl apply -f kubernetes/secrets.yaml -n chuka-cribs
```

### 4. Database Deployment
```bash
kubectl apply -f kubernetes/mongodb-statefulset.yaml -n chuka-cribs
kubectl apply -f kubernetes/redis-statefulset.yaml -n chuka-cribs
# Wait for readiness
kubectl rollout status statefulset/mongodb -n chuka-cribs
kubectl rollout status statefulset/redis -n chuka-cribs
```

### 5. Application Deployment
```bash
kubectl apply -f kubernetes/deployment.yaml -n chuka-cribs
kubectl rollout status deployment/chuka-cribs -n chuka-cribs
```

### 6. Networking & Access
```bash
kubectl apply -f kubernetes/service.yaml -n chuka-cribs
kubectl apply -f kubernetes/ingress.yaml -n chuka-cribs
```

### 7. Security & Scaling
```bash
kubectl apply -f kubernetes/network-policy.yaml -n chuka-cribs
kubectl apply -f kubernetes/hpa.yaml -n chuka-cribs
```

### 8. Monitoring
```bash
kubectl apply -f kubernetes/monitoring.yaml -n chuka-cribs
```

## 🔍 Monitoring & Alerting

### Prometheus Metrics Collected
- HTTP request duration (histogram)
- HTTP request count (counter)
- Database connection pool size
- Cache hit/miss ratio
- Error rates by status code
- Pod resource usage (CPU, memory)
- Disk I/O and network traffic

### Alert Rules (10+)
1. **Pod Down** (critical) - Pod unavailable for 5min
2. **High CPU** (warning) - >80% CPU for 5min
3. **High Memory** (warning) - >90% of limit for 5min
4. **High Latency** (warning) - p95 latency >1s for 5min
5. **High Error Rate** (critical) - >5% error rate for 5min
6. **DB Connection Error** (critical) - Any connection error
7. **Redis Connection Error** (critical) - Any connection error
8. **High Disk Usage** (warning) - >85% for 5min
9. **Pod Restarting** (warning) - >0.1 restarts/hour
10. **Certificate Expiry** (warning) - <30 days until expiry

### Dashboard Access
```bash
# Prometheus
kubectl port-forward -n monitoring svc/prometheus-operated 9090:9090
# http://localhost:9090

# Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
# http://localhost:3000 (admin/prom-operator)
```

## 🔐 Security Layers

### Network Security (OSI Layer 3-7)
- NetworkPolicy restricts ingress/egress
- Only NGINX ingress can reach pods
- Pods can only reach MongoDB, Redis, external HTTPS/SMTP

### Pod Security (Container Level)
- Non-root user (UID 1001)
- Read-only root filesystem
- No privilege escalation
- Dropped all Linux capabilities except NET_BIND_SERVICE

### Data Security
- Encrypted secrets in etcd
- TLS for all external communication
- JWT-based API authentication
- Password hashing with bcrypt

### RBAC (Access Control)
- Minimal permissions per service account
- Separate roles for different workloads
- Audit logging enabled

## 📚 Deployment Methods

### Method 1: Shell Script (Recommended)
```bash
# Linux/macOS
chmod +x kubernetes/deploy.sh
./kubernetes/deploy.sh deploy

# Windows
kubernetes\deploy.bat deploy
```

### Method 2: Direct kubectl
```bash
kubectl apply -f kubernetes/ -n chuka-cribs
```

### Method 3: Helm (for advanced users)
```bash
helm install chuka-cribs ./kubernetes/ \
  -n chuka-cribs \
  --create-namespace \
  -f kubernetes/values.yaml \
  -f custom-values.yaml
```

## 🔄 Updates & Maintenance

### Rolling Updates
```bash
# Update image
kubectl set image deployment/chuka-cribs \
  chuka-cribs=ghcr.io/org/chuka-cribs:1.1.0

# Check rollout
kubectl rollout status deployment/chuka-cribs
```

### Rollback
```bash
# Undo last upgrade
kubectl rollout undo deployment/chuka-cribs

# Rollback to specific revision
kubectl rollout undo deployment/chuka-cribs --to-revision=2
```

### Configuration Updates
```bash
# Update ConfigMap
kubectl edit configmap chuka-cribs-config -n chuka-cribs

# Restart deployment to apply
kubectl rollout restart deployment/chuka-cribs -n chuka-cribs
```

## 🛠️ Troubleshooting

### Common Commands
```bash
# Check cluster status
kubectl cluster-info

# View nodes
kubectl get nodes

# Check pods
kubectl get pods -n chuka-cribs
kubectl describe pod <pod-name> -n chuka-cribs

# Check logs
kubectl logs deployment/chuka-cribs -n chuka-cribs
kubectl logs -f deployment/chuka-cribs -n chuka-cribs

# Port forward for testing
kubectl port-forward svc/chuka-cribs 3000:80 -n chuka-cribs

# Execute command in pod
kubectl exec -it <pod-name> -n chuka-cribs -- /bin/sh

# Check resource usage
kubectl top nodes
kubectl top pods -n chuka-cribs
```

## 📋 Deployment Checklist

Before deploying to production:
- [ ] All tests passing
- [ ] Security scanning complete
- [ ] Cluster resources verified
- [ ] Backup strategy configured
- [ ] Monitoring setup complete
- [ ] TLS certificates ready
- [ ] DNS records updated
- [ ] Secrets securely stored
- [ ] Team notified
- [ ] Rollback plan ready

## 🔗 Related Documentation

- [README.md](./README.md) - Quick reference
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Comprehensive guide
- [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) - Pre/post checklist
- [Project README](../README.md) - Project overview
- [Database Schema](../DATABASE.md) - Database documentation
- [API Documentation](../API.md) - API reference

## 👥 Support & Contribution

For questions or issues:
1. Check [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
2. Review logs: `kubectl logs deployment/chuka-cribs -n chuka-cribs`
3. Open GitHub issue with detailed information

## 📄 License

Same as the main project. See LICENSE for details.

## ✅ Verification Checklist

After deployment, verify:
- [ ] Pods are running: `kubectl get pods -n chuka-cribs`
- [ ] Services created: `kubectl get svc -n chuka-cribs`
- [ ] Ingress working: `kubectl get ingress -n chuka-cribs`
- [ ] Endpoints available: `kubectl get endpoints -n chuka-cribs`
- [ ] Health checks pass: `curl https://api.chukacribs.co.ke/health`
- [ ] Database connected: `kubectl logs deployment/chuka-cribs -n chuka-cribs | grep "MongoDB connected"`
- [ ] Cache connected: `kubectl logs deployment/chuka-cribs -n chuka-cribs | grep "Redis connected"`
- [ ] Monitoring active: `kubectl get servicemonitor -n chuka-cribs`
- [ ] Alerts configured: `kubectl get prometheusrule -n chuka-cribs`
- [ ] Network policies active: `kubectl get networkpolicy -n chuka-cribs`

---

**Documentation Version**: 1.0.0
**Last Updated**: 2024
**Kubernetes Version**: 1.24+
**Next Review**: Quarterly
