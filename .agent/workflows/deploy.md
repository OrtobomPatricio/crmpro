---
description: Deploy or update the application on a VPS using Docker
---

# Docker Deployment Workflow

Follow these steps to deploy or update the Imagine CRM Pro on your VPS.

## 1. Initial Setup / Configuration
Ensure your `.env` file on the VPS is correctly configured. 
> [!IMPORTANT]
> The `DATABASE_URL` for Docker should use the `mysql` service name:
> `DATABASE_URL=mysql://crm:change_me@mysql:3306/chin_crm`

## 2. Update and Restart
Run the following commands to pull the latest changes and rebuild the containers.

// turbo
```bash
git pull
docker compose up -d --build
```

## 3. Clean Reset (Manual Cleanup)
If you encounter `ER_TABLE_EXISTS_ERROR` or want a fresh start:

// turbo
```bash
docker compose down
docker volume rm imagine-crm-pro_mysql_data
docker compose up -d --build
```

## 4. Verify Status
Check the logs to ensure migrations were successful.

// turbo
```bash
docker compose logs -f app
```
