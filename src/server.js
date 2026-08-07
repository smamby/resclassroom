require('dotenv').config();
const express = require('express');
const path = require('path');
const routes = require('./routes');
const { connectToDatabase, closeDatabaseConnection } = require('./db');

const app = express();
let server;
let isShuttingDown = false;

app.use(express.json());

// Test authentication shim: in test mode, set req.user from headers
if (process.env.TEST_AUTH === '1') {
  app.use((req, res, next) => {
    const id = req.headers['x-user-id'];
    const role = req.headers['x-user-role'];
    if (id && role) {
      try {
        const parsedRole = typeof role === 'string' ? JSON.parse(role) : role;
        req.user = { id, role: Array.isArray(parsedRole) ? parsedRole : [parsedRole] };
      } catch (e) {
        req.user = { id, role: [role] };
      }
    }
    next();
  });
}
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/common', express.static(path.join(__dirname, '../common')));

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/reset-password/:token', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'reset-password.html'));
});

app.get('/delete-account/:token', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'delete-account.html'));
});

// Rutas y error handler se montan a nivel de módulo para que la app exportada
// (usada por los tests de integración con supertest) tenga todas las rutas
routes(app);

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});


function gracefulShutdown(signal) {
  if (isShuttingDown) {
    console.log(`Señal ${signal} ignorada, apagado en curso.`);
    return;
  }
  isShuttingDown = true;
  console.log(`Recibida señal ${signal}. Cerrando conexiones...`);

  const finalize = async () => {
    try {
      await closeDatabaseConnection();
      console.log('Cierre ordenado finalizado.');
      process.exit(0);
    } catch (err) {
      console.error('Error al cerrar la base de datos:', err);
      process.exit(1);
    }
  };

  if (server) {
    const forceExitTimer = setTimeout(() => {
      console.error('Timeout de 8s alcanzado, forzando salida.');
      process.exit(1);
    }, 8000);

    server.close(() => {
      console.log('Servidor cerrado correctamente.');
      clearTimeout(forceExitTimer);
      finalize();
    });

    // Fuerza cierre de conexiones HTTP keep-alive inactivas (Node >= 18.2)
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
  } else {
    // Servidor aún no iniciado: cerramos la DB si está abierta
    finalize();
  }
}

// ---------- LISTENERS (se registran ANTES de arrancar) ----------
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));


const startServer = async () => {
    try {
        await connectToDatabase();

        const PORT = process.env.PORT || 3000;
        server = app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Failed to connect to database', err);
        process.exit(1);
    }
};

// Solo arranca el server cuando se ejecuta directamente (node src/server.js).
// Al importarlo (tests de integración con supertest) se expone la app sin abrir puertos.
if (require.main === module) {
    startServer();
}

module.exports = app; // se exporta solo para Jest
