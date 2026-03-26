# Workspace Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el modelo de datos y las operaciones CRUD básicas para espacios de trabajo en el sistema de reserva.

**Architecture:** Seguiremos una arquitectura en capas con modelos de datos, repositorios para acceso a datos y servicios para lógica de negocio. Implementaremos primero las entidades y repositorios en memoria para pruebas, seguido de una capa de servicio que maneje la lógica de negocio.

**Tech Stack:** JavaScript/Node.js para el backend, Jest para pruebas, y un almacenamiento en memoria inicial que podrá ser reemplazado por una base de datos posteriormente.

---

### Task 1: Crear el modelo de datos Workspace

**Files:**
- Create: `src/models/Workspace.js`
- Create: `src/models/__tests__/Workspace.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
const Workspace = require('../Workspace');

describe('Workspace', () => {
  test('should create a workspace with valid parameters', () => {
    const workspace = new Workspace({
      name: 'Aula 101',
      type: 'classroom',
      capacity: 30,
      location: 'Edificio A, piso 2',
      equipment: ['proyector', 'pizarra']
    });
    
    expect(workspace.id).toBeDefined();
    expect(workspace.name).toBe('Aula 101');
    expect(workspace.type).toBe('classroom');
    expect(workspace.capacity).toBe(30);
    expect(workspace.location).toBe('Edificio A, piso 2');
    expect(workspace.equipment).toEqual(['proyector', 'pizarra']);
    expect(workspace.createdAt).toBeInstanceOf(Date);
  });

  test('should throw error when creating workspace without required fields', () => {
    expect(() => new Workspace({})).toThrow('Name is required');
    expect(() => new Workspace({ name: '' })).toThrow('Name is required');
    expect(() => new Workspace({ name: 'Test', capacity: -5 })).toThrow('Capacity must be a positive number');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/models/__tests__/Workspace.test.js`
Expected: FAIL with "Cannot find module '../Workspace'"

- [ ] **Step 3: Write minimal implementation**

```javascript
class Workspace {
  constructor(data) {
    if (!data.name || data.name.trim() === '') {
      throw new Error('Name is required');
    }
    
    if (data.capacity !== undefined && (data.capacity <= 0 || !Number.isInteger(data.capacity))) {
      throw new Error('Capacity must be a positive integer');
    }
    
    this.id = data.id || Math.random().toString(36).substr(2, 9);
    this.name = data.name.trim();
    this.type = data.type || '';
    this.capacity = data.capacity || 0;
    this.location = data.location || '';
    this.equipment = Array.isArray(data.equipment) ? data.equipment : [];
    this.createdBy = data.createdBy || null;
    this.createdAt = data.createdAt || new Date();
  }
}

module.exports = Workspace;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/models/__tests__/Workspace.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/models/Workspace.js src/models/__tests__/Workspace.test.js
git commit -m "feat: create Workspace model with validation"
```

### Task 2: Crear el repositorio en memoria para Workspace

**Files:**
- Create: `src/repositories/WorkspaceRepository.js`
- Create: `src/repositories/__tests__/WorkspaceRepository.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
const WorkspaceRepository = require('../WorkspaceRepository');
const Workspace = require('../../models/Workspace');

describe('WorkspaceRepository', () => {
  let repository;
  
  beforeEach(() => {
    repository = new WorkspaceRepository();
  });
  
  test('should save a workspace and retrieve it by id', () => {
    const workspaceData = {
      name: 'Taller de Mecánica',
      type: 'workshop',
      capacity: 20,
      location: 'Edificio B, piso 1',
      equipment: ['herramientas', 'bancos de trabajo']
    };
    
    const workspace = new Workspace(workspaceData);
    const savedWorkspace = repository.save(workspace);
    
    expect(savedWorkspace.id).toBe(workspace.id);
    
    const retrieved = repository.findById(workspace.id);
    expect(retrieved).toEqual(savedWorkspace);
  });
  
  test('should return undefined for non-existent workspace id', () => {
    const result = repository.findById('non-existent-id');
    expect(result).toBeUndefined();
  });
  
  test('should retrieve all workspaces', () => {
    const workspace1 = new Workspace({ name: 'Espacio 1', capacity: 10 });
    const workspace2 = new Workspace({ name: 'Espacio 2', capacity: 15 });
    
    repository.save(workspace1);
    repository.save(workspace2);
    
    const allWorkspaces = repository.findAll();
    expect(allWorkspaces.length).toBe(2);
    expect(allWorkspaces).toContainEqual(workspace1);
    expect(allWorkspaces).toContainEqual(workspace2);
  });
  
  test('should update an existing workspace', () => {
    const workspace = new Workspace({ name: 'Espacio Original', capacity: 25 });
    repository.save(workspace);
    
    const updatedData = { name: 'Espacio Actualizado', capacity: 30 };
    const updatedWorkspace = repository.update(workspace.id, updatedData);
    
    expect(updatedWorkspace.name).toBe('Espacio Actualizado');
    expect(updatedWorkspace.capacity).toBe(30);
    expect(updatedWorkspace.id).toBe(workspace.id);
  });
  
  test('should delete a workspace', () => {
    const workspace = new Workspace({ name: 'Espacio a Eliminar', capacity: 20 });
    repository.save(workspace);
    
    const result = repository.delete(workspace.id);
    expect(result).toBe(true);
    
    const deletedWorkspace = repository.findById(workspace.id);
    expect(deletedWorkspace).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/repositories/__tests__/WorkspaceRepository.test.js`
Expected: FAIL with "Cannot find module '../WorkspaceRepository'"

- [ ] **Step 3: Write minimal implementation**

```javascript
const Workspace = require('../models/Workspace');

class WorkspaceRepository {
  constructor() {
    this.workspaces = new Map();
  }
  
  save(workspace) {
    if (!(workspace instanceof Workspace)) {
      throw new Error('Invalid workspace object');
    }
    
    if (!workspace.id) {
      workspace.id = Math.random().toString(36).substr(2, 9);
    }
    
    this.workspaces.set(workspace.id, workspace);
    return workspace;
  }
  
  findById(id) {
    return this.workspaces.get(id);
  }
  
  findAll() {
    return Array.from(this.workspaces.values());
  }
  
  update(id, updates) {
    const workspace = this.findById(id);
    if (!workspace) {
      throw new Error(`Workspace with id ${id} not found`);
    }
    
    // Create updated workspace preserving immutable fields
    const updatedWorkspace = new Workspace({
      ...workspace,
      ...updates,
      id: workspace.id, // Ensure id is not overridden
      createdAt: workspace.createdAt, // Preserve creation date
      createdBy: workspace.createdBy // Preserve creator
    });
    
    this.workspaces.set(id, updatedWorkspace);
    return updatedWorkspace;
  }
  
  delete(id) {
    const exists = this.workspaces.has(id);
    if (exists) {
      this.workspaces.delete(id);
    }
    return exists;
  }
}

module.exports = WorkspaceRepository;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/repositories/__tests__/WorkspaceRepository.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/repositories/WorkspaceRepository.js src/repositories/__tests__/WorkspaceRepository.test.js
git commit -m "feat: create in-memory Workspace repository"
```

### Task 3: Crear el servicio de espacios de trabajo

**Files:**
- Create: `src/services/WorkspaceService.js`
- Create: `src/services/__tests__/WorkspaceService.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
const WorkspaceService = require('../WorkspaceService');
const WorkspaceRepository = require('../../repositories/WorkspaceRepository');
const Workspace = require('../../models/Workspace');

describe('WorkspaceService', () => {
  let service;
  let repository;
  
  beforeEach(() => {
    repository = new WorkspaceRepository();
    service = new WorkspaceService(repository);
  });
  
  test('should create a workspace through the service', () => {
    const workspaceData = {
      name: 'Laboratorio de Física',
      type: 'laboratory',
      capacity: 25,
      location: 'Edificio C, piso 3',
      equipment: ['microscopios', 'mesas de trabajo']
    };
    
    const workspace = service.createWorkspace(workspaceData);
    
    expect(workspace.id).toBeDefined();
    expect(workspace.name).toBe('Laboratorio de Física');
    expect(workspace.type).toBe('laboratory');
    expect(workspace.capacity).toBe(25);
    expect(workspace.location).toBe('Edificio C, piso 3');
    expect(workspace.equipment).toEqual(['microscopios', 'mesas de trabajo']);
  });
  
  test('should throw error when trying to create workspace with invalid data', () => {
    expect(() => service.createWorkspace({})).toThrow('Name is required');
    expect(() => service.createWorkspace({ name: 'Test', capacity: -5 })).toThrow('Capacity must be a positive integer');
  });
  
  test('should get a workspace by id', () => {
    const workspaceData = { name: 'Sala de Conferencias', capacity: 50 };
    const createdWorkspace = service.createWorkspace(workspaceData);
    
    const retrievedWorkspace = service.getWorkspaceById(createdWorkspace.id);
    
    expect(retrievedWorkspace).toEqual(createdWorkspace);
  });
  
  test('should return null when getting non-existent workspace', () => {
    const workspace = service.getWorkspaceById('non-existent-id');
    expect(workspace).toBeNull();
  });
  
  test('should get all workspaces', () => {
    const workspace1 = service.createWorkspace({ name: 'Espacio 1', capacity: 10 });
    const workspace2 = service.createWorkspace({ name: 'Espacio 2', capacity: 15 });
    
    const allWorkspaces = service.getAllWorkspaces();
    
    expect(allWorkspaces.length).toBe(2);
    expect(allWorkspaces).toContainEqual(workspace1);
    expect(allWorkspaces).toContainEqual(workspace2);
  });
  
  test('should update a workspace', () => {
    const workspace = service.createWorkspace({ name: 'Espacio Original', capacity: 30 });
    
    const updatedWorkspace = service.updateWorkspace(workspace.id, { 
      name: 'Espacio Actualizado',
      capacity: 35 
    });
    
    expect(updatedWorkspace.name).toBe('Espacio Actualizado');
    expect(updatedWorkspace.capacity).toBe(35);
    expect(updatedWorkspace.id).toBe(workspace.id);
  });
  
  test('should delete a workspace', () => {
    const workspace = service.createWorkspace({ name: 'Espacio a Eliminar', capacity: 20 });
    
    const result = service.deleteWorkspace(workspace.id);
    expect(result).toBe(true);
    
    const deletedWorkspace = service.getWorkspaceById(workspace.id);
    expect(deletedWorkspace).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/services/__tests__/WorkspaceService.test.js`
Expected: FAIL with "Cannot find module '../WorkspaceService'"

- [ ] **Step 3: Write minimal implementation**

```javascript
const Workspace = require('../models/Workspace');

class WorkspaceService {
  constructor(workspaceRepository) {
    this.repository = workspaceRepository;
  }
  
  createWorkspace(data) {
    const workspace = new Workspace(data);
    return this.repository.save(workspace);
  }
  
  getWorkspaceById(id) {
    const workspace = this.repository.findById(id);
    return workspace || null;
  }
  
  getAllWorkspaces() {
    return this.repository.findAll();
  }
  
  updateWorkspace(id, updates) {
    try {
      return this.repository.update(id, updates);
    } catch (error) {
      if (error.message.includes('not found')) {
        return null;
      }
      throw error;
    }
  }
  
  deleteWorkspace(id) {
    return this.repository.delete(id);
  }
}

module.exports = WorkspaceService;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/services/__tests__/WorkspaceService.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/services/WorkspaceService.js src/services/__tests__/WorkspaceService.test.js
git commit -m "feat: create Workspace service layer"
```

### Task 4: Crear controlador básico para espacios de trabajo (simulando API REST)

**Files:**
- Create: `src/controllers/WorkspaceController.js`
- Create: `src/controllers/__tests__/WorkspaceController.test.js`

- [ ] **Step 1: Write the failing test**

```javascript
const WorkspaceController = require('../WorkspaceController');
const WorkspaceService = require('../../services/WorkspaceService');
const WorkspaceRepository = require('../../repositories/WorkspaceRepository');

describe('WorkspaceController', () => {
  let controller;
  let service;
  let repository;
  
  beforeEach(() => {
    repository = new WorkspaceRepository();
    service = new WorkspaceService(repository);
    controller = new WorkspaceController(service);
  });
  
  test('should handle create workspace request', () => {
    const req = {
      body: {
        name: 'Aula de Computación',
        type: 'computer_lab',
        capacity: 25,
        location: 'Edificio D, piso 1',
        equipment: ['computadoras', 'proyector']
      }
    };
    
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    controller.createWorkspace(req, res);
    
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalled();
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.name).toBe('Aula de Computación');
    expect(responseData.capacity).toBe(25);
  });
  
  test('should handle get workspace by id request', () => {
    // First create a workspace
    const workspaceData = { name: 'Biblioteca', capacity: 100 };
    const createdWorkspace = controller.service.createWorkspace(workspaceData);
    
    const req = { params: { id: createdWorkspace.id } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    controller.getWorkspaceById(req, res);
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(createdWorkspace);
  });
  
  test('should return 404 for non-existent workspace', () => {
    const req = { params: { id: 'non-existent-id' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    controller.getWorkspaceById(req, res);
    
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Workspace not found' });
  });
  
  test('should handle get all workspaces request', () => {
    controller.service.createWorkspace({ name: 'Espacio 1', capacity: 10 });
    controller.service.createWorkspace({ name: 'Espacio 2', capacity: 15 });
    
    const req = {};
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    controller.getAllWorkspaces(req, res);
    
    expect(res.status).toHaveBeenCalledWith(200);
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.length).toBe(2);
  });
  
  test('should handle update workspace request', () => {
    const workspace = controller.service.createWorkspace({ name: 'Espacio Original', capacity: 20 });
    
    const req = {
      params: { id: workspace.id },
      body: { name: 'Espacio Actualizado', capacity: 25 }
    };
    
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    controller.updateWorkspace(req, res);
    
    expect(res.status).toHaveBeenCalledWith(200);
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.name).toBe('Espacio Actualizado');
    expect(responseData.capacity).toBe(25);
  });
  
  test('should handle delete workspace request', () => {
    const workspace = controller.service.createWorkspace({ name: 'Espacio a Eliminar', capacity: 15 });
    
    const req = { params: { id: workspace.id } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    controller.deleteWorkspace(req, res);
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ message: 'Workspace deleted successfully' });
    
    // Verify it's actually deleted
    const deletedWorkspace = controller.service.getWorkspaceById(workspace.id);
    expect(deletedWorkspace).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/controllers/__tests__/WorkspaceController.test.js`
Expected: FAIL with "Cannot find module '../WorkspaceController'"

- [ ] **Step 3: Write minimal implementation**

```javascript
class WorkspaceController {
  constructor(workspaceService) {
    this.service = workspaceService;
  }
  
  createWorkspace(req, res) {
    try {
      const workspace = this.service.createWorkspace(req.body);
      res.status(201).json(workspace);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
  
  getWorkspaceById(req, res) {
    const workspace = this.service.getWorkspaceById(req.params.id);
    if (workspace) {
      res.status(200).json(workspace);
    } else {
      res.status(404).json({ error: 'Workspace not found' });
    }
  }
  
  getAllWorkspaces(req, res) {
    const workspaces = this.service.getAllWorkspaces();
    res.status(200).json(workspaces);
  }
  
  updateWorkspace(req, res) {
    try {
      const workspace = this.service.updateWorkspace(req.params.id, req.body);
      if (workspace) {
        res.status(200).json(workspace);
      } else {
        res.status(404).json({ error: 'Workspace not found' });
      }
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
  
  deleteWorkspace(req, res) {
    const result = this.service.deleteWorkspace(req.params.id);
    if (result) {
      res.status(200).json({ message: 'Workspace deleted successfully' });
    } else {
      res.status(404).json({ error: 'Workspace not found' });
    }
  }
}

module.exports = WorkspaceController;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/controllers/__tests__/WorkspaceController.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/controllers/WorkspaceController.js src/controllers/__tests__/WorkspaceController.test.js
git commit -m "feat: create Workspace controller for API endpoints"
```

### Task 5: Crear un servidor básico Express para probar la API

**Files:**
- Create: `src/server.js`
- Create: `src/__tests__/server.test.js`
- Modify: `package.json` (add start script)

- [ ] **Step 1: Write the failing test**

```javascript
const request = require('supertest');
const express = require('express');
const WorkspaceController = require('../controllers/WorkspaceController');
const WorkspaceService = require('../services/WorkspaceService');
const WorkspaceRepository = require('../repositories/WorkspaceRepository');

describe('Server API Endpoints', () => {
  let app;
  let repository;
  let service;
  let controller;
  
  beforeEach(() => {
    repository = new WorkspaceRepository();
    service = new WorkspaceService(repository);
    controller = new WorkspaceController(service);
    
    app = express();
    app.use(express.json());
    
    // Define routes
    app.post('/workspaces', (req, res) => controller.createWorkspace(req, res));
    app.get('/workspaces/:id', (req, res) => controller.getWorkspaceById(req, res));
    app.get('/workspaces', (req, res) => controller.getAllWorkspaces(req, res));
    app.put('/workspaces/:id', (req, res) => controller.updateWorkspace(req, res));
    app.delete('/workspaces/:id', (req, res) => controller.deleteWorkspace(req, res));
  });
  
  test('should create a workspace via POST /workspaces', async () => {
    const response = await request(app)
      .post('/workspaces')
      .send({
        name: 'Aula de Inglés',
        type: 'classroom',
        capacity: 30,
        location: 'Edificio E, piso 2',
        equipment: ['pizarra interactiva', 'audífonos']
      })
      .expect(201);
    
    expect(response.body).toHaveProperty('id');
    expect(response.body.name).toBe('Aula de Inglés');
    expect(response.body.capacity).toBe(30);
  });
  
  test('should get a workspace via GET /workspaces/:id', async () => {
    // First create a workspace
    const createResponse = await request(app)
      .post('/workspaces')
      .send({ name: 'Sala de Estudio', capacity: 8 })
      .expect(201);
    
    const workspaceId = createResponse.body.id;
    
    // Then retrieve it
    const response = await request(app)
      .get(`/workspaces/${workspaceId}`)
      .expect(200);
    
    expect(response.body.id).toBe(workspaceId);
    expect(response.body.name).toBe('Sala de Estudio');
  });
  
  test('should return 404 for non-existent workspace via GET /workspaces/:id', async () => {
    await request(app)
      .get('/workspaces/non-existent-id')
      .expect(404)
      .expect({ error: 'Workspace not found' });
  });
  
  test('should get all workspaces via GET /workspaces', async () => {
    // Create two workspaces
    await request(app)
      .post('/workspaces')
      .send({ name: 'Espacio 1', capacity: 10 })
      .expect(201);
      
    await request(app)
      .post('/workspaces')
      .send({ name: 'Espacio 2', capacity: 15 })
      .expect(201);
    
    // Get all workspaces
    const response = await request(app)
      .get('/workspaces')
      .expect(200);
    
    expect(response.body.length).toBe(2);
    expect(response.body.some(w => w.name === 'Espacio 1')).toBe(true);
    expect(response.body.some(w => w.name === 'Espacio 2')).toBe(true);
  });
  
  test('should update a workspace via PUT /workspaces/:id', async () => {
    // First create a workspace
    const createResponse = await request(app)
      .post('/workspaces')
      .send({ name: 'Espacio Original', capacity: 20 })
      .expect(201);
    
    const workspaceId = createResponse.body.id;
    
    // Then update it
    const response = await request(app)
      .put(`/workspaces/${workspaceId}`)
      .send({ name: 'Espacio Actualizado', capacity: 25 })
      .expect(200);
    
    expect(response.body.name).toBe('Espacio Actualizado');
    expect(response.body.capacity).toBe(25);
    expect(response.body.id).toBe(workspaceId);
  });
  
  test('should delete a workspace via DELETE /workspaces/:id', async () => {
    // First create a workspace
    const createResponse = await request(app)
      .post('/workspaces')
      .send({ name: 'Espacio a Eliminar', capacity: 12 })
      .expect(201);
    
    const workspaceId = createResponse.body.id;
    
    // Then delete it
    await request(app)
      .delete(`/workspaces/${workspaceId}`)
      .expect(200)
      .expect({ message: 'Workspace deleted successfully' });
    
    // Verify it's deleted
    await request(app)
      .get(`/workspaces/${workspaceId}`)
      .expect(404)
      .expect({ error: 'Workspace not found' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/__tests__/server.test.js`
Expected: FAIL with "Cannot find module '../controllers/WorkspaceController'" or similar

- [ ] **Step 3: Write minimal implementation**

```javascript
const express = require('express');
const WorkspaceRepository = require('./repositories/WorkspaceRepository');
const WorkspaceService = require('./services/WorkspaceService');
const WorkspaceController = require('./controllers/WorkspaceController');

const app = express();

// Middleware
app.use(express.json());

// Initialize repository, service, and controller
const repository = new WorkspaceRepository();
const service = new WorkspaceService(repository);
const controller = new WorkspaceService(service);

// API Routes
app.post('/workspaces', (req, res) => controller.createWorkspace(req, res));
app.get('/workspaces/:id', (req, res) => controller.getWorkspaceById(req, res));
app.get('/workspaces', (req, res) => controller.getAllWorkspaces(req, res));
app.put('/workspaces/:id', (req, res) => controller.updateWorkspace(req, res));
app.delete('/workspaces/:id', (req, res) => controller.deleteWorkspace(req, res));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/__tests__/server.test.js`
Expected: PASS

- [ ] **Step 5: Update package.json**

```json
{
  "name": "workspace-reservation-system",
  "version": "1.0.0",
  "description": "A system for reserving workspaces such as classrooms and workshops",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js",
    "test": "jest"
  },
  "keywords": ["workspace", "reservation", "booking"],
  "author": "Workspace Reservation Team",
  "license": "MIT",
  "devDependencies": {
    "jest": "^29.0.0",
    "supertest": "^6.0.0"
  },
  "dependencies": {
    "express": "^4.18.0"
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/server.js src/__tests__/server.test.js package.json
git commit -m "feat: create Express server with workspace API endpoints"
```

## Resumen del Plan

Este plan implementa las funcionalidades básicas de gestión de espacios de trabajo para el sistema de reserva. Incluye:

1. Modelo de datos `Workspace` con validaciones
2. Repositorio en memoria para persistencia temporal
3. Servicio de lógica de negocio
4. Controlador para manejar peticiones HTTP (simulando una API REST)
5. Servidor Express con endpoints RESTful
6. Pruebas unitarias comprehensivas para cada capa

Cada tarea sigue el enfoque TDD (Test-Driven Development) con pasos claros para escribir pruebas fallidas, implementar la funcionalidad mínima, verificar que las pruebas pasen y hacer commits frecuentes.

**Próximos pasos sugeridos después de completar este plan:**
1. Implementar el modelo de datos `Reservation`
2. Agregar lógica de detección de conflictos de reserva
3. Implementar autenticación y autorización basada en roles
4. Añadir validaciones más complejas y manejo de errores
5. Reemplazar el repositorio en memoria por una base de datos real (como PostgreSQL o MongoDB)
6. Implementar la funcionalidad de vista de calendario y filtrado