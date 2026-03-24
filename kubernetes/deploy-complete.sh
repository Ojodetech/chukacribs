#!/bin/bash
# Kubernetes Deployment Script for ChukaCribs
# Automated setup with validation and monitoring

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="chuka-cribs"
RELEASE_NAME="chuka-cribs"
CHART_DIR="./kubernetes"
DOMAIN="${DOMAIN:-chukacribs.local}"
ENVIRONMENT="${ENVIRONMENT:-production}"

# Functions
print_header() {
    echo -e "${BLUE}═══════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Prerequisites check
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl not found. Install it first."
        exit 1
    fi
    print_success "kubectl found"
    
    # Check helm
    if ! command -v helm &> /dev/null; then
        print_error "helm not found. Install it first."
        exit 1
    fi
    print_success "helm found"
    
    # Check cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    print_success "Connected to cluster"
    
    # Check node readiness
    READY_NODES=$(kubectl get nodes --no-headers | grep -w "Ready" | wc -l)
    TOTAL_NODES=$(kubectl get nodes --no-headers | wc -l)
    
    if [ $READY_NODES -lt 1 ]; then
        print_error "No ready nodes in cluster"
        exit 1
    fi
    print_success "Cluster has $READY_NODES/$TOTAL_NODES ready nodes"
}

# Create namespace
setup_namespace() {
    print_header "Setting Up Namespace"
    
    if kubectl get namespace $NAMESPACE &> /dev/null; then
        print_warning "Namespace $NAMESPACE already exists"
    else
        kubectl create namespace $NAMESPACE
        print_success "Created namespace $NAMESPACE"
    fi
    
    # Label namespace for monitoring
    kubectl label namespace $NAMESPACE \
        monitoring=enabled \
        environment=$ENVIRONMENT \
        --overwrite &> /dev/null
    print_success "Labeled namespace"
}

# Create secrets
setup_secrets() {
    print_header "Setting Up Secrets"
    
    # MongoDB credentials
    if kubectl -n $NAMESPACE get secret mongodb-credentials &> /dev/null; then
        print_warning "MongoDB secret already exists"
    else
        kubectl -n $NAMESPACE create secret generic mongodb-credentials \
            --from-literal=username=${MONGO_USER:-admin} \
            --from-literal=password=${MONGO_PASSWORD:-changeme} \
            --from-literal=uri="mongodb://${MONGO_HOST:-mongodb}:27017/chukacribs"
        print_success "Created MongoDB secret"
    fi
    
    # Redis credentials
    if kubectl -n $NAMESPACE get secret redis-credentials &> /dev/null; then
        print_warning "Redis secret already exists"
    else
        kubectl -n $NAMESPACE create secret generic redis-credentials \
            --from-literal=password=${REDIS_PASSWORD:-changeme} \
            --from-literal=url="redis://:${REDIS_PASSWORD:-changeme}@redis:6379"
        print_success "Created Redis secret"
    fi
    
    # JWT secrets
    if kubectl -n $NAMESPACE get secret app-secrets &> /dev/null; then
        print_warning "App secrets already exist"
    else
        kubectl -n $NAMESPACE create secret generic app-secrets \
            --from-literal=jwt-secret=${JWT_SECRET:-$(openssl rand -base64 32)} \
            --from-literal=admin-secret=${ADMIN_SECRET_KEY:-$(openssl rand -base64 16)} \
            --from-literal=sentry-dsn=${SENTRY_DSN:-https://example@sentry.io/12345}
        print_success "Created app secrets"
    fi
    
    # TLS certificates (if provided)
    if [ ! -z "$TLS_CRT" ] && [ ! -z "$TLS_KEY" ]; then
        if kubectl -n $NAMESPACE get secret tls-certs &> /dev/null; then
            print_warning "TLS certificates already exist"
        else
            kubectl -n $NAMESPACE create secret tls tls-certs \
                --cert=$TLS_CRT \
                --key=$TLS_KEY
            print_success "Created TLS certificates"
        fi
    else
        print_warning "No TLS certificates provided - using self-signed"
    fi
}

# Create ConfigMap
setup_configmap() {
    print_header "Setting Up ConfigMap"
    
    kubectl -n $NAMESPACE apply -f $CHART_DIR/configmap.yaml
    print_success "ConfigMap created"
}

# Add Helm repositories
add_helm_repos() {
    print_header "Adding Helm Repositories"
    
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo add jetstack https://charts.jetstack.io
    helm repo update
    
    print_success "Helm repositories added and updated"
}

# Deploy core infrastructure
deploy_infrastructure() {
    print_header "Deploying Core Infrastructure"
    
    # Create database
    kubectl -n $NAMESPACE apply -f $CHART_DIR/mongodb-statefulset.yaml
    print_success "MongoDB StatefulSet deployed"
    
    # Create cache
    kubectl -n $NAMESPACE apply -f $CHART_DIR/redis-statefulset.yaml
    print_success "Redis StatefulSet deployed"
    
    # Wait for statefulsets to be ready
    echo -n "Waiting for MongoDB to be ready..."
    kubectl -n $NAMESPACE wait --for=condition=ready pod \
        -l app=mongodb --timeout=300s 2>/dev/null || print_warning "Timeout waiting for MongoDB"
    
    echo -n "Waiting for Redis to be ready..."
    kubectl -n $NAMESPACE wait --for=condition=ready pod \
        -l app=redis --timeout=300s 2>/dev/null || print_warning "Timeout waiting for Redis"
}

# Deploy monitoring
deploy_monitoring() {
    print_header "Deploying Monitoring Stack"
    
    # Install Prometheus
    helm upgrade --install kube-prometheus-stack \
        prometheus-community/kube-prometheus-stack \
        --namespace monitoring \
        --create-namespace \
        --set prometheus.prometheusSpec.retention=30d \
        --set prometheus.prometheusSpec.resources.requests.cpu=100m \
        --set prometheus.prometheusSpec.resources.requests.memory=256Mi \
        --set grafana.enabled=true \
        --set grafana.adminPassword=${GRAFANA_PASSWORD:-admin}
    
    print_success "Prometheus installed"
    
    # Deploy ServiceMonitor
    kubectl -n $NAMESPACE apply -f $CHART_DIR/monitoring.yaml
    print_success "ServiceMonitor created"
}

# Deploy application
deploy_application() {
    print_header "Deploying ChukaCribs Application"
    
    # Apply RBAC
    kubectl -n $NAMESPACE apply -f $CHART_DIR/rbac.yaml
    print_success "RBAC configured"
    
    # Apply network policies
    kubectl -n $NAMESPACE apply -f $CHART_DIR/network-policy.yaml
    print_success "Network policies applied"
    
    # Deploy application
    kubectl -n $NAMESPACE apply -f $CHART_DIR/deployment.yaml
    print_success "Deployment created"
    
    # Create service
    kubectl -n $NAMESPACE apply -f $CHART_DIR/service.yaml
    print_success "Service created"
    
    # Create ingress
    kubectl -n $NAMESPACE apply -f $CHART_DIR/ingress.yaml
    print_success "Ingress created"
    
    # Setup auto-scaling
    kubectl -n $NAMESPACE apply -f $CHART_DIR/hpa.yaml
    print_success "Horizontal Pod Autoscaler configured"
}

# Install cert-manager for SSL/TLS
setup_ssl_automation() {
    print_header "Setting Up SSL/TLS Automation"
    
    # Install cert-manager
    helm upgrade --install cert-manager jetstack/cert-manager \
        --namespace cert-manager \
        --create-namespace \
        --set installCRDs=true \
        --wait
    
    print_success "cert-manager installed"
    
    # Create ClusterIssuer for Let's Encrypt
    cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@chukacribs.local
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
    - dns01:
        route53:
          region: us-east-1
          hostedZoneID: Z1234567890ABC
          accessKeyID: AKIAIOSFODNN7EXAMPLE
          secretAccessKeySecretRef:
            name: route53-credentials
            key: secret-access-key
EOF
    
    print_success "Let's Encrypt ClusterIssuer created"
}

# Verify deployment
verify_deployment() {
    print_header "Verifying Deployment"
    
    # Check pods
    echo "Checking pod status..."
    kubectl -n $NAMESPACE get pods
    
    READY_PODS=$(kubectl -n $NAMESPACE get pods --no-headers | grep -w "Running" | wc -l)
    TOTAL_PODS=$(kubectl -n $NAMESPACE get pods --no-headers | wc -l)
    
    if [ $READY_PODS -ge 3 ]; then
        print_success "$READY_PODS/$TOTAL_PODS pods running"
    else
        print_warning "Only $READY_PODS/$TOTAL_PODS pods running - check logs"
    fi
    
    # Check services
    echo "Checking service endpoints..."
    kubectl -n $NAMESPACE get svc
    
    # Check ingress
    echo "Checking ingress status..."
    kubectl -n $NAMESPACE get ingress
}

# Post-deployment configuration
post_deployment() {
    print_header "Post-Deployment Configuration"
    
    # Run database migrations
    print_warning "Running database migrations..."
    POD=$(kubectl -n $NAMESPACE get pod -l app=chuka-cribs -o jsonpath='{.items[0].metadata.name}')
    kubectl -n $NAMESPACE exec $POD -- npm run migrate
    print_success "Database migrations complete"
    
    # Create initial admin user
    print_warning "Setting up initial admin user..."
    kubectl -n $NAMESPACE exec $POD -- node scripts/create-admin.js
    print_success "Admin user created"
}

# Display access information
show_access_info() {
    print_header "Access Information"
    
    # Get ingress IP
    INGRESS_IP=$(kubectl -n $NAMESPACE get ingress chuka-cribs -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null)
    
    if [ -z "$INGRESS_IP" ]; then
        INGRESS_IP=$(kubectl -n $NAMESPACE get ingress chuka-cribs -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null)
    fi
    
    echo "Application URL: https://$DOMAIN"
    echo "Ingress IP/Hostname: $INGRESS_IP"
    echo ""
    echo "Grafana Dashboard:"
    echo "  kubectl -n monitoring port-forward svc/kube-prometheus-stack-grafana 3001:80"
    echo "  URL: http://localhost:3001"
    echo ""
    echo "Prometheus:"
    echo "  kubectl -n monitoring port-forward svc/kube-prometheus-stack-prometheus 9090:9090"
    echo "  URL: http://localhost:9090"
    echo ""
    echo "Next Steps:"
    echo "  1. Add DNS record: $INGRESS_IP -> $DOMAIN"
    echo "  2. Verify pods: kubectl -n $NAMESPACE get pods"
    echo "  3. Check logs: kubectl -n $NAMESPACE logs -f deployment/chuka-cribs"
    echo "  4. Run smoke tests: kubectl -n $NAMESPACE exec <pod> -- npm test"
}

# Cleanup function
cleanup() {
    read -p "Are you sure you want to delete the deployment? (yes/no) " -n 3 -r
    echo
    if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        print_warning "Deleting namespace $NAMESPACE..."
        kubectl delete namespace $NAMESPACE
        print_success "Deployment cleaned up"
    fi
}

# Main execution
main() {
    print_header "ChukaCribs Kubernetes Deployment"
    
    case "${1:-deploy}" in
        deploy)
            check_prerequisites
            setup_namespace
            setup_secrets
            setup_configmap
            add_helm_repos
            deploy_infrastructure
            deploy_monitoring
            setup_ssl_automation
            deploy_application
            verify_deployment
            post_deployment
            show_access_info
            ;;
        verify)
            verify_deployment
            show_access_info
            ;;
        cleanup)
            cleanup
            ;;
        *)
            echo "Usage: $0 {deploy|verify|cleanup}"
            exit 1
            ;;
    esac
    
    print_success "Deployment complete!"
}

# Run main function
main "$@"
