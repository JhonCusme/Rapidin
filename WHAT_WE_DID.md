# Qué hemos hecho hasta ahora en Rapidin 🚀

- **Estructura del Proyecto:**
  - Creada una aplicación con un backend (Node.js/Express/SQLite) y aplicaciones frontend para cliente y repartidor (HTML/JS).
- **Backend (`server.js`):**
  - Servidor Express con WebSockets (Socket.IO).
  - Base de datos local usando SQLite (`rapidin.db`).
  - Endpoints REST para autenticación (Registro/Login) para usuarios, comercios y repartidores.
  - Endpoints para gestión de pedidos, catálogo de tiendas y productos.
- **App Cliente (`apps/user/index.html`):**
  - Interfaz web orientada a móviles ("dark theme") para clientes.
  - Vistas de inicio de sesión y registro.
  - Pantalla principal con carrusel de ofertas, listado de tiendas y seguimiento en vivo con mapa interactivo (Leaflet).
  - Sistema de carrito de compras, opciones de envío/retiro, propinas y suscripción VIP (Prime Pass).
- **App Repartidor (`apps/driver/index.html`):**
  - Interfaz web para la consola del chofer.
  - Vistas de registro de vehículo y login.
  - Panel principal que muestra ganancias del día, historial de entregas y mapa de navegación GPS.
- **Recursos Compartidos:**
  - Lógica base compartida (`db.js`, `i18n.js`, `sync.js`, chat, pagos) y estilos CSS core.
