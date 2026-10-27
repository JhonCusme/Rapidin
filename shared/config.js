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

  // Permite apuntar a otro backend sin tocar código: localStorage.setItem('rapidin_api_base', 'http://localhost:4000')
  try {
    const override = localStorage.getItem('rapidin_api_base');
    if (override) return override.replace(/\/$/, '');
  } catch (e) { /* almacenamiento bloqueado: seguimos con el valor por defecto */ }

  // Si la página la sirve el propio server.js (rutas /apps/...), la API está en el mismo origen,
  // sea cual sea el puerto. Así se pueden levantar varias instancias (por ejemplo, una de pruebas).
  if (window.location.pathname.startsWith('/apps/')) {
    return `${protocol}//${hostname}${port ? ':' + port : ''}`;
  }

  // Cualquier otro servidor de archivos estáticos en local: el backend corre en el puerto 3000.
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:3000`;
  }

  // En producción, servido por el propio server.js (mismo origen).
  return `${protocol}//${hostname}${port ? ':' + port : ''}`;
})();


// Mapas: un único lugar para el proveedor de teselas. Se usa OpenStreetMap (sin clave).
// El proveedor anterior (CARTO) ahora exige API key y mostraba "API KEY REQUIRED" sobre los mapas.
// Para producción con mucho tráfico conviene un proveedor propio (MapTiler, Stadia, Mapbox...): basta cambiar esta URL.
window.RAPIDIN_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
window.RAPIDIN_TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
