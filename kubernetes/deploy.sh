#!/bin/bash

# Chuka Cribs Kubernetes Deployment Script
# This script deploys the application to a Kubernetes cluster

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="chuka-cribs"
REGISTRY="ghcr.io"
REGISTRY_ORG="your-org"
IMAGE_TAG="${IMAGE_TAG:-latest}"
DEPLOYMENT_NAME="chuka-cribs"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        log_warning "Docker is not installed. Skipping image build."
    fi
    
    log_success "Prerequisites check passed"
}

# Create namespace
create_namespace() {
    log_info "Creating namespace ${NAMESPACE}..."
    
    if kubectl get namespace $NAMESPACE &> /dev/null; then
        log_warning "Namespace ${NAMESPACE} already exists"
    else
        kubectl create namespace $NAMESPACE
        kubectl label namespace $NAMESPACE name=$NAMESPACE
        log_success "Namespace created"
    fi
}

# Build and push Docker image
build_image() {
    if [ "$SKIP_BUILD" == "true" ]; then
        log_warning "Skipping Docker image build"
        return
    fi
    
    log_info "Building Docker image..."
    docker build -t ${REGISTRY}/${REGISTRY_ORG}/${DEPLOYMENT_NAME}:${IMAGE_TAG} .
    
    log_info "Pushing Docker image to registry..."
    docker push ${REGISTRY}/${REGISTRY_ORG}/${DEPLOYMENT_NAME}:${IMAGE_TAG}
    
    log_success "Docker image built and pushed"
}

# Create secrets
create_secrets() {
    log_info "Creating secrets..."
    
    if kubectl get secret chuka-cribs-secrets -n $NAMESPACE &> /dev/null; then
        log_warning "Secrets already exist. Skipping..."
        return
    fi
    
    # Check if secrets template exists
    if [ ! -f "kubernetes/secrets-template.yaml" ]; then
        log_error "secrets-template.yaml not found"
        exit 1
    fi
    
    # Copy template and update with actual values
    cp kubernetes/secrets-template.yaml kubernetes/secrets.yaml
    
    # Update with environment-specific values
    sed -i "s/your-secure-password-here/${MONGODB_PASSWORD}/" kubernetes/secrets.yaml
    sed -i "s/your-redis-password-here/${REDIS_PASSWORD}/" kubernetes/secrets.yaml
    sed -i "s/your-jwt-secret-key-here-min-32-chars/${JWT_SECRET}/" kubernetes/secrets.yaml
    sed -i "s/your-email@gmail.com/${SMTP_USERNAME}/" kubernetes/secrets.yaml
    sed -i "s/your-app-specific-password/${SMTP_PASSWORD}/" kubernetes/secrets.yaml
    sed -i "s/key-xxxxxxxxxxxxxxxxxxxx/${MAILGUN_API_KEY}/" kubernetes/secrets.yaml
    sed -i "s/your-pesapal-api-key/${PESAPAL_API_KEY}/" kubernetes/secrets.yaml
    
    kubectl apply -f kubernetes/secrets.yaml
    log_success "Secrets created"
}

# Deploy application
deploy_application() {
    log_info "Deploying application..."
    
    # Create RBAC resources
    log_info "Creating RBAC resources..."
    kubectl apply -f kubernetes/rbac.yaml
    
    # Create ConfigMaps
    log_info "Creating ConfigMaps..."
    kubectl apply -f kubernetes/configmap.yaml
    
    # Deploy MongoDB
    log_info "Deploying MongoDB..."
    kubectl apply -f kubernetes/mongodb-statefulset.yaml
    
    # Wait for MongoDB to be ready
    log_info "Waiting for MongoDB to be ready..."
    kubectl rollout status statefulset/mongodb -n $NAMESPACE --timeout=10m
    
    # Deploy Redis
    log_info "Deploying Redis..."
    kubectl apply -f kubernetes/redis-statefulset.yaml
    
    # Wait for Redis to be ready
    log_info "Waiting for Redis to be ready..."
    kubectl rollout status statefulset/redis -n $NAMESPACE --timeout=10m
    
    # Deploy application
    log_info "Deploying application pods..."
    kubectl apply -f kubernetes/deployment.yaml
    
    # Wait for deployment
    log_info "Waiting for deployment to be ready..."
    kubectl rollout status deployment/$DEPLOYMENT_NAME -n $NAMESPACE --timeout=10m
    
    log_success "Application deployed successfully"
}

# Create services and ingress
create_services() {
    log_info "Creating services..."
    kubectl apply -f kubernetes/service.yaml
    
    log_info "Creating ingress..."
    kubectl apply -f kubernetes/ingress.yaml
    
    log_success "Services and ingress created"
}

# Setup networking
setup_networking() {
    log_info "Setting up networking policies..."
    kubectl apply -f kubernetes/network-policy.yaml
    
    log_success "Network policies applied"
}

# Setup monitoring
setup_monitoring() {
    log_info "Setting up monitoring..."
    kubectl apply -f kubernetes/monitoring.yaml
    
    log_success "Monitoring configured"
}

# Create HPA
setup_autoscaling() {
    log_info "Setting up autoscaling..."
    kubectl apply -f kubernetes/hpa.yaml
    
    log_success "Autoscaling configured"
}

# Get deployment status
get_status() {
    log_info "Deployment status:"
    
    echo ""
    log_info "Deployments:"
    kubectl get deployments -n $NAMESPACE
    
    echo ""
    log_info "StatefulSets:"
    kubectl get statefulsets -n $NAMESPACE
    
    echo ""
    log_info "Pods:"
    kubectl get pods -n $NAMESPACE
    
    echo ""
    log_info "Services:"
    kubectl get services -n $NAMESPACE
    
    echo ""
    log_info "Ingress:"
    kubectl get ingress -n $NAMESPACE
    
    echo ""
    log_info "HPA Status:"
    kubectl get hpa -n $NAMESPACE
    
    log_success "Deployment status displayed"
}

# Cleanup function
cleanup() {
    log_warning "This will delete all Chuka Cribs resources. Are you sure? (yes/no)"
    read -r response
    
    if [ "$response" != "yes" ]; then
        log_info "Cleanup cancelled"
        return
    fi
    
    log_info "Deleting resources..."
    kubectl delete -f kubernetes/ -n $NAMESPACE
    
    log_warning "Would you like to delete the namespace? (yes/no)"
    read -r response
    
    if [ "$response" == "yes" ]; then
        kubectl delete namespace $NAMESPACE
    fi
    
    log_success "Cleanup completed"
}

# Main execution
main() {
    case "${1:-deploy}" in
        deploy)
            check_prerequisites
            create_namespace
            build_image
            create_secrets
            deploy_application
            create_services
            setup_networking
            setup_autoscaling
            setup_monitoring
            get_status
            log_success "Deployment completed successfully!"
            ;;
        build)
            check_prerequisites
            build_image
            ;;
        status)
            get_status
            ;;
        logs)
            kubectl logs -f deployment/$DEPLOYMENT_NAME -n $NAMESPACE
            ;;
        describe)
            kubectl describe -f kubernetes/ -n $NAMESPACE
            ;;
        cleanup)
            cleanup
            ;;
        *)
            echo "Usage: ./deploy.sh [deploy|build|status|logs|describe|cleanup]"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
