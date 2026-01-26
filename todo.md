# Imagine Lab CRM - TODO

## Configuración Base
- [x] Actualizar branding a "Imagine Lab CRM"
- [x] Configurar esquema de base de datos

## Autenticación y Usuarios
- [x] Página de login con OAuth
- [x] Sistema de roles de usuario

## Dashboard Principal
- [x] Página de inicio con estadísticas generales
- [x] Resumen de leads por estado
- [x] Métricas de números WhatsApp
- [x] Tour de bienvenida para nuevos usuarios

## Gestión de Leads
- [x] Tablero Kanban con drag & drop
- [x] CRUD de leads
- [x] Filtros y búsqueda de leads
- [x] Comisiones por lead (Panamá: 10,000 G$, otros: 5,000 G$)

## Gestión de Números WhatsApp
- [x] Listado de números con estados
- [x] Sistema de Warm-up (28 días, 20-1000 mensajes/día)
- [x] Monitoreo en vivo de conexión
- [x] Alertas de bloqueo
- [x] Distribución por países (4 países, 42 números)

## Campañas
- [x] Creación de campañas masivas
- [x] Programación de envíos
- [x] Estadísticas de campañas

## Analytics
- [x] Dashboard de analytics
- [x] Gráficos de rendimiento
- [x] Reportes exportables (funcionalidad básica implementada)

## UX/UI
- [x] Atajos de teclado (Ctrl+H, Ctrl+L, Ctrl+B, Ctrl+A, Ctrl+M)
- [x] Modal de atajos de teclado
- [x] Diseño responsive
- [x] Tema visual consistente

## Integración WhatsApp Business API
- [ ] Configurar credenciales de Meta (Access Token, Phone Number ID, Business Account ID)
- [ ] Crear servicio de WhatsApp Business API en el backend
- [ ] Implementar envío de mensajes de texto
- [ ] Implementar envío de mensajes con plantillas
- [ ] Sincronizar estados de conexión de números
- [ ] Recibir webhooks de estado de mensajes (enviado, entregado, leído)
- [ ] Actualizar interfaz de campañas para enviar mensajes reales
- [ ] Actualizar monitoreo con estados en tiempo real

## Mejoras Visuales v2
- [x] Botón de cambio Dark/Light mode en header
- [x] Tema dark como predeterminado con colores oscuros
- [x] Botones interactivos con efectos hover (gradientes, iluminación)
- [x] Dashboard con Acciones Rápidas estilo tarjetas coloridas
- [x] Sección de Reportes con gráficos (Evolución de Leads, Desempeño de Campañas, Mensajes por Hora)
- [x] Página de Login con opciones Google, Microsoft y registro tradicional
- [x] Fondo interactivo con animaciones
- [x] Preparar integración WhatsApp Business API (sin conectar)

## Ajustes Visuales v3
- [x] Iconos de Acciones Rápidas con color sólido sin brillo
- [x] Solo la tarjeta cambia de color al pasar el puntero (no el icono)

## Ajustes Visuales v4
- [x] Todas las tarjetas con el mismo color base (sin gradientes especiales)
- [x] Hover de cada tarjeta cambia a tono claro del color de su icono

## Integraciones n8n
- [x] Página de Integraciones con lista de servicios disponibles
- [x] Configuración de webhook n8n con URL personalizada
- [x] Selector de canal de WhatsApp para cada integración
- [x] Estado de conexión de integraciones (activo/inactivo)
- [x] Soporte para Chatwoot y otras integraciones

## Agendamientos (Calendario)
- [x] Crear tabla de agendamientos en base de datos
- [x] Crear tabla de motivos editables (menú desplegable)
- [x] Vista de calendario en cuadrícula (mes/semana)
- [x] Selección de día para ver todos los agendados
- [x] Permitir múltiples leads en el mismo horario/día
- [x] Formulario con: nombre, apellido, motivo, teléfono, email (opcional)
- [x] CRUD de motivos de agendamiento

## Integración WhatsApp Mejorada
- [x] Opción de conectar vía API de Meta (Access Token)
- [x] Generación de código QR para conectar WhatsApp Business
- [x] Estado de conexión en tiempo real

## Menú de Canales Conectados
- [x] Sección desplegable en menú lateral
- [x] Lista de canales/números conectados
- [x] Acceso a mensajes por canal
- [x] Interfaz para responder mensajes

## Chat Completo estilo WhatsApp
- [x] Interfaz de chat con burbujas de mensajes
- [x] Envío de mensajes de texto
- [x] Selector de emojis
- [x] Envío de archivos adjuntos
- [x] Envío de imágenes
- [x] Envío de videos
- [x] Envío de ubicaciones
- [x] Notas de voz
- [x] Vista de conversaciones por contacto
- [x] Indicadores de estado (enviado, entregado, leído)

## Correcciones
- [x] Menú lateral izquierdo no aparece - corregir visibilidad
