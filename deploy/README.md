# Deploy rapido (Opcion Git)

## Requisitos
- Node 20+
- pnpm
- pm2

## Primer deploy
```bash
sudo mkdir -p /opt/chin-crm
sudo chown -R $USER:$USER /opt/chin-crm
cd /opt
git clone TU_REPO chin-crm
cd chin-crm
cp .env.example .env  # ajusta valores
pnpm install
pnpm db:migrate
pnpm build
pm2 start deploy/pm2.ecosystem.config.cjs
pm2 save
```

## Actualizar version
```bash
bash deploy/update.sh
```

---

## Deploy con Docker (recomendado en VPS)

### Requisitos
- Docker + Docker Compose

### Configuracion
```bash
cd /opt/chin-crm
cp .env.example .env
# Edita .env (JWT_SECRET, OWNER_OPEN_ID, DATA_ENCRYPTION_KEY, etc.)
```

### Levantar servicios (MySQL dentro del VPS)
```bash
docker compose up -d --build
```

### Logs
```bash
docker compose logs -f app
```

### Actualizar
```bash
docker compose pull || true
docker compose up -d --build
```
