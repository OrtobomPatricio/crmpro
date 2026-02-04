# 🚀 Guía de Despliegue Rápido en VPS (Docker)

Esta guía te permitirá desplegar Imagine CRM Pro en cualquier VPS (Ubuntu/Debian recomendado) usando Docker.

## Prerrequisitos
-   VPS con Docker y Docker Compose instalados.
-   Dominio apuntando a la IP del VPS.

## Pasos de Instalación

1.  **Clonar el Repositorio**
    ```bash
    git clone https://github.com/OrtobomPatricio/crmpro.git
    cd crmpro
    ```

2.  **Configurar Variables de Entorno**
    Copia el archivo de ejemplo y edítalo con tus secretos reales.
    ```bash
    cp deploy/.env.example .env
    nano .env
    ```
    > **IMPORTANTE**: Cambia `JWT_SECRET`, `MYSQL_PASSWORD`, y `BOOTSTRAP_ADMIN_PASSWORD`.

3.  **Desplegar (Build & Run)**
    Ejecuta este comando para construir y levantar los contenedores en modo producción (detached).
    ```bash
    docker compose -f docker-compose.prod.yml up -d --build
    ```

4.  **Verificar Estado**
    ```bash
    docker compose -f docker-compose.prod.yml ps
    docker compose -f docker-compose.prod.yml logs -f app
    ```

## Actualización (Zero Downtime aproximado)
Para aplicar nuevos cambios desde GitHub:

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build --no-deps app
docker image prune -f
```

## Troubleshooting
-   **Logs**: `docker compose -f docker-compose.prod.yml logs -f --tail 100`
-   **Reiniciar todo**: `docker compose -f docker-compose.prod.yml restart`
-   **Resetear Base de Datos (PELIGRO)**: `docker compose -f docker-compose.prod.yml down -v`
