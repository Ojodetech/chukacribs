# Kubernetes Infrastructure - Complete Index

## 📍 Navigation Guide

Quick links to all Kubernetes-related resources and documentation.

---

## 🚀 Getting Started (Start Here!)

1. **New to Kubernetes?** → [README.md](./README.md)
2. **Ready to Deploy?** → [Quick Start](#quick-start-3-steps) below
3. **Need Details?** → [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
4. **Before Production?** → [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md)

---

## 🚀 Quick Start (3 Steps)

### Step 1: Build Image
```bash
docker build -t ghcr.io/your-org/chuka-cribs:latest .
docker push ghcr.io/your-org/chuka-cribs:latest
```

### Step 2: Configure Secrets
```bash
cp kubernetes/secrets-template.yaml kubernetes/secrets.yaml
# Edit with your actual values
```

### Step 3: Deploy
```bash
./kubernetes/deploy.sh deploy  # Linux/macOS
# or
kubernetes\deploy.bat deploy   # Windows
```

---

## 📚 Documentation Files

### Quick Reference
| File | Purpose | Read Time |
|------|---------|-----------|
| [README.md](./README.md) | Quick overview and common commands | 10 min |
| [KUBERNETES_SETUP.md](./KUBERNETES_SETUP.md) | Complete infrastructure summary | 20 min |
| [INFRASTRUCTURE_SETUP.md](./INFRASTRUCTURE_SETUP.md) | Architecture and configuration details | 15 min |

### Comprehensive Guides
| File | Purpose | Read Time | Pages |
|------|---------|-----------|-------|
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Complete deployment instructions | 45 min | 50+ |
| [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) | Pre/post deployment verification | 30 min | 20+ |

---

## 📦 Kubernetes Manifest Files

### Core Application
| File | Purpose | Copies | Storage | Resources |
|------|---------|--------|---------|-----------|
| [deployment.yaml](./deployment.yaml) | App deployment | 3+ (HPA) | emptyDir | 256Mi/250m |
| [service.yaml](./service.yaml) | Services (3 types) | - | - | - |
| [ingress.yaml](./ingress.yaml) | HTTP/HTTPS routing | - | - | - |

### Configuration Management
| File | Purpose | Secret? | Copies |
|------|---------|---------|--------|
| [configmap.yaml](./configmap.yaml) | Non-sensitive config | No | 1 |
| [secrets-template.yaml](./secrets-template.yaml) | Sensitive data template | Yes* | 1 |

**Important**: secrets-template.yaml is a template. Create secrets.yaml with actual values and add to .gitignore.

### Databases
| File | Purpose | Type | Replicas | Storage |
|------|---------|------|----------|---------|
| [mongodb-statefulset.yaml](./mongodb-statefulset.yaml) | MongoDB | StatefulSet | 3 | 20Gi each |
| [redis-statefulset.yaml](./redis-statefulset.yaml) | Redis | StatefulSet | 3 | 10Gi each |

### Advanced Configuration
| File | Purpose | Type | Details |
|------|---------|------|---------|
| [hpa.yaml](./hpa.yaml) | Auto-scaling | HPA | Min: 3, Max: 10, CPU: 70%, Mem: 80% |
| [rbac.yaml](./rbac.yaml) | Access control | RBAC | ServiceAccount + Roles + Bindings |
| [network-policy.yaml](./network-policy.yaml) | Network policies | NetworkPolicy | Pod-to-pod + PDB |
| [monitoring.yaml](./monitoring.yaml) | Prometheus setup | PrometheusRule | 10+ alert rules |

### Helm Support
| File | Purpose | Type |
|------|---------|------|
| [Chart.yaml](./Chart.yaml) | Helm chart metadata | Configuration |
| [values.yaml](./values.yaml) | Helm values | Configuration |

---

## 🔧 Deployment Automation Scripts

### Bash Script (Linux/macOS)
| Feature | Description |
|---------|-------------|
| **File** | [deploy.sh](./deploy.sh) |
| **Usage** | `./deploy.sh [deploy\|build\|status\|logs\|cleanup]` |
| **Features** | Full automation, logging, error handling |
| **Platforms** | Linux, macOS |

### Batch Script (Windows)
| Feature | Description |
|---------|-------------|
| **File** | [deploy.bat](./deploy.bat) |
| **Usage** | `deploy.bat [deploy\|build\|status\|logs\|cleanup]` |
| **Features** | Full automation, colored output |
| **Platforms** | Windows |

### GitHub Actions
| Feature | Description |
|---------|-------------|
| **File** | [.github/workflows/kubernetes-deploy.yml](../.github/workflows/kubernetes-deploy.yml) |
| **Trigger** | Push to main/develop, tags, manual |
| **Jobs** | Build → Test → Security → Deploy |
| **Features** | Auto-deploy, CI/CD, security scanning |

---

## 🔄 Common Operations

### Deployment
```bash
# New deployment
./kubernetes/deploy.sh deploy

# Just build image
./kubernetes/deploy.sh build

# Check status
./kubernetes/deploy.sh status

# View logs
./kubernetes/deploy.sh logs

# Cleanup
./kubernetes/deploy.sh cleanup
```

### Updates
```bash
# Update image
kubectl set image deployment/chuka-cribs \
  chuka-cribs=ghcr.io/org/chuka-cribs:1.1.0 \
  -n chuka-cribs

# Check rollout
kubectl rollout status deployment/chuka-cribs -n chuka-cribs

# Rollback if needed
kubectl rollout undo deployment/chuka-cribs -n chuka-cribs
```

### Monitoring
```bash
# Check pods
kubectl get pods -n chuka-cribs

# View logs
kubectl logs deployment/chuka-cribs -n chuka-cribs -f

# Port forward Prometheus
kubectl port-forward -n monitoring svc/prometheus-operated 9090:9090

# Port forward Grafana  
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
```

### Troubleshooting
```bash
# Describe pod
kubectl describe pod <pod-name> -n chuka-cribs

# Debug pod
kubectl exec -it <pod-name> -n chuka-cribs -- /bin/sh

# Check events
kubectl get events -n chuka-cribs --sort-by='.lastTimestamp'

# Resource usage
kubectl top pods -n chuka-cribs
```

---

## 📊 Infrastructure Components

### Application Layer
- **Component**: Node.js Express API
- **Container**: ghcr.io/org/chuka-cribs:latest
- **Replicas**: 3-10 (HPA managed)
- **Memory**: 256Mi/512Mi (request/limit)
- **CPU**: 250m/500m (request/limit)

### Database Layer
- **Engine**: MongoDB 6.0
- **Type**: Replica Set
- **Replicas**: 3
- **Storage**: 20Gi per instance
- **Connection**: Replica set enabled

### Cache Layer
- **Engine**: Redis 7 (Alpine)
- **Type**: Cluster
- **Replicas**: 3
- **Storage**: 10Gi per instance
- **Max Memory**: 512MB per instance

### Networking Layer
- **Ingress**: NGINX Controller
- **Services**: ClusterIP, NodePort, Headless
- **TLS**: Automatic (cert-manager)
- **Domains**: 3 (chukacribs.co.ke, www, api)

### Security Layer
- **Network Policies**: Pod traffic control
- **RBAC**: Service account + roles
- **Pod Security**: Non-root, read-only filesystem
- **Secrets**: etcd encrypted

### Observability Layer
- **Metrics**: Prometheus collection
- **Alerts**: 10+ PrometheusRules
- **Dashboard**: Grafana ready
- **Logging**: Pod logs via kubectl

---

## 🎯 Configuration by Environment

### Development
```yaml
replicas: 1
autoscaling: disabled
resources:
  limits: 256Mi/250m
nodeSelector: ""
```

### Staging
```yaml
replicas: 2
autoscaling: 2-5 replicas
resources:
  limits: 512Mi/500m
nodeSelector: "workload=staging"
```

### Production
```yaml
replicas: 3
autoscaling: 3-10 replicas
resources:
  limits: 512Mi/500m
nodeSelector: "workload=production"
```

---

## 🔐 Security Configuration Summary

| Layer | Feature | Status |
|-------|---------|--------|
| **Network** | NetworkPolicy | ✅ Enabled |
| **Access** | RBAC | ✅ Enabled |
| **Pod** | Non-root user | ✅ Enabled |
| **Pod** | Read-only filesystem | ✅ Enabled |
| **Pod** | No privilege escalation | ✅ Enabled |
| **TLS** | HTTPS for external | ✅ Enabled |
| **Secrets** | etcd encryption | ✅ Default |
| **Secrets** | No ConfigMap secrets | ✅ Enabled |

---

## 📈 Monitoring & Alerts

### Key Metrics
- HTTP request duration (p50, p95, p99)
- HTTP request error rate
- Database connection pool size
- Cache hit/miss ratio
- Pod CPU and memory usage
- Disk I/O and network traffic

### Alert Rules
1. Pod down (critical)
2. High CPU usage (warning)
3. High memory usage (warning)
4. Database connection error (critical)
5. Redis connection error (critical)
6. High error rate (critical)
7. High request latency (warning)
8. Disk usage high (warning)
9. Pod restarting frequently (warning)
10. Certificate expiry soon (warning)

---

## ✅ Deployment Verification

After deployment, verify:
```bash
# Pods running
kubectl get pods -n chuka-cribs

# Services created
kubectl get svc -n chuka-cribs

# Ingress configured
kubectl get ingress -n chuka-cribs

# Health checks passing
curl https://api.chukacribs.co.ke/health

# Database connected
kubectl logs deployment/chuka-cribs -n chuka-cribs | grep MongoDB

# Cache connected
kubectl logs deployment/chuka-cribs -n chuka-cribs | grep Redis

# Monitoring active
kubectl get servicemonitor -n chuka-cribs
```

---

## 📞 Getting Help

### Documentation
| Question | Resource |
|----------|----------|
| How do I deploy? | [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) |
| What do I need to check? | [DEPLOYMENT_CHECKLIST.md](./DEPLOYMENT_CHECKLIST.md) |
| What's the architecture? | [INFRASTRUCTURE_SETUP.md](./INFRASTRUCTURE_SETUP.md) |
| Quick reference? | [README.md](./README.md) |
| Having issues? | [DEPLOYMENT_GUIDE.md - Troubleshooting section](./DEPLOYMENT_GUIDE.md#troubleshooting) |

### Common Issues

**Pods not starting**
```bash
kubectl describe pod <pod-name> -n chuka-cribs
kubectl logs <pod-name> -n chuka-cribs
```

**Database connection failed**
```bash
kubectl exec -it mongodb-0 -n chuka-cribs -- mongo --eval "db.adminCommand('ping')"
```

**Service not accessible**
```bash
kubectl get endpoints -n chuka-cribs
kubectl port-forward svc/chuka-cribs 3000:80 -n chuka-cribs
curl http://localhost:3000/health
```

---

## 🔗 Related Projects

- **Main Project**: [../README.md](../README.md)
- **Database Schema**: [../DATABASE.md](../DATABASE.md)
- **API Documentation**: [../API.md](../API.md)
- **Environment Setup**: [../ENVIRONMENT_SETUP_GUIDE.md](../ENVIRONMENT_SETUP_GUIDE.md)

---

## 📋 File Checklist

Kubernetes Resources:
- [x] deployment.yaml
- [x] service.yaml
- [x] ingress.yaml
- [x] configmap.yaml
- [x] secrets-template.yaml
- [x] mongodb-statefulset.yaml
- [x] redis-statefulset.yaml
- [x] hpa.yaml
- [x] rbac.yaml
- [x] network-policy.yaml
- [x] monitoring.yaml

Automation:
- [x] deploy.sh
- [x] deploy.bat
- [x] kubernetes-deploy.yml (GitHub Actions)

Helm:
- [x] Chart.yaml
- [x] values.yaml

Documentation:
- [x] README.md
- [x] DEPLOYMENT_GUIDE.md
- [x] DEPLOYMENT_CHECKLIST.md
- [x] INFRASTRUCTURE_SETUP.md
- [x] KUBERNETES_SETUP.md
- [x] INDEX.md (this file)

---

## 🎓 Learning Resources

### Kubernetes Concepts
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)

### Observability
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)

### Deployment Patterns
- [Rolling Updates](https://kubernetes.io/docs/tutorials/kubernetes-basics/update/update-intro/)
- [Blue-Green Deployment](https://kubernetes.io/docs/concepts/security/pod-security-standards/)
- [Canary Releases](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/declarative-config/)

---

## 📝 Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 1.0.0 | 2024 | Initial infrastructure setup | ✅ Complete |

---

## 🎉 Summary

**Total Components**: 21 files
- Kubernetes Manifests: 11
- Documentation: 5
- Deployment Scripts: 2
- Helm Support: 2
- CI/CD: 1

**Total Lines of Code**: 3000+
**Documentation Pages**: 100+
**Alert Rules**: 10+
**Deployment Methods**: 3

**Status**: ✅ Production Ready

---

**Last Updated**: 2024
**Maintained By**: DevOps Team
**Next Review**: Quarterly

---

Happy Deploying! 🚀
