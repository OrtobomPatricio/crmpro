# Guía de Despliegue en VPS (Hostinger) para Imagine CRM Pro

Esta guía te llevará paso a paso para instalar tu CRM en un Servidor Privado Virtual (VPS) de Hostinger (o cualquier servidor Ubuntu/Debian).

## 1. Requisitos Previos

Necesitas acceso SSH a tu servidor.
```bash
ssh root@tu_ip_vps
```

## 2. Instalar Software Base

Ejecuta estos comandos en tu terminal SSH para instalar lo necesario:

```bash
# Actualizar sistema
apt update && apt upgrade -y

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Instalar PNPM (Gestor de paquetes rápido)
npm install -g pnpm

# Instalar PM2 (Para mantener la app viva)
npm install -g pm2

# Instalar Nginx (Servidor Web)
apt install -y nginx

# Instalar Git
apt install -y git
```

### (Opcional) Instalar MySQL
Si no usas una base de datos externa, instala MySQL en el VPS:
```bash
apt install -y mysql-server
systemctl start mysql
systemctl enable mysql
```
*Nota: Asegúrate de crear una base de datos y un usuario para el CRM.*

## 3. Clonar el Proyecto

Vamos a instalar el CRM en el directorio `/opt/imagine-crm`.

```bash
# Crear directorio y asignar permisos
mkdir -p /opt/imagine-crm
cd /opt/imagine-crm

# Clonar repositorio (Reemplaza URL_DE_TU_REPO con el tuyo)
git clone https://github.com/tu-usuario/imagine-crm-pro.git .

# Instalar dependencias
pnpm install
```

## 4. Configuración (.env)

Debes configurar las variables de entorno para producción.

```bash
cp .env.example .env
nano .env
```
**Importante cambiar en `.env`:**
- `DATABASE_URL`: Tu conexión real a la base de datos (e.g., `mysql://usuario:password@localhost:3306/nombre_db`).
- `JWT_SECRET`: Una clave larga y secreta.
- `VITE_API_URL`: La URL pública de tu dominio (e.g., `https://crm.tu-empresa.com`).

## 5. Base de Datos y Build

```bash
# Subir estructura de la base de datos
pnpm db:push

# Construir la aplicación para producción
pnpm build
```

## 6. Iniciar Aplicación con PM2

```bash
# Iniciar proceso
pm2 start deploy/pm2.ecosystem.config.cjs

# Guardar configuración para que inicie al reiniciar el VPS
pm2 save
pm2 startup
```
*(Copia y pega el comando que te muestre `pm2 startup` si te lo pide).*

## 7. Configurar Dominio con Nginx

Configura Nginx para que tu dominio apunte al CRM.

1.  Crea la configuración:
    ```bash
    nano /etc/nginx/sites-available/crm
    ```
2.  Pega el siguiente contenido (ajusta `server_name`):
    ```nginx
    server {
        listen 80;
        server_name crm.tu-empresa.com; # <--- TU DOMINIO AQUÍ

        client_max_body_size 50M; # Permitir subida de archivos grandes

        location / {
            proxy_pass http://localhost:3000;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }
    ```
3.  Activa el sitio y reinicia Nginx:
    ```bash
    ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/
    nginx -t # Verificar errores
    systemctl restart nginx
    ```

## 8. Certificado SSL (HTTPS)

Para tener el candadito seguro 🔒:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d crm.tu-empresa.com
```

## 9. Actualizaciones Automáticas

Para que tu CRM se actualice solo cada noche con los cambios de GitHub:

```bash
cd /opt/imagine-crm
chmod +x deploy/setup_autoupdate.sh
./deploy/setup_autoupdate.sh
```

---
¡Listo! Tu CRM debería estar funcionando en `https://crm.tu-empresa.com`.
