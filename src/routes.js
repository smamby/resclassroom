const workspaces = require('./components/workspaces/network');
const users = require('./components/user/network');
const bookings = require('./components/bookings/network');

function routes(server) {
  server.use('/workspaces', workspaces);
  server.use('/users', users);
  // Mount the bookings module under the bookings subpath
  server.use('/bookings', bookings);
}

module.exports = routes;
