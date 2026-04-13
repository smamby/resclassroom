# Contexto del Proyecto: Sistema de Reserva de Espacios de Trabajo

## Visión General
Sistema para gestionar reservas de espacios de trabajo como aulas, talleres y otras instalaciones. Los usuarios pueden crear espacios, reservarlos para fechas y horarios específicos, y consultar la disponibilidad según su rol.

## Stack Tecnológico
- **Backend**: Node.js con Express
- **Base de Datos**: MongoDB
- **Frontend**: HTML5, CSS3, JavaScript Vanilla (sin frameworks)
- **Autenticación**: JWT (JSON Web Tokens) con cookies HttpOnly
- **Pruebas**: Jest (para componentes críticos)

## Arquitectura
### Estructura de Capas
1. **Capa de Red (`network.js`)**: Rutas Express Router que manejan request/response HTTP
2. **Capa de Controlador (`controller.js`)**: Lógica de negocio, validaciones, coordinación
3. **Capa de Almacenamiento (`store.js`)**: Acceso a datos MongoDB (operaciones CRUD)
4. **Capa de Modelos (`models/*.js`)**: Esquemas de datos con validaciones

### Organización de Carpetas
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
    └── bookings/          # Gestión de reservas (implícito en la espec)
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
│   └── app.js           # Lógica del calendario
└── assets/
    └── logo.svg        # Logo de la aplicación
```

## Modelos de Datos Principales

### Usuario
```javascript
{
  _id: ObjectId,      // MongoDB genera automáticamente
  name: string,        // Requerido
  surname: string,     // Requerido
  email: string,       // Requerido, único, formato válido
  role: string,       // admin | instructor | visitor (default)
  passwordHash: string, // Hash de contraseña (para login)
  createdAt: Date
}
```

### Espacio de Trabajo
```javascript
{
  _id: ObjectId,      // MongoDB genera automáticamente
  name: string,        // Requerido
  type: string,        // classroom, workshop, lab, etc.
  capacity: number,    // > 0
  location: string,
  equipment: string[],
  createdBy: string,   // User _id
  createdAt: Date
}
```

### Reserva
```javascript
{
  _id: ObjectId,         // MongoDB genera automáticamente
  workspaceId: string,  // ObjectId del Workspace (string)
  userId: string,        // ObjectId del User (string)
  startDate: string,     // YYYY-MM-DD
  endDate: string,     // YYYY-MM-DD
  startTime: string,   // HH:mm
  endTime: string,     // HH:mm
  actividad: string,   // Descripción de la reserva
  color: string,       // Color identificativo (default: '#999')
  days: Array,        // Dias de la semana (0-6)
  notes: string,       // Notas opcionales
  status: string,      // confirmed | cancelled | completed
  createdAt: Date,
  updatedAt: Date
}
```

## Roles y Permisos

### Administrador
- Acceso completo al sistema
- Crear, modificar y eliminar espacios de trabajo
- Gestionar roles y permisos de usuarios
- Ver todas las reservas en todos los espacios
- Anular reservas si es necesario

### Instructor
- Crear reservas para espacios de trabajo
- Ver y gestionar sus propias reservas
- Ver la disponibilidad de espacios de trabajo
- No puede modificar espacios creados por otros

### Visitante
- Visualizar los horarios de reserva de espacios de trabajo
- Ver los horarios disponibles
- Puede acceder de forma anónima (no requiere registro/inicio de sesión)
- No puede crear, modificar o eliminar reservas
- No puede crear o modificar espacios de trabajo

## Endpoints REST Principales

### Workspaces
- GET `/workspaces` - Listar todos
- GET `/workspaces/:id` - Obtener por ID
- POST `/workspaces` - Crear
- PUT `/workspaces/:id` - Actualizar
- DELETE `/workspaces/:id` - Eliminar

### Users
- GET `/users` - Listar todos
- GET `/users/:id` - Obtener por ID
- GET `/users/email/:email` - Obtener por email
- POST `/users` - Crear
- PUT `/users/:id` - Actualizar
- DELETE `/users/:id` - Eliminar
- POST `/auth/login` - Iniciar sesión (JWT)
- POST `/auth/register` - Registrar usuario
- POST `/auth/logout` - Cerrar sesión
- PUT `/users/:id/promote` - Promover a admin (solo admin)

### Bookings
- GET `/bookings` - Listar todas las reservas
- GET `/bookings/:id` - Obtener reserva por ID
- POST `/bookings` - Crear nueva reserva
- PUT `/bookings/:id` - Actualizar reserva existente
- DELETE `/bookings/:id` - Eliminar reserva

## Características del Frontend

### Interfaz
- Diseño minimalista, moderno, fácil lectura
- Navbar con logo, nombre de usuario y botón de login
- Dashboard con 3 columnas: filtros, calendario, detalles
- Responsive (adapta a móviles y tablets)

### Calendario
- Vista mensual custom (no usa librerías externas)
- Indicadores visuales (dots) de actividades reservadas por día
- Navegación entre meses
- Click en día muestra panel lateral con detalles

### Filtros
- Select para filtrar por workspace
- Select para filtrar por actividad
- Select para filtrar por día de la semana

### Reservas
- Modal para crear nuevas reservas
- Campos: espacio, actividad, color, fechas, horarios, día de repetición
- Las reservas pueden tener múltiples slots (ej: "todos los martes de 19hs a 22hs")

## Requisitos No Funcionales Implementados
- Autenticación y autorización de usuarios (JWT)
- Validación y sanitización de datos
- Diseño responsive para interfaz web y móvil
- Edición de datos de usuario
- Modal para promover un usuario a un rol superior (pendiente)
- Modal para crear workspaces (pendiente)
- Sistema de notificaciones (pendiente de implementar completamente)
- Registro de auditoría para acciones administrativas (pendiente)

## Convenciones y Patrones
1. **Nombres de archivos**: kebab-case
2. **Nombres de variables y funciones**: camelCase
3. **Constants**: UPPER_SNAKE_CASE
4. **Comentarios**: En español, explicando el "por qué" no el "qué"
5. **Manejo de errores**: Try/catch en controladores, respuestas HTTP apropiadas
6. **Validaciones**: En el capa de modelos y controladores
7. **Testing**: Archivos de prueba en `__tests__` junto a los componentes

## Estado Actual
- Autenticación JWT funcionando (login/register)
- CRUD completo para espacios de trabajo y usuarios
- Sistema de reservas completo con detección de conflictos
- Calendario frontend funcional con vista mensual
- Filtros de espacios y actividades funcionando
- Tests de integración para flujos de bookings

## Tests

### Suite de Tests
- **Ubicación**: `test/integration/bookings.integration.test.js` y componentes `__tests__/`
- **Ejecución**: `npm test`

### Tests de Integración (Bookings)
Los tests de integración verifican flujos de error y casos exitosos:

#### Flujos de error (403, 400)
- Instructor no puede modificar booking de admin → 403
- Usuario no autenticado no puede crear booking → 403
- Visitor no puede crear booking → 403
- Workspace inválido → 400
- Campos requeridos faltantes → 400

#### Flujo exitoso (201)
- Admin puede crear un booking

#### Datos de test
- Los tests crean usuarios y workspaces temporalmente con ObjectId de MongoDB
- Se usa header `X-User-Id` con el ObjectId string para autenticación en tests
- Los bookings usan workspaceId como string del ObjectId de MongoDB

### Limpieza
- Cada ejecución crea ~2 bookings de test
- Los workspaces se recrean en cada ejecución (deleteMany + insert)
- Los usuarios de test se crean con email '@test.com'

## Próximos Pasos Sugeridos
1. Implementar sistema de notificaciones por email
2. Completar pruebas unitarias y de integración
3. Mejorar manejo de errores y logging
4. Optimizar consultas a la base de datos
5. Implementar panel de administración completo