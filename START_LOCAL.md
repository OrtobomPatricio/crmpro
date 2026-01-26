# Guía de Inicio Local - Imagine CRM Pro

## Prerequisitos

1. **Docker Desktop** debe estar corriendo
2. **Node.js** y **pnpm** instalados

## Pasos para Iniciar

### 1. Iniciar Docker Desktop

Abrí Docker Desktop y esperá a que esté completamente iniciado (el ícono debe estar verde).

### 2. Iniciar la Base de Datos

```powershell
# Desde la raíz del proyecto
docker compose up -d mysql
```

Esperá unos segundos para que MySQL esté listo. Podés verificar con:

```powershell
docker compose logs mysql
```

### 3. Verificar Conectividad

```powershell
# Verificar que el puerto 3307 esté abierto
Test-NetConnection -ComputerName 127.0.0.1 -Port 3307
```

Deberías ver `TcpTestSucceeded : True`

### 4. Iniciar el Servidor

```powershell
# Opción A: Modo desarrollo (recomendado)
pnpm dev

# Opción B: Build + Start
pnpm run build
pnpm start
```

### 5. Acceder a la Aplicación

Abrí tu navegador en: `http://localhost:3000`

## Solución de Problemas

### Error: "Dev login failed"

**Causa**: La base de datos MySQL no está corriendo.

**Solución**:
1. Verificá que Docker Desktop esté corriendo
2. Ejecutá: `docker compose up -d mysql`
3. Esperá 10 segundos
4. Refrescá la página

### Error: "Database not available"

**Causa**: Las credenciales de MySQL no coinciden o el puerto es incorrecto.

**Solución**:
1. Verificá tu archivo `.env`:
   - `DATABASE_URL=mysql://root:change_me@127.0.0.1:3307/chin_crm`
2. Verificá que el puerto en `.env` coincida con `docker-compose.yml`

### Puerto 3307 ya en uso

Si el puerto 3307 está ocupado, podés cambiarlo:

1. En `docker-compose.yml`, cambiá:
   ```yaml
   ports:
     - "3308:3306"  # Cambiá 3307 por 3308
   ```

2. En `.env`, actualizá:
   ```
   DATABASE_URL=mysql://root:change_me@127.0.0.1:3308/chin_crm
   ```

## Comandos Útiles

```powershell
# Ver logs del servidor
docker compose logs -f app

# Ver logs de MySQL
docker compose logs -f mysql

# Reiniciar todo
docker compose down
docker compose up -d

# Limpiar todo (CUIDADO: borra la base de datos)
docker compose down -v
docker compose up -d
```
