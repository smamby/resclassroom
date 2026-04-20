require('dotenv').config();
const express = require('express');
const path = require('path');
const routes = require('./routes');
const { connectToDatabase } = require('./db');

const app = express();

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

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/reset-password/:token', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'reset-password.html'));
});

const startServer = async () => {
    try {
        await connectToDatabase();
        routes(app);

        app.use((err, req, res, next) => {
            console.error(err.stack);
            res.status(500).json({ error: 'Something went wrong!' });
        });

        const PORT = process.env.PORT || 3000;
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Failed to connect to database', err);
        process.exit(1);
    }
};

startServer();

module.exports = app;
