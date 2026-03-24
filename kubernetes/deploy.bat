@echo off
REM Chuka Cribs Kubernetes Deployment Script (Windows)
REM This script deploys the application to a Kubernetes cluster

setlocal enabledelayedexpansion

REM Configuration
set NAMESPACE=chuka-cribs
set REGISTRY=ghcr.io
set REGISTRY_ORG=your-org
set IMAGE_TAG=%IMAGE_TAG:~0,0%latest%IMAGE_TAG:~0%
set DEPLOYMENT_NAME=chuka-cribs

REM Colors for output (Windows 10+)
set "GREEN=[92m"
set "YELLOW=[93m"
set "RED=[91m"
set "BLUE=[94m"
set "RESET=[0m"

REM Functions
setlocal enabledelayedexpansion
:log_info
echo [INFO] %1
goto :eof

:log_success
echo [SUCCESS] %1
goto :eof

:log_warning
echo [WARNING] %1
goto :eof

:log_error
echo [ERROR] %1
goto :eof

REM Check prerequisites
:check_prerequisites
echo [INFO] Checking prerequisites...

where kubectl >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] kubectl is not installed
    exit /b 1
)

where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [WARNING] Docker is not installed. Skipping image build.
)

echo [SUCCESS] Prerequisites check passed
goto :eof

REM Create namespace
:create_namespace
echo [INFO] Creating namespace %NAMESPACE%...

kubectl get namespace %NAMESPACE% >nul 2>nul
if %errorlevel% equ 0 (
    echo [WARNING] Namespace %NAMESPACE% already exists
) else (
    kubectl create namespace %NAMESPACE%
    kubectl label namespace %NAMESPACE% name=%NAMESPACE%
    echo [SUCCESS] Namespace created
)
goto :eof

REM Deploy application
:deploy_application
echo [INFO] Deploying application...

echo [INFO] Creating RBAC resources...
kubectl apply -f kubernetes\rbac.yaml -n %NAMESPACE%

echo [INFO] Creating ConfigMaps...
kubectl apply -f kubernetes\configmap.yaml -n %NAMESPACE%

echo [INFO] Deploying MongoDB...
kubectl apply -f kubernetes\mongodb-statefulset.yaml -n %NAMESPACE%

echo [INFO] Waiting for MongoDB to be ready...
kubectl rollout status statefulset/mongodb -n %NAMESPACE% --timeout=10m

echo [INFO] Deploying Redis...
kubectl apply -f kubernetes\redis-statefulset.yaml -n %NAMESPACE%

echo [INFO] Waiting for Redis to be ready...
kubectl rollout status statefulset/redis -n %NAMESPACE% --timeout=10m

echo [INFO] Deploying application pods...
kubectl apply -f kubernetes\deployment.yaml -n %NAMESPACE%

echo [INFO] Waiting for deployment to be ready...
kubectl rollout status deployment/%DEPLOYMENT_NAME% -n %NAMESPACE% --timeout=10m

echo [SUCCESS] Application deployed successfully
goto :eof

REM Create services and ingress
:create_services
echo [INFO] Creating services...
kubectl apply -f kubernetes\service.yaml -n %NAMESPACE%

echo [INFO] Creating ingress...
kubectl apply -f kubernetes\ingress.yaml -n %NAMESPACE%

echo [SUCCESS] Services and ingress created
goto :eof

REM Setup networking
:setup_networking
echo [INFO] Setting up networking policies...
kubectl apply -f kubernetes\network-policy.yaml -n %NAMESPACE%

echo [SUCCESS] Network policies applied
goto :eof

REM Get deployment status
:get_status
echo [INFO] Deployment status:
echo.
echo [INFO] Deployments:
kubectl get deployments -n %NAMESPACE%

echo.
echo [INFO] StatefulSets:
kubectl get statefulsets -n %NAMESPACE%

echo.
echo [INFO] Pods:
kubectl get pods -n %NAMESPACE%

echo.
echo [INFO] Services:
kubectl get services -n %NAMESPACE%

echo.
echo [INFO] Ingress:
kubectl get ingress -n %NAMESPACE%

echo [SUCCESS] Deployment status displayed
goto :eof

REM Main execution
:main
if "%1"=="" goto deploy
if /i "%1"=="deploy" goto deploy
if /i "%1"=="build" goto build
if /i "%1"=="status" goto status
if /i "%1"=="logs" goto logs
if /i "%1"=="cleanup" goto cleanup
echo Usage: deploy.bat [deploy^|build^|status^|logs^|cleanup]
exit /b 1

:deploy
call :check_prerequisites
call :create_namespace
call :deploy_application
call :create_services
call :setup_networking
call :get_status
echo [SUCCESS] Deployment completed successfully!
exit /b 0

:build
call :check_prerequisites
echo [INFO] Building Docker image...
docker build -t %REGISTRY%/%REGISTRY_ORG%/%DEPLOYMENT_NAME%:%IMAGE_TAG% .
echo [INFO] Pushing Docker image...
docker push %REGISTRY%/%REGISTRY_ORG%/%DEPLOYMENT_NAME%:%IMAGE_TAG%
echo [SUCCESS] Docker image built and pushed
exit /b 0

:status
call :get_status
exit /b 0

:logs
echo [INFO] Fetching logs...
kubectl logs -f deployment/%DEPLOYMENT_NAME% -n %NAMESPACE%
exit /b 0

:cleanup
setlocal
set /p confirm="This will delete all resources. Are you sure? (yes/no): "
if /i not "%confirm%"=="yes" (
    echo [INFO] Cleanup cancelled
    exit /b 0
)
echo [INFO] Deleting resources...
kubectl delete -f kubernetes\ -n %NAMESPACE%
set /p confirm="Delete namespace? (yes/no): "
if /i "%confirm%"=="yes" (
    kubectl delete namespace %NAMESPACE%
)
echo [SUCCESS] Cleanup completed
exit /b 0

setlocal enddelayedexpansion
endlocal
