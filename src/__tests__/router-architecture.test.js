const request = require('supertest');
const express = require('express');
const path = require('path');

describe('Express Router Architecture', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe('workspace network.js', () => {
    test('should export a router directly', () => {
      const workspaceRouter = require('../components/workspaces/network');
      expect(workspaceRouter).toHaveProperty('get');
      expect(workspaceRouter).toHaveProperty('post');
      expect(workspaceRouter).toHaveProperty('put');
      expect(workspaceRouter).toHaveProperty('delete');
    });

    test('should have routes defined', () => {
      const workspaceRouter = require('../components/workspaces/network');
      const routes = workspaceRouter.stack.map(r => r.route?.path).filter(Boolean);
      expect(routes).toContain('/');
      expect(routes).toContain('/:id');
    });
  });

  describe('user network.js', () => {
    test('should export a router directly', () => {
      const userRouter = require('../components/user/network');
      expect(userRouter).toHaveProperty('get');
      expect(userRouter).toHaveProperty('post');
      expect(userRouter).toHaveProperty('put');
      expect(userRouter).toHaveProperty('delete');
    });

    test('should have routes defined', () => {
      const userRouter = require('../components/user/network');
      const routes = userRouter.stack.map(r => r.route?.path).filter(Boolean);
      expect(routes).toContain('/');
      expect(routes).toContain('/:id');
      expect(routes).toContain('/email/:email');
    });
  });

  describe('routes.js', () => {
    test('should export a function that receives server', () => {
      const routes = require('../routes');
      expect(typeof routes).toBe('function');
    });

    test('should mount workspace router at /workspaces', () => {
      const routes = require('../routes');
      routes(app);

      const routesRegistered = app._router.stack
        .filter(r => r.name === 'router')
        .map(r => r.regexp.source);

      expect(routesRegistered.some(r => r.includes('workspaces'))).toBe(true);
    });

    test('should mount user router at /users', () => {
      const routes = require('../routes');
      routes(app);

      const routesRegistered = app._router.stack
        .filter(r => r.name === 'router')
        .map(r => r.regexp.source);

      expect(routesRegistered.some(r => r.includes('users'))).toBe(true);
    });
  });
});
