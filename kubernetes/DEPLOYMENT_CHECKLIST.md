# Production Deployment Checklist

This checklist ensures all aspects of the application are properly configured and tested before production deployment.

## Pre-Deployment Requirements

### Infrastructure Setup
- [ ] Kubernetes cluster provisioned (v1.24+)
- [ ] Minimum 3 nodes in cluster
- [ ] Nodes have at least 2GB RAM available
- [ ] 20GB persistent storage configured
- [ ] LoadBalancer or Ingress controller installed
- [ ] cert-manager installed for TLS
- [ ] Prometheus operator installed (monitoring)
- [ ] Logging stack configured (ELK/Loki)
- [ ] Backup solution configured

### Security Setup
- [ ] Registry credentials configured
- [ ] Network security groups configured
- [ ] Firewall rules allow necessary traffic
- [ ] VPN access configured (if needed)
- [ ] RBAC policies defined
- [ ] Secret management solution installed
- [ ] Container image scanning configured
- [ ] SSL/TLS certificates ready

### Domain & DNS
- [ ] Domains registered
  - [ ] chukacribs.co.ke
  - [ ] www.chukacribs.co.ke
  - [ ] api.chukacribs.co.ke
- [ ] DNS records configured
- [ ] DNS propagated globally
- [ ] Certificate for domains obtained (cert-manager)

### Application Configuration
- [ ] All environment variables documented
- [ ] Secrets are secure and stored safely
- [ ] Database credentials set
- [ ] Email service configured
- [ ] Payment gateway credentials set
- [ ] SMS gateway credentials set
- [ ] AWS/Cloud storage configured
- [ ] Analytics configured (Google Analytics)
- [ ] Error tracking configured (Sentry)
- [ ] Logging configured

## Pre-Deployment Testing

### Image Validation
- [ ] Docker image builds successfully
- [ ] Image is pushed to registry
- [ ] Image can be pulled from registry
- [ ] Image layers are optimized
- [ ] Security scanning passes
- [ ] Tags are correct (latest, version tags)

### Local Testing
- [ ] Application runs locally
- [ ] All API endpoints respond
- [ ] Database connections work
- [ ] Cache connections work
- [ ] File uploads work
- [ ] Email sending works
- [ ] Payment processing works
- [ ] Admin panel accessible
- [ ] Student portal accessible

### Staging Deployment
- [ ] Deploy to staging environment
- [ ] All health checks pass
- [ ] Load testing completed
- [ ] Performance benchmarks met
- [ ] Security tests passed
- [ ] Accessibility tests passed
- [ ] Cross-browser testing done
- [ ] Mobile testing done
- [ ] Disaster recovery tested

## Deployment Checklist

### Pre-Deployment
- [ ] Backup current production data
- [ ] Notify stakeholders of deployment
- [ ] Have rollback plan ready
- [ ] Ensure team is available during deployment
- [ ] Check monitoring alerts are configured
- [ ] Ensure logs are being collected

### Deployment
- [ ] Create namespace
- [ ] Apply RBAC policies
- [ ] Create ConfigMaps
- [ ] Create Secrets
- [ ] Deploy MongoDB (wait for readiness)
- [ ] Deploy Redis (wait for readiness)
- [ ] Run database migrations
- [ ] Deploy application
- [ ] Create services
- [ ] Configure ingress
- [ ] Setup network policies
- [ ] Configure HPA

### Post-Deployment
- [ ] Verify pods are running
- [ ] Check service endpoints
- [ ] Test ingress routing
- [ ] Verify TLS certificates
- [ ] Check application health
- [ ] Verify database connectivity
- [ ] Verify cache connectivity
- [ ] Test API endpoints
- [ ] Check logs for errors
- [ ] Monitor resource usage
- [ ] Verify backups are working
- [ ] Update documentation

## Health Checks

### Application Health
```bash
# Check pod status
kubectl get pods -n chuka-cribs

# Check deployment status
kubectl get deployment chuka-cribs -n chuka-cribs

# Check logs
kubectl logs -f deployment/chuka-cribs -n chuka-cribs

# Test endpoint
curl https://api.chukacribs.co.ke/health
```

### Database Health
```bash
# MongoDB status
kubectl get statefulset mongodb -n chuka-cribs
kubectl exec mongodb-0 -n chuka-cribs -- mongo --eval "db.adminCommand('ping')"

# Redis status
kubectl get statefulset redis -n chuka-cribs
kubectl exec redis-0 -n chuka-cribs -- redis-cli ping
```

### Service Health
```bash
# Check all services
kubectl get svc -n chuka-cribs

# Check ingress
kubectl get ingress -n chuka-cribs

# Test DNS
nslookup chukacribs.co.ke
nslookup api.chukacribs.co.ke
```

## Monitoring & Alerting

### Metrics to Monitor
- [ ] Application uptime
- [ ] Response time (p50, p95, p99)
- [ ] Error rate
- [ ] Database connection pool
- [ ] Cache hit/miss ratio
- [ ] CPU usage per pod
- [ ] Memory usage per pod
- [ ] Disk I/O
- [ ] Network traffic
- [ ] Pod restart count

### Alerts Configured
- [ ] Pod down alert
- [ ] High CPU alert
- [ ] High memory alert
- [ ] Database error alert
- [ ] Cache error alert
- [ ] High error rate alert
- [ ] Disk usage alert
- [ ] Certificate expiry alert

### Dashboard Access
- [ ] Grafana dashboards accessible
- [ ] Custom dashboard created
- [ ] Alert notifications configured
- [ ] On-call rotation established

## Post-Deployment Validation

### Functionality Testing
- [ ] User registration works
- [ ] User login works
- [ ] House search works
- [ ] Booking creation works
- [ ] Payment processing works
- [ ] Email notifications sent
- [ ] SMS notifications sent
- [ ] Admin panel accessible
- [ ] Reports generated correctly
- [ ] File uploads working

### Performance Testing
- [ ] Load times acceptable (<3s)
- [ ] Database queries < 100ms
- [ ] API responses < 500ms
- [ ] No memory leaks observed
- [ ] CPU usage within limits
- [ ] Disk space not filling up

### Security Validation
- [ ] CORS headers correct
- [ ] XSS protection enabled
- [ ] CSRF protection enabled
- [ ] SQL injection prevented
- [ ] No sensitive data in logs
- [ ] Passwords properly hashed
- [ ] Rate limiting working
- [ ] Authentication enforced
- [ ] Authorization enforced

### User Acceptance Testing (UAT)
- [ ] Product owners sign off
- [ ] No critical bugs found
- [ ] All features working
- [ ] Performance acceptable
- [ ] No security issues found

## Rollback Procedures

### Immediate Rollback
```bash
# Rollback to previous version
kubectl rollout undo deployment/chuka-cribs -n chuka-cribs

# Verify rollback
kubectl rollout status deployment/chuka-cribs -n chuka-cribs
```

### Data Recovery
```bash
# Restore database from backup
kubectl cp backup chuka-cribs/mongodb-0:/restore
kubectl exec mongodb-0 -n chuka-cribs -- mongorestore /restore
```

### Communication
- [ ] Notify users of issue
- [ ] Notify stakeholders
- [ ] Post-mortem scheduled
- [ ] Root cause analysis completed

## Post-Deployment Activities

### Documentation Updates
- [ ] Deployment runbook updated
- [ ] Configuration documented
- [ ] Known issues documented
- [ ] Troubleshooting guide updated
- [ ] Contact information updated

### Team Communication
- [ ] All team members notified
- [ ] Deployment notes documented
- [ ] Issues logged
- [ ] Learning captured
- [ ] Improvements identified

### Monitoring & Optimization
- [ ] Performance baseline established
- [ ] Resource optimization done
- [ ] Cost analysis completed
- [ ] Scheduled optimization tasks

## Schedule & Timeline

**Estimated Deployment Time**: 30-45 minutes
- Preparation: 5 minutes
- Deployment: 20-30 minutes
- Validation: 10 minutes
- Rollout completion: 5 minutes

**Deployment Window**: Choose low-traffic period
- Recommended: Off-peak hours
- Pacific Time: 2:00 AM - 6:00 AM
- East African Time: 12:00 PM - 4:00 PM UTC

## Team Responsibilities

| Role | Responsibility | Contact |
|------|-----------------|---------|
| **Deployment Lead** | Execute deployment, monitor progress | ________________ |
| **DevOps Engineer** | Infrastructure support, troubleshooting | ________________ |
| **Backend Developer** | Application validation, debugging | ________________ |
| **Frontend Developer** | UI testing, client-side validation | ________________ |
| **Database Admin** | Database backup, migration support | ________________ |
| **QA Lead** | UAT coordination, testing verification | ________________ |
| **Product Owner** | Feature sign-off, UAT approval | ________________ |
| **Stakeholder** | Business approval, communication | ________________ |

## Emergency Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| **On-Call Lead** | ________________ | ________________ | ________________ |
| **DevOps Manager** | ________________ | ________________ | ________________ |
| **CTO** | ________________ | ________________ | ________________ |
| **VP Engineering** | ________________ | ________________ | ________________ |

## Sign-Off

**Deployment Approval**
- [ ] Product Owner: ________________ Date: ________
- [ ] Tech Lead: ________________ Date: ________
- [ ] DevOps Lead: ________________ Date: ________

**Deployment Completion**
- [ ] Deployment Lead: ________________ Date: ________
- [ ] Time Started: ________ Time Completed: ________
- [ ] Status: [ ] Success [ ] Rollback [ ] Issues

**Post-Deployment Approval**
- [ ] QA Lead: ________________ Date: ________
- [ ] Product Owner: ________________ Date: ________

## Notes & Observations

```
________________________________________________________________________________

________________________________________________________________________________

________________________________________________________________________________

________________________________________________________________________________
```

## Lessons Learned

### What Went Well
- 

### What Could Be Improved
- 

### Action Items
- [ ] 
- [ ] 
- [ ] 

---

**Document Version**: 1.0
**Last Updated**: [Date]
**Next Review**: [Date]
