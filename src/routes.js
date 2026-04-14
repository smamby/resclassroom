const workspaces = require('./components/workspaces/network');
const users = require('./components/user/network');
const bookings = require('./components/bookings/network');
const authMiddleware = require('./middleware/authMiddleware');
const authRouter = require('./components/auth/network');
const resetPasswordRoutes = require('./components/reset-password/network');

function routes(server) {
  server.use('/workspaces', workspaces);
  server.use('/users', users);
  server.use('/auth', authRouter);
  server.use('/', resetPasswordRoutes);
  // Mount the bookings module under the bookings subpath with auth
  server.use('/bookings', authMiddleware.authenticate, bookings);
}

module.exports = routes;
