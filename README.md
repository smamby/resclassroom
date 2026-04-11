# Sistema de Reserva de Espacios de Trabajo

Este repositorio implementa un sistema para gestionar reservas de espacios de trabajo (aulas, talleres, laboratorios, etc.). El sistema cubre creación y gestión de espacios, reservas con validación de conflictos, y visualización de disponibilidad a través de un calendario. El conjunto utiliza una arquitectura en capas con una API REST, y un frontend minimalista en vanilla HTML/CSS/JS.

## Descripción general
- Permite crear espacios de trabajo (workspaces) y gestionar sus atributos (nombre, tipo, capacidad, ubicación, equipo).
- Permite gestionar reservas de espacios con fechas, horas y recurrencia; evita solapamientos entre reservas.
- Proporciona una visualización de calendario para ver disponibilidad y capacidades de filtrado por workspace, actividad y día de la semana.
- Soporta roles de usuario con permisos diferenciados: Administrador, Instructor y Visitante.
- Autenticación basada en JWT con cookies HttpOnly para sesiones seguras.

## Stack tecnológico
- Backend: Node.js con Express
- Base de datos: MongoDB
- Frontend: HTML5, CSS3, JavaScript Vanilla (sin frameworks)
- Autenticación: JWT (cookies HttpOnly)
- Pruebas: Jest (componentes críticos)

## Arquitectura y capas
- Capa de Red (network.js): Rutas Express Router que manejan request/response HTTP
- Capa de Controlador (controller.js): Lógica de negocio, validaciones y coordinación
- Capa de Almacenamiento (store.js): Acceso a datos MongoDB (operaciones CRUD)
- Capa de Modelos (models/*.js): Esquemas de datos con validaciones

## Estructura de carpetas (resumen)
```
src/
├── server.js              # Punto de entrada, configuración Express
├── routes.js              # Monta los routers de componentes
├── db.js                  # Conexión MongoDB
├── middleware/
│   └── authMiddleware.js  # Middleware de autenticación JWT
└── components/
    ├── workspaces/        # Gestión de espacios de trabajo
    │   ├── network.js
    │   ├── controller.js
    │   ├── store.js
    │   └── models/
    │       └── Workspace.js
    ├── users/             # Gestión de usuarios
    │   ├── network.js
    │   ├── controller.js
    │   ├── store.js
    │   └── models/
    │       └── User.js
    └── bookings/          # Gestión de reservas
        ├── network.js
        ├── controller.js
        ├── store.js
        └── models/
            └── Booking.js

public/
├── index.html             # Página principal
├── css/
│   └── styles.css        # Estilos minimalistas
├── js/
│   └── app.js             # Lógica del calendario
└── assets/
    └── logo.svg           # Logo de la aplicación
```

## Modelos de datos principales
- Usuario
  - id, name, surname, email, role, passwordHash, createdAt
- Espacio de Trabajo (Workspace)
  - id, name, type, capacity, location, equipment, createdBy, createdAt
- Reserva (Booking)
  - id, workspaceId, usuarioId, startDate, endDate, startTime, endTime, actividad, color, days, notes, status, createdAt, updatedAt

## Endpoints REST principales
- Workspaces
  - GET /workspaces
  - GET /workspaces/:id
  - POST /workspaces
  - PUT /workspaces/:id
  - DELETE /workspaces/:id
- Users
  - GET /users
  - GET /users/:id
  - GET /users/email/:email
  - POST /users
  - PUT /users/:id
  - DELETE /users/:id
  - POST /auth/login
  - POST /auth/register
  - POST /auth/logout
  - PUT /users/:id/promote
- Bookings
  - GET /bookings
  - GET /bookings/:id
  - POST /bookings
  - PUT /bookings/:id
  - DELETE /bookings/:id

### Ejemplos de requests y respuestas
- Login (usuario existente)
```
POST /auth/login
Payload: { "email": "user@example.com", "password": "secret" }
Response: 200 OK, cookies HttpOnly con JWT
```
- Crear un Workspace
```
POST /workspaces
Payload: { "name": "Salón A", "type": "classroom", "capacity": 40, "location": "Piso 1", "equipment": ["proyector", "pizarra"] }
Response: 201 Created, {workspace}
```
- Crear una Reserva
```
POST /bookings
Payload: { "workspaceId": "ws1", "startDate": "2026-04-20", "endDate": "2026-04-20", "startTime": "09:00", "endTime": "11:00", "actividad": "Curso de introducción", "days": [1,3] }
Response: 201 Created, {booking}
```

## Flujo de autenticación y seguridad
- Registro/Login: endpoints /auth/register y /auth/login
- Autenticación con JWT; el token se entrega en cookies HttpOnly para evitar accesos desde JavaScript cliente
- Middleware de autorización aplicado a rutas sensibles para garantizar que solo usuarios autorizados ejecuten acciones

## Flujo de reservas (alto nivel)
- Un usuario busca disponibilidad de un workspace
- Crea una reserva para fechas y horas indicadas
- El sistema valida conflictos: no permite solapamientos en el mismo workspace para el mismo rango
- Si la reserva es válida, se guarda en la base de datos y se devuelve al cliente

## Frontend (visión general)
- Interfaz minimalista y responsive
- Calendario mensual personalizado sin dependencias externas
- Filtros para workspace, actividad y día de la semana
- Módulo de reservas con formulario modal; admite múltiples slots (p. ej., todos los martes de 19:00 a 22:00)

## Configuración y ejecución local
Requisitos previos: Node.js y MongoDB instalados

1) Instalar dependencias
```
npm install
```

2) Crear archivo de configuración (opcional) .env (ejemplo)
```
MONGODB_URI=mongodb://localhost:27017/reservas
JWT_SECRET=tu-secreto-largo-aleatorio
JWT_EXPIRES_IN=1h
PORT=3000
```

3) Iniciar el servidor
```
npm run dev   # o node src/server.js
```

4) Ver la app
- Frontend está disponible en public/index.html y public/js/app.js
- La API REST expone endpoints descritos anteriormente

## Pruebas
- Ejecutar pruebas unitarias/integración
```
npm test
```
- Ubicación de pruebas: archivos __tests__ junto a componentes

## Mantenimiento y extensibilidad
- Este proyecto está diseñado para ser fácilmente extendible: nuevos tipos de espacios, reglas de negocio y endpoints pueden añadirse con cambios localizados
- Requiere pruebas para cada cambio para evitar regresiones

## Guía de contribución
- Crea una rama de feature, implementa cambios con pruebas, ejecuta la suite de tests y crea un PR
- Mantén el código simple y con comentarios cuando la lógica necesite aclaración

## Notas finales
- Este README se deriva de las especificaciones del repositorio (SPEC.md y AGENTS.md) y describe la estructura y comportamiento esperados del sistema
- Si necesitas más ejemplos de solicitudes/respuestas, o un diagrama de arquitectura, puedo generarlo y agregarlo al README
