# Recipe App

A small application for creating and browsing recipes and adding written
reviews with ratings from 1 to 5.

## Architecture

The application consists of three custom services and a PostgreSQL database:

- **Web service** serves the browser interface and forwards API requests to the
  backend services.
- **Recipe service** creates and retrieves recipes.
- **Review service** creates and retrieves reviews. Before saving a review, it
  calls the recipe service to check that the recipe exists.
- **PostgreSQL** stores recipes and reviews in separate tables.

The services communicate over HTTP. In Kubernetes, each custom service has its
own Deployment and can be scaled independently. PostgreSQL uses a
PersistentVolumeClaim to retain data.

## Run locally with Docker Compose

Start Docker Desktop, then run from the project root:

```bash
docker compose -f docker-compose.dev.yml up --build
```

Open http://localhost:3000. Press `Ctrl+C` to stop the services; the PostgreSQL
data volume is retained.

## Deploy to Kubernetes

### Prerequisites

- A running Kubernetes cluster with persistent-volume support
- `kubectl` configured to access the cluster
- Access to the Docker Hub images referenced in `k8s/`

Create the namespace and database Secret. These credentials are for a local
demonstration only:

```bash
kubectl apply -f k8s/namespace.yaml

kubectl create secret generic postgres-secret \
  --namespace recipe-app \
  --from-literal=POSTGRES_USER=recipeapp \
  --from-literal=POSTGRES_PASSWORD=recipeapp-demo
```

The Secret creation command expects the Secret not to exist already.
Changing the Secret alone does not change the password
in an already initialized PostgreSQL data volume.

Apply the remaining resources:

```bash
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/postgres-configmap.yaml
kubectl apply -f k8s/postgres-pvc.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/recipe-service.yaml
kubectl apply -f k8s/review-service.yaml
kubectl apply -f k8s/web.yaml
```

Apply these files individually: applying the entire `k8s/` directory would also
apply `secrets.example.yaml` and overwrite the Secret with placeholders.

Check the resources:

```bash
kubectl get pods,services,pvc -n recipe-app
```

When the pods are ready, forward the web Service to your computer:

```bash
kubectl port-forward svc/web 3000:3000 -n recipe-app
```

Open http://localhost:3000. Press `Ctrl+C` to stop port-forwarding.

The web Service also uses a NodePort. If its configured NodePort is already in
use, choose an unused port in `k8s/web.yaml` before applying it.

## Security

This is a learning project, not a production deployment. It does not provide
user authentication, and its example credentials should not be used in production.
Kubernetes Secrets require appropriate access controls and encryption at rest.
