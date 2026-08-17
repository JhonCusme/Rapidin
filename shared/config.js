/* ==========================================================================
   RAPIDIN - CONFIGURACIÓN COMPARTIDA (URL BASE DE LA API)
   ========================================================================== */

window.RAPIDIN_API_BASE = (function () {
  const { protocol, hostname, port } = window.location;

  // Apps empaquetadas con Capacitor (capacitor://, file://) no tienen un
  // origen HTTP válido: apuntamos siempre al backend local de desarrollo.
  if (protocol === 'capacitor:' || protocol === 'file:') {
    return 'http://localhost:3000';
  }

  // En desarrollo local el backend corre en el puerto 3000.
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:3000`;
  }

  // En producción, servido por el propio server.js (mismo origen).
  return `${protocol}//${hostname}${port ? ':' + port : ''}`;
})();
