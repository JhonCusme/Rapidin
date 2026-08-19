/* ==========================================================================
   RAPIDIN - EXPRESS BACKEND REST API, SQLITE & WEBSOCKETS SERVER
   ========================================================================== */

require('dotenv').config();

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// ==========================================
// SEGURIDAD: SECRETOS Y CONFIGURACIÓN
// ==========================================

if (NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET no está definido. En producción es obligatorio configurarlo en .env');
  process.exit(1);
}
// En desarrollo, si no hay JWT_SECRET, generamos uno aleatorio para esta ejecución
// (las sesiones no sobrevivirán a un reinicio, pero nunca usamos un secreto fijo en el código).
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET no configurado: se generó uno temporal solo para esta sesión de desarrollo.');
}

const ADMIN_SETUP_KEY = process.env.ADMIN_SETUP_KEY || null;

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,capacitor://localhost,http://localhost')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Peticiones sin "origin" (apps nativas, curl, mismo servidor) se permiten.
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('No permitido por CORS'));
  }
};

const io = new Server(server, { cors: corsOptions });

// Conectar a SQLite
const dbPath = path.join(__dirname, 'db', 'rapidin.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error conectando a la base de datos:', err.message);
  } else {
    console.log('📦 Conectado a la Base de Datos SQLite (rapidin.db)');
    db.run("ALTER TABLE users ADD COLUMN active BOOLEAN DEFAULT 1", (err) => {});
  }
});

// helmet añade cabeceras de seguridad estándar (HSTS, noSniff, frameguard, etc).
// La CSP por defecto se desactiva porque el frontend usa CDNs (Font Awesome, Leaflet,
// Unsplash, CartoDB) y estilos/scripts inline extensivamente; una CSP estricta rompería
// la UI. El resto de protecciones de helmet permanecen activas.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname)));

// Límite de intentos en endpoints de autenticación para dificultar fuerza bruta / enumeración
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiados intentos. Intenta de nuevo en unos minutos.' }
});
app.use('/api/auth', authLimiter);

// ==========================================
// MIDDLEWARE DE AUTENTICACIÓN Y AUTORIZACIÓN
// ==========================================

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ success: false, message: 'Token de acceso requerido' });
  }
  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ success: false, message: 'Token inválido o expirado' });
    req.user = payload;
    next();
  });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'No tienes permisos para esta acción' });
    }
    next();
  };
}

// ==========================================
// API REST ENDPOINTS
// ==========================================

// 1. Registro de Usuario Cliente (Auth)
app.post('/api/auth/register-user', async (req, res) => {
  const { email, password, name, phone, address } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ success: false, message: 'Faltan datos requeridos' });
  }

  const userId = 'usr-' + Date.now();
  const passwordHash = await bcrypt.hash(password, 10);
  const userRole = 'user';

  const sql = `INSERT INTO users (id, role, email, password_hash, name, phone, default_address) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [userId, userRole, email, passwordHash, name, phone || '', address || ''], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ success: false, message: 'El correo ya está registrado' });
      }
      return res.status(500).json({ success: false, message: 'Error interno de BD' });
    }
    
    const token = jwt.sign({ id: userId, email, role: userRole }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: userId, email, name, role: userRole, phone, address } });
  });
});

// 1.1 Registro de Comercio (Auth)
app.post('/api/auth/register-store', async (req, res) => {
  const { email, password, name, category, address } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ success: false, message: 'Faltan datos requeridos' });
  }

  const userId = 'usr-' + Date.now();
  const storeId = 'str-' + Date.now();
  const passwordHash = await bcrypt.hash(password, 10);
  const userRole = 'store';

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.run(`INSERT INTO users (id, role, email, password_hash, name) VALUES (?, ?, ?, ?, ?)`, 
      [userId, userRole, email, passwordHash, name], function(err) {
        if (err) {
          db.run('ROLLBACK');
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ success: false, message: 'El correo ya está registrado' });
          }
          return res.status(500).json({ success: false, message: 'Error interno de BD' });
        }
        
        db.run(`INSERT INTO stores (id, name, category, address) VALUES (?, ?, ?, ?)`,
          [storeId, name, category || 'General', address || ''], function(err2) {
            if (err2) {
              db.run('ROLLBACK');
              return res.status(500).json({ success: false, message: 'Error al crear comercio' });
            }
            db.run('COMMIT');
            const token = jwt.sign({ id: userId, email, role: userRole, storeId }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ success: true, token, user: { id: userId, email, name, role: userRole, storeId } });
        });
    });
  });
});

// 1.2 Registro de Repartidor (Auth)
app.post('/api/auth/register-driver', async (req, res) => {
  const { email, password, name, vehicle_type, vehicle_plate } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ success: false, message: 'Faltan datos requeridos' });
  }

  const userId = 'usr-' + Date.now();
  const driverId = 'drv-' + Date.now();
  const passwordHash = await bcrypt.hash(password, 10);
  const userRole = 'driver';
  const vehicleInfo = `${vehicle_type} - ${vehicle_plate}`;

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    db.run(`INSERT INTO users (id, role, email, password_hash, name) VALUES (?, ?, ?, ?, ?)`, 
      [userId, userRole, email, passwordHash, name], function(err) {
        if (err) {
          db.run('ROLLBACK');
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ success: false, message: 'El correo ya está registrado' });
          }
          return res.status(500).json({ success: false, message: 'Error interno de BD' });
        }
        
        db.run(`INSERT INTO drivers (id, user_id, name, vehicle_info) VALUES (?, ?, ?, ?)`,
          [driverId, userId, name, vehicleInfo], function(err2) {
            if (err2) {
              db.run('ROLLBACK');
              return res.status(500).json({ success: false, message: 'Error al crear repartidor' });
            }
            db.run('COMMIT');
            const token = jwt.sign({ id: userId, email, role: userRole, driverId }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ success: true, token, user: { id: userId, email, name, role: userRole, driverId } });
        });
    });
  });
});


// 1.2.1 Login/Registro por Teléfono (Auth) - usado por el flujo de verificación SMS
// La posesión del código SMS (verificado en el cliente) es el factor de autenticación;
// no se requiere contraseña. Si el teléfono ya existe, inicia sesión; si no, lo crea.
app.post('/api/auth/phone-login', async (req, res) => {
  const { phone, name, email } = req.body;
  if (!phone) {
    return res.status(400).json({ success: false, message: 'Falta el número de teléfono' });
  }

  db.get(`SELECT * FROM users WHERE phone = ? AND role = 'user'`, [phone], async (err, existing) => {
    if (err) return res.status(500).json({ success: false, message: 'Error de servidor' });

    if (existing) {
      const token = jwt.sign({ id: existing.id, email: existing.email, role: existing.role }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ success: true, token, user: { id: existing.id, email: existing.email, name: existing.name, role: existing.role, phone: existing.phone } });
    }

    if (!name || !email) {
      return res.status(404).json({ success: false, message: 'Número no registrado. Completa tu perfil para crear una cuenta.' });
    }

    const userId = 'usr-' + Date.now();
    const randomPassword = crypto.randomBytes(24).toString('hex');
    const passwordHash = await bcrypt.hash(randomPassword, 10);

    const sql = `INSERT INTO users (id, role, email, password_hash, name, phone) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(sql, [userId, 'user', email, passwordHash, name, phone], function(insertErr) {
      if (insertErr) {
        if (insertErr.message.includes('UNIQUE')) {
          return res.status(400).json({ success: false, message: 'El correo ya está registrado' });
        }
        return res.status(500).json({ success: false, message: 'Error interno de BD' });
      }
      const token = jwt.sign({ id: userId, email, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ success: true, token, user: { id: userId, email, name, role: 'user', phone } });
    });
  });
});

// 1.3 Registro de Administrador (Auth) - protegido por clave de configuración
app.post('/api/auth/register-admin', async (req, res) => {
  const { email, password, name, setupKey } = req.body;
  if (!ADMIN_SETUP_KEY) {
    return res.status(403).json({ success: false, message: 'El registro de administradores está deshabilitado (configura ADMIN_SETUP_KEY en .env)' });
  }
  if (!setupKey || setupKey !== ADMIN_SETUP_KEY) {
    return res.status(403).json({ success: false, message: 'Clave de configuración inválida' });
  }
  if (!email || !password || !name) {
    return res.status(400).json({ success: false, message: 'Faltan datos requeridos' });
  }

  const userId = 'usr-' + Date.now();
  const passwordHash = await bcrypt.hash(password, 10);
  const userRole = 'admin';

  const sql = `INSERT INTO users (id, role, email, password_hash, name) VALUES (?, ?, ?, ?, ?)`;
  db.run(sql, [userId, userRole, email, passwordHash, name], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE')) {
        return res.status(400).json({ success: false, message: 'El correo ya está registrado' });
      }
      return res.status(500).json({ success: false, message: 'Error interno de BD' });
    }
    const token = jwt.sign({ id: userId, email, role: userRole }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: userId, email, name, role: userRole } });
  });
});

// 2. Login de Usuario (Auth)
app.post('/api/auth/login', (req, res) => {
  const { email, password, role } = req.body;
  
  const sql = `SELECT * FROM users WHERE email = ? AND role = ?`;
  db.get(sql, [email, role || 'user'], async (err, user) => {
    if (err) return res.status(500).json({ success: false, message: 'Error de servidor' });
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado o rol incorrecto' });

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  });
});

// 3. Crear Pedido (Orders)
app.post('/api/orders', authenticateToken, requireRole('user'), (req, res) => {
  const newOrder = req.body;
  const orderId = newOrder.id; // 'RPD-12345'

  const sql = `
    INSERT INTO orders (
      id, customer_id, store_id, customer_address, items_json,
      subtotal_usd, shipping_fee_usd, driver_tip_usd, total_amount_usd, platform_commission_usd,
      status_step, status_text
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const itemsJson = JSON.stringify(newOrder.items || []);
  const subtotal = newOrder.subtotal || 0;
  const shipping = newOrder.shippingFee || 1.99;
  const tip = newOrder.driverTip || 0;
  const total = newOrder.total || (subtotal + shipping + tip);
  const commission = total * 0.15; // 15% platform commission

  db.run(sql, [
    orderId,
    req.user.id,
    newOrder.storeId,
    newOrder.customerAddress || '',
    itemsJson,
    subtotal,
    shipping,
    tip,
    total,
    commission,
    0,
    newOrder.statusText || 'Pedido creado'
  ], (err) => {
    if (err) {
      console.error('Error al guardar pedido:', err);
      return res.status(500).json({ success: false, message: 'Error guardando pedido' });
    }
    
// Emitir por Sockets a todos los comercios conectados
    io.emit('ORDER_CREATED', newOrder);
    res.json({ success: true, order: newOrder });
  });
});

// 3.1 Obtener pedidos de una tienda
app.get('/api/orders/store/:storeId', authenticateToken, requireRole('store', 'admin'), (req, res) => {
  const { storeId } = req.params;
  if (req.user.role === 'store' && req.user.storeId !== storeId) {
    return res.status(403).json({ success: false, message: 'No puedes ver pedidos de otro comercio' });
  }
  const sql = `
    SELECT orders.*, stores.name as storeName 
    FROM orders 
    LEFT JOIN stores ON orders.store_id = stores.id 
    WHERE orders.store_id = ? 
    ORDER BY orders.created_at DESC
  `;
  db.all(sql, [storeId], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Error fetching orders' });
    
    const orders = rows.map(r => ({
      ...r,
      items: r.items_json ? JSON.parse(r.items_json) : []
    }));
    res.json({ success: true, orders });
  });
});

// 3.1.1 Obtener pedidos del cliente autenticado ("Mis pedidos")
app.get('/api/orders/mine', authenticateToken, requireRole('user'), (req, res) => {
  const sql = `
    SELECT orders.*, stores.name as storeName
    FROM orders
    LEFT JOIN stores ON orders.store_id = stores.id
    WHERE orders.customer_id = ?
    ORDER BY orders.created_at DESC
  `;
  db.all(sql, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Error fetching orders' });

    const orders = rows.map(r => ({
      ...r,
      items: r.items_json ? JSON.parse(r.items_json) : []
    }));
    res.json({ success: true, orders });
  });
});

// 3.2 Obtener pedidos pendientes para conductores (listos para recoger o en preparación)
app.get('/api/orders/pending', authenticateToken, requireRole('driver', 'admin'), (req, res) => {
  // status_step 1 o 2
  const sql = `
    SELECT orders.*, stores.name as storeName 
    FROM orders 
    LEFT JOIN stores ON orders.store_id = stores.id 
    WHERE orders.status_step >= 1 AND orders.status_step < 3 
    ORDER BY orders.created_at ASC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Error fetching pending orders' });
    
    const orders = rows.map(r => ({
      ...r,
      items: r.items_json ? JSON.parse(r.items_json) : []
    }));
    res.json({ success: true, orders });
  });
});

// 3.4 Obtener un pedido por ID
app.get('/api/orders/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const sql = `SELECT orders.*, stores.name as storeName FROM orders LEFT JOIN stores ON orders.store_id = stores.id WHERE orders.id = ?`;
  db.get(sql, [id], (err, row) => {
    if (err) return res.status(500).json({ success: false, message: 'Error fetching order' });
    if (!row) return res.status(404).json({ success: false, message: 'Order not found' });

    const isOwner = req.user.role === 'admin'
      || req.user.id === row.customer_id
      || (req.user.role === 'store' && req.user.storeId === row.store_id)
      || req.user.role === 'driver';
    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'No autorizado para ver este pedido' });
    }

    const order = {
      ...row,
      items: row.items_json ? JSON.parse(row.items_json) : []
    };
    res.json({ success: true, order });
  });
});

// 3.3 Actualizar estado de pedido
app.put('/api/orders/:id/status', authenticateToken, requireRole('store', 'driver', 'admin'), (req, res) => {
  const { id } = req.params;
  const { statusStep, statusText, extraData } = req.body;
  
  const sql = `UPDATE orders SET status_step = ?, status_text = ? WHERE id = ?`;
  db.run(sql, [statusStep, statusText, id], function(err) {
    if (err) return res.status(500).json({ success: false, message: 'Error updating order' });
    
    const payload = { orderId: id, statusStep, statusText, ...extraData };
    io.emit('ORDER_STATUS_CHANGED', payload);
    
    res.json({ success: true, payload });
  });
});

// Función auxiliar: Fórmula de Haversine para calcular distancia en km
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  var R = 6371; // Radio de la tierra en km
  var dLat = deg2rad(lat2-lat1);
  var dLon = deg2rad(lon2-lon1); 
  var a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  var d = R * c; 
  return d;
}
function deg2rad(deg) {
  return deg * (Math.PI/180)
}

// 4. Catálogo: Obtener todos los comercios
app.get('/api/stores', (req, res) => {
  const { lat, lng } = req.query;
  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);
  
  const sql = `SELECT * FROM stores WHERE is_open = 1`;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Error al obtener tiendas' });
    
    // Parsear tags de JSON string a Array y mapear propiedades
    let stores = rows.map(store => ({
      ...store,
      image: store.image_url,
      logo: store.logo_url,
      reviewsCount: Math.floor(Math.random() * 500) + 50, // mock reviewsCount
      isTurbo: store.is_turbo === 1,
      deliveryTime: store.delivery_time,
      deliveryFee: store.delivery_fee,
      minOrder: store.min_order,
      tags: store.tags ? JSON.parse(store.tags) : []
    }));
    
    // Filtrar por distancia si se proveen coordenadas
    if (!isNaN(userLat) && !isNaN(userLng)) {
      stores = stores.filter(store => {
        if (!store.lat || !store.lng) return true; // Si la tienda no tiene lat/lng, la mostramos
        const distanceKm = getDistanceFromLatLonInKm(userLat, userLng, store.lat, store.lng);
        return distanceKm <= (store.delivery_radius_km || 5.00);
      });
    }
    
    res.json({ success: true, stores });
  });
});

// 5. Catálogo: Obtener productos de un comercio
app.get('/api/products/:storeId', (req, res) => {
  const { storeId } = req.params;
  const sql = `SELECT * FROM products WHERE store_id = ? AND is_available = 1`;
  db.all(sql, [storeId], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Error al obtener productos' });
    
    // Parsear options_json a Array y mapear propiedades
    const products = rows.map(prod => ({
      ...prod,
      price: prod.price_usd,
      image: prod.image_url,
      popular: prod.is_popular === 1,
      options: prod.options_json ? JSON.parse(prod.options_json) : []
    }));
    
    res.json({ success: true, products });
  });
});

// 6. Configuración global (Categorías, Ofertas)
app.get('/api/config', (req, res) => {
  res.json({
    success: true,
    categories: [
      { id: 'all', name: 'Todo', icon: 'fa-border-all', badge: null },
      { id: 'turbo', name: 'Turbo 15m', icon: 'fa-bolt', badge: '15 MIN' },
      { id: 'restaurants', name: 'Restaurantes', icon: 'fa-utensils', badge: 'Populares' },
      { id: 'supermarket', name: 'Supermercado', icon: 'fa-basket-shopping', badge: 'Ofertas' },
      { id: 'pharmacy', name: 'Farmacia 24/7', icon: 'fa-kit-medical', badge: '24 hrs' },
      { id: 'drinks', name: 'Licores & Fiesta', icon: 'fa-wine-glass', badge: 'Frio' },
      { id: 'express', name: 'Mándame Algo', icon: 'fa-box-open', badge: 'Nuevo' }
    ],
    flashDeals: [
      { id: 'deal-1', title: '⚡ Rapidin Turbo - 40% OFF', subtitle: 'En frutas, verduras y snacks', code: 'TURBO40', tag: 'OFERTA FLASH', gradient: 'linear-gradient(135deg, #FF3366 0%, #FF6600 100%)', endsInSeconds: 3590 },
      { id: 'deal-2', title: '🍔 2x1 en Hamburguesas Prime', subtitle: 'Lleva la segunda gratis', code: '2X1BURGER', tag: 'VIP', gradient: 'linear-gradient(135deg, #7928CA 0%, #FF0080 100%)', endsInSeconds: 7190 }
    ]
  });
});

// ==========================================
// ADMIN REST ENDPOINTS
// ==========================================

app.use('/api/admin', authenticateToken, requireRole('admin'));

app.get('/api/admin/overview', (req, res) => {
  const data = {};
  db.get("SELECT COUNT(*) as count FROM users WHERE role = 'store'", [], (err, storeRow) => {
    data.storeCount = storeRow ? storeRow.count : 0;
    db.get("SELECT COUNT(*) as count FROM users WHERE role = 'driver'", [], (err, driverRow) => {
      data.driverCount = driverRow ? driverRow.count : 0;
      db.get("SELECT SUM(total_amount_usd) as gmv, SUM(platform_commission_usd) as commission FROM orders", [], (err, orderRow) => {
        data.gmv = orderRow && orderRow.gmv ? orderRow.gmv : 0;
        data.commission = orderRow && orderRow.commission ? orderRow.commission : 0;
        res.json({ success: true, payload: data });
      });
    });
  });
});

app.get('/api/admin/orders', (req, res) => {
  const sql = `
    SELECT o.id, u.name as storeName, o.customer_address as customerName, o.total_amount_usd as total, o.status_text as statusText 
    FROM orders o 
    LEFT JOIN users u ON o.store_id = u.id 
    ORDER BY o.created_at DESC LIMIT 50
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.json({ success: false });
    res.json({ success: true, payload: rows });
  });
});

app.get('/api/admin/users/:role', (req, res) => {
  const role = req.params.role;
  db.all("SELECT id, name, email, active FROM users WHERE role = ?", [role], (err, rows) => {
    if (err) return res.json({ success: false });
    res.json({ success: true, payload: rows });
  });
});

app.put('/api/admin/users/:id/toggle', (req, res) => {
  const id = req.params.id;
  db.get("SELECT active FROM users WHERE id = ?", [id], (err, row) => {
    if (err || !row) return res.json({ success: false });
    const newState = row.active ? 0 : 1;
    db.run("UPDATE users SET active = ? WHERE id = ?", [newState, id], (err) => {
      if (err) return res.json({ success: false });
      res.json({ success: true, active: newState });
    });
  });
});

// ==========================================
// WEBSOCKETS (Socket.IO)
// ==========================================
io.on('connection', (socket) => {
  console.log('⚡ Nuevo cliente conectado:', socket.id);

  socket.on('UPDATE_ORDER_STATUS', (data) => {
    // Retransmitir actualización a los demás
    io.emit('ORDER_STATUS_CHANGED', data);
  });
  
  socket.on('CHAT_MESSAGE_SENT', (data) => {
    io.emit('CHAT_MESSAGE_SENT', data);
  });

  socket.on('disconnect', () => {
    console.log('❌ Cliente desconectado:', socket.id);
  });
});

// ==========================================
// SERVIDOR WEB
// ==========================================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(PORT, () => {
  console.log(`🚀 Servidor Rapidin Funcional (API + SQLite + Sockets) activo en http://localhost:${PORT}`);
});
