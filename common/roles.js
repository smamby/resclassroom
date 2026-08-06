// Definición única de roles. Se exporta como objeto directo en CommonJS
// (Node.js y Jest) y como global en el navegador (window.ROLES). No usar
// export/import ESM para no romper la carga como script clásico ni en Jest.
const ROLES = Object.freeze({
  ADMIN: 'admin',
  INSTRUCTOR: 'instructor',
  VISITOR: 'visitor',
  SUBCO: 'subco'
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ROLES;
}

if (typeof window !== 'undefined') {
  window.ROLES = ROLES;
}
