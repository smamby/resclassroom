# Sistema de Reserva de Espacios de Trabajo - Especificaciones

## Visión General del Proyecto
Un sistema para reservar espacios de trabajo como aulas, talleres y otras instalaciones. Los usuarios pueden crear espacios, reservarlos para fechas y horarios específicos, y consultar la disponibilidad según su rol.

## Características Principales
1. **Gestión de Espacios**
   - Creación de espacios de trabajo (aulas, talleres, etc.) con atributos como nombre, capacidad, ubicación y equipo disponible
   - Modificación y eliminación de espacios (solo administrador)

2. **Sistema de Reservas**
   - Reserva de un espacio específico para un rango de fecha y hora definido
   - Visualización de reservas existentes
   - Cancelación de reservas
   - Detección de conflictos (evitando reservas dobles)

3. **Visualización de Horarios y Disponibilidad**
   - Vista de calendario de las reservas de espacios
   - Filtrado por fecha, tipo de espacio o ubicación
   - Visualización de franjas horarias libres/ocupadas

## Roles de Usuario y Permisos
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

## Modelos de Datos
- **Usuario**: id, nombre, apellido, email, rol, fechaCreación
- **Espacio**: id, nombre, tipo, capacidad, ubicación, equipo, creadoPor, fechaCreación
- **Reserva**: id, espacioId, usuarioId, horaInicio, horaFin, propósito, estado, fechaCreación
- **Rol**: id, nombre, permisos

## Requisitos No Funcionales
- Autenticación y autorización de usuarios
- Validación y sanitización de datos
- Diseño responsive para interfaz web y móvil
- Sistema de notificaciones (recordatorios por email para reservas próximas)
- Registro de auditoría para acciones administrativas
- Asignación automática de reservas cuando el espacio está disponible

# Estructura de archivos

## Arquitectura

```
src/
├── server.js              # Punto de entrada, configuración Express
├── routes.js              # Monta los routers de componentes
├── db.js                  # Conexión MongoDB
└── components/
    ├── workspaces/
    │   ├── network.js     # express.Router() con rutas REST
    │   ├── controller.js  # Lógica de negocio
    │   ├── store.js       # Interacción con MongoDB
    │   └── models/
    │       └── Workspace.js
    └── user/
        ├── network.js     # express.Router() con rutas REST
        ├── controller.js  # Lógica de negocio
        ├── store.js       # Interacción con MongoDB
        └── models/
            └── User.js
```

## Flujo de datos

```
Request HTTP
    ↓
server.js (Express app)
    ↓
routes.js (server.use('/workspaces', workspacesRouter))
    ↓
components/workspaces/network.js (express.Router)
    ↓
components/workspaces/controller.js (WorkspaceController)
    ↓
components/workspaces/store.js (WorkspaceStore → MongoDB)
```

## Rutas REST

### Workspaces
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /workspaces | Listar todos |
| GET | /workspaces/:id | Obtener por ID |
| POST | /workspaces | Crear |
| PUT | /workspaces/:id | Actualizar |
| DELETE | /workspaces/:id | Eliminar |

### Users
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | /users | Listar todos |
| GET | /users/:id | Obtener por ID |
| GET | /users/email/:email | Obtener por email |
| POST | /users | Crear |
| PUT | /users/:id | Actualizar |
| DELETE | /users/:id | Eliminar |

## Modelos de Datos

### Workspace
```javascript
{
  id: string,          // UUID generado
  name: string,        // Requerido
  type: string,        // classroom, workshop, lab, etc.
  capacity: number,    // > 0
  location: string,
  equipment: string[],
  createdBy: string,   // User ID
  createdAt: Date
}
```

### User
```javascript
{
  id: string,          // UUID generado
  name: string,        // Requerido
  surname: string,     // Requerido
  email: string,       // Requerido, único, formato válido
  role: string,       // admin | instructor | visitor (default)
  createdAt: Date
}
```

## Capas de la aplicación

1. **network.js** - Rutas Express Router, manejan request/response HTTP
2. **controller.js** - Lógica de negocio, validaciones, coordinación
3. **store.js** - Acceso a datos MongoDB (CRUD)
4. **models/*.js** - Esquemas de datos con validaciones

---

# Frontend

## Estructura de archivos

```
public/
├── index.html          # Página principal
├── css/
│   └── styles.css     # Estilos minimalistas
├── js/
│   └── app.js        # Lógica del calendario
└── assets/
    └── logo.svg      # Logo de la aplicación
```

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
- Select para filtrar por **workspace**
- Select para filtrar por **actividad**
- Select para filtrar por **día de la semana**

### Reservas
- Modal para crear nuevas reservas
- Campos: espacio, actividad, color, fechas, horarios, día de repetición
- Las reservas pueden tener múltiples slots (ej: "todos los martes de 19hs a 22hs")

### Modelo de Reserva (Frontend)
```javascript
{
  id: number,
  workspace: string,
  workspaceName: string,
  activity: string,
  color: string,        // Color identificativo
  slots: [             // Array de fechas/horarios
    {
      date: string,    // "2026-03-03"
      startTime: string,  // "19:00"
      endTime: string     // "22:00"
    }
  ]
}
```

### Autenticación
- Login con JWT (pendiente de implementar)
- Por ahora modo demo con usuario "Invitado"

---
*Versión del Documento: 0.1 (Borrador Inicial)*
*Última Actualización: $(date)*