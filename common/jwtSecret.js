// Secret JWT en un solo lugar: middleware, controllers y tests comparten el
// mismo valor aunque falte JWT_SECRET (si no, login firma con un secret y el
// middleware verifica con otro).
module.exports = process.env.JWT_SECRET || 'harito ama la playa';
