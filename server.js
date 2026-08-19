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

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || null;
const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY || null;
const stripe = STRIPE_SECRET_KEY ? require('stripe')(STRIPE_SECRET_KEY) : null;
if (!stripe) {
  console.warn('⚠️  STRIPE_SECRET_KEY no configurado: la sección de métodos de pago quedará deshabilitada.');
}

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
    db.run("ALTER TABLE users ADD COLUMN photo_url TEXT", (err) => {});
    db.run("ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(100)", (err) => {});
    db.run("ALTER TABLE orders ADD COLUMN coupon_code VARCHAR(50)", (err) => {});
    db.run("ALTER TABLE orders ADD COLUMN discount_usd DECIMAL(10,2) DEFAULT 0.00", (err) => {});
    db.run("ALTER TABLE orders ADD COLUMN rating_order INT", (err) => {});
    db.run("ALTER TABLE orders ADD COLUMN rating_driver INT", (err) => {});
    db.run("ALTER TABLE orders ADD COLUMN rating_store INT", (err) => {});
    db.run("ALTER TABLE orders ADD COLUMN review_text TEXT", (err) => {});
    db.run(`CREATE TABLE IF NOT EXISTS addresses (
      id VARCHAR(50) PRIMARY KEY, user_id VARCHAR(50) NOT NULL, label VARCHAR(50) NOT NULL DEFAULT 'Casa',
      address_text TEXT NOT NULL, reference TEXT, lat DECIMAL(10,6), lng DECIMAL(10,6),
      is_default BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS payment_methods (
      id VARCHAR(50) PRIMARY KEY, user_id VARCHAR(50) NOT NULL, stripe_payment_method_id VARCHAR(100) NOT NULL,
      brand VARCHAR(30), last4 VARCHAR(4), exp_month INT, exp_year INT, cardholder_name VARCHAR(255),
      is_default BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS coupons (
      id VARCHAR(50) PRIMARY KEY, code VARCHAR(50) UNIQUE NOT NULL, title VARCHAR(255) NOT NULL, description TEXT,
      discount_type VARCHAR(20) NOT NULL DEFAULT 'fixed', discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
      min_order_usd DECIMAL(10,2) DEFAULT 0, is_active BOOLEAN DEFAULT TRUE, expires_at TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS user_coupons (
      id VARCHAR(50) PRIMARY KEY, user_id VARCHAR(50) NOT NULL, coupon_id VARCHAR(50) NOT NULL,
      redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, used_at TIMESTAMP, order_id VARCHAR(50)
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS notification_preferences (
      user_id VARCHAR(50) PRIMARY KEY, orders_enabled BOOLEAN DEFAULT TRUE, promotions_enabled BOOLEAN DEFAULT TRUE,
      offers_enabled BOOLEAN DEFAULT TRUE, news_enabled BOOLEAN DEFAULT FALSE
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS order_messages (
      id VARCHAR(50) PRIMARY KEY, order_id VARCHAR(50) NOT NULL, sender_role VARCHAR(20) NOT NULL,
      sender_id VARCHAR(50) NOT NULL, text TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS support_tickets (
      id VARCHAR(50) PRIMARY KEY, user_id VARCHAR(50) NOT NULL, order_id VARCHAR(50),
      category VARCHAR(50) NOT NULL, subject VARCHAR(255) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS support_messages (
      id VARCHAR(50) PRIMARY KEY, ticket_id VARCHAR(50) NOT NULL, sender_role VARCHAR(20) NOT NULL,
      text TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
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
      status_step, status_text, coupon_code, discount_usd
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const itemsJson = JSON.stringify(newOrder.items || []);
  const subtotal = newOrder.subtotal || 0;
  const shipping = newOrder.shippingFee || 1.99;
  const tip = newOrder.driverTip || 0;
  const discount = newOrder.discount || 0;
  const total = newOrder.total || (subtotal + shipping + tip - discount);
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
    newOrder.statusText || 'Pedido creado',
    newOrder.couponCode || null,
    discount
  ], (err) => {
    if (err) {
      console.error('Error al guardar pedido:', err);
      return res.status(500).json({ success: false, message: 'Error guardando pedido' });
    }

    if (newOrder.couponCode) {
      db.run(
        `UPDATE user_coupons SET used_at = CURRENT_TIMESTAMP, order_id = ?
         WHERE user_id = ? AND used_at IS NULL AND coupon_id = (SELECT id FROM coupons WHERE code = ?)`,
        [orderId, req.user.id, newOrder.couponCode]
      );
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

// ==========================================
// CUENTA: PERFIL, DIRECCIONES, PAGOS, CUPONES, NOTIFICACIONES
// ==========================================

// --- Perfil ---
app.put('/api/auth/profile', authenticateToken, requireRole('user'), (req, res) => {
  const { name, email, phone, photoUrl } = req.body;
  if (!name || !email) {
    return res.status(400).json({ success: false, message: 'Nombre y correo son requeridos' });
  }
  db.run(
    `UPDATE users SET name = ?, email = ?, phone = COALESCE(?, phone), photo_url = COALESCE(?, photo_url) WHERE id = ?`,
    [name, email, phone || null, photoUrl || null, req.user.id],
    function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) return res.status(400).json({ success: false, message: 'El correo ya está en uso' });
        return res.status(500).json({ success: false, message: 'Error actualizando el perfil' });
      }
      db.get('SELECT id, email, name, role, phone, photo_url FROM users WHERE id = ?', [req.user.id], (e, user) => {
        if (e || !user) return res.status(500).json({ success: false, message: 'Error obteniendo el perfil actualizado' });
        const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, user: { id: user.id, email: user.email, name: user.name, role: user.role, phone: user.phone, photoUrl: user.photo_url } });
      });
    }
  );
});

app.put('/api/auth/change-phone', authenticateToken, requireRole('user'), (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ success: false, message: 'Falta el nuevo número' });
  db.run('UPDATE users SET phone = ? WHERE id = ?', [phone, req.user.id], (err) => {
    if (err) return res.status(500).json({ success: false, message: 'Error actualizando el número' });
    res.json({ success: true, phone });
  });
});

app.delete('/api/auth/account', authenticateToken, requireRole('user'), (req, res) => {
  const userId = req.user.id;
  db.serialize(() => {
    db.run('DELETE FROM addresses WHERE user_id = ?', [userId]);
    db.run('DELETE FROM payment_methods WHERE user_id = ?', [userId]);
    db.run('DELETE FROM notification_preferences WHERE user_id = ?', [userId]);
    db.run('DELETE FROM user_coupons WHERE user_id = ?', [userId]);
    db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Error eliminando la cuenta' });
      res.json({ success: true });
    });
  });
});

// --- Direcciones ---
app.get('/api/addresses', authenticateToken, requireRole('user'), (req, res) => {
  db.all('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, created_at DESC', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Error obteniendo direcciones' });
    res.json({ success: true, addresses: rows });
  });
});

app.post('/api/addresses', authenticateToken, requireRole('user'), (req, res) => {
  const { label, addressText, reference, lat, lng, isDefault } = req.body;
  if (!addressText) return res.status(400).json({ success: false, message: 'Falta la dirección' });
  const id = 'addr-' + Date.now();

  const insertFn = () => {
    db.run(
      `INSERT INTO addresses (id, user_id, label, address_text, reference, lat, lng, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, req.user.id, label || 'Casa', addressText, reference || '', lat || null, lng || null, isDefault ? 1 : 0],
      (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Error guardando la dirección' });
        res.json({ success: true, address: { id, userId: req.user.id, label: label || 'Casa', addressText, reference, lat, lng, isDefault: !!isDefault } });
      }
    );
  };

  if (isDefault) {
    db.run('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.id], insertFn);
  } else {
    insertFn();
  }
});

app.put('/api/addresses/:id', authenticateToken, requireRole('user'), (req, res) => {
  const { label, addressText, reference, lat, lng } = req.body;
  db.run(
    `UPDATE addresses SET label = COALESCE(?, label), address_text = COALESCE(?, address_text), reference = COALESCE(?, reference), lat = COALESCE(?, lat), lng = COALESCE(?, lng) WHERE id = ? AND user_id = ?`,
    [label || null, addressText || null, reference || null, lat || null, lng || null, req.params.id, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ success: false, message: 'Error actualizando la dirección' });
      if (this.changes === 0) return res.status(404).json({ success: false, message: 'Dirección no encontrada' });
      res.json({ success: true });
    }
  );
});

app.delete('/api/addresses/:id', authenticateToken, requireRole('user'), (req, res) => {
  db.run('DELETE FROM addresses WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], function(err) {
    if (err) return res.status(500).json({ success: false, message: 'Error eliminando la dirección' });
    if (this.changes === 0) return res.status(404).json({ success: false, message: 'Dirección no encontrada' });
    res.json({ success: true });
  });
});

app.put('/api/addresses/:id/default', authenticateToken, requireRole('user'), (req, res) => {
  db.serialize(() => {
    db.run('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [req.user.id]);
    db.run('UPDATE addresses SET is_default = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], function(err) {
      if (err) return res.status(500).json({ success: false, message: 'Error actualizando la dirección' });
      res.json({ success: true });
    });
  });
});

// --- Métodos de pago (Stripe) ---
function requireStripe(req, res, next) {
  if (!stripe) return res.status(503).json({ success: false, message: 'Los pagos con tarjeta no están configurados todavía.' });
  next();
}

async function getOrCreateStripeCustomer(user) {
  if (user.stripe_customer_id) return user.stripe_customer_id;
  const customer = await stripe.customers.create({ email: user.email, name: user.name, metadata: { rapidinUserId: user.id } });
  await new Promise((resolve, reject) => {
    db.run('UPDATE users SET stripe_customer_id = ? WHERE id = ?', [customer.id, user.id], (err) => err ? reject(err) : resolve());
  });
  return customer.id;
}

app.post('/api/payment-methods/setup-intent', authenticateToken, requireRole('user'), requireStripe, (req, res) => {
  db.get('SELECT * FROM users WHERE id = ?', [req.user.id], async (err, user) => {
    if (err || !user) return res.status(500).json({ success: false, message: 'Error obteniendo el usuario' });
    try {
      const customerId = await getOrCreateStripeCustomer(user);
      const setupIntent = await stripe.setupIntents.create({ customer: customerId, usage: 'off_session' });
      res.json({ success: true, clientSecret: setupIntent.client_secret, customerId });
    } catch (e) {
      console.error('Error creando SetupIntent:', e.message);
      res.status(500).json({ success: false, message: 'Error preparando el formulario de pago' });
    }
  });
});

app.get('/api/payment-methods', authenticateToken, requireRole('user'), (req, res) => {
  db.all('SELECT * FROM payment_methods WHERE user_id = ? ORDER BY is_default DESC, created_at DESC', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Error obteniendo métodos de pago' });
    res.json({ success: true, paymentMethods: rows });
  });
});

app.post('/api/payment-methods', authenticateToken, requireRole('user'), requireStripe, async (req, res) => {
  const { stripePaymentMethodId, isDefault } = req.body;
  if (!stripePaymentMethodId) return res.status(400).json({ success: false, message: 'Falta el método de pago' });

  try {
    const pm = await stripe.paymentMethods.retrieve(stripePaymentMethodId);
    const id = 'pm-' + Date.now();
    const insertRow = () => {
      db.run(
        `INSERT INTO payment_methods (id, user_id, stripe_payment_method_id, brand, last4, exp_month, exp_year, cardholder_name, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, req.user.id, stripePaymentMethodId, pm.card?.brand || '', pm.card?.last4 || '', pm.card?.exp_month || null, pm.card?.exp_year || null, pm.billing_details?.name || '', isDefault ? 1 : 0],
        (err) => {
          if (err) return res.status(500).json({ success: false, message: 'Error guardando el método de pago' });
          res.json({ success: true, paymentMethod: { id, brand: pm.card?.brand, last4: pm.card?.last4, expMonth: pm.card?.exp_month, expYear: pm.card?.exp_year } });
        }
      );
    };
    if (isDefault) {
      db.run('UPDATE payment_methods SET is_default = 0 WHERE user_id = ?', [req.user.id], insertRow);
    } else {
      insertRow();
    }
  } catch (e) {
    console.error('Error guardando método de pago:', e.message);
    res.status(500).json({ success: false, message: 'No se pudo verificar la tarjeta con Stripe' });
  }
});

app.delete('/api/payment-methods/:id', authenticateToken, requireRole('user'), requireStripe, (req, res) => {
  db.get('SELECT * FROM payment_methods WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], async (err, row) => {
    if (err || !row) return res.status(404).json({ success: false, message: 'Método de pago no encontrado' });
    try {
      await stripe.paymentMethods.detach(row.stripe_payment_method_id);
    } catch (e) {
      console.warn('No se pudo desvincular en Stripe (puede que ya no exista):', e.message);
    }
    db.run('DELETE FROM payment_methods WHERE id = ?', [req.params.id], (delErr) => {
      if (delErr) return res.status(500).json({ success: false, message: 'Error eliminando el método de pago' });
      res.json({ success: true });
    });
  });
});

app.put('/api/payment-methods/:id/default', authenticateToken, requireRole('user'), (req, res) => {
  db.serialize(() => {
    db.run('UPDATE payment_methods SET is_default = 0 WHERE user_id = ?', [req.user.id]);
    db.run('UPDATE payment_methods SET is_default = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], function(err) {
      if (err) return res.status(500).json({ success: false, message: 'Error actualizando el método de pago' });
      res.json({ success: true });
    });
  });
});

// --- Cupones y promociones ---
app.get('/api/coupons', authenticateToken, requireRole('user'), (req, res) => {
  db.all('SELECT id, coupon_id, used_at, order_id FROM user_coupons WHERE user_id = ?', [req.user.id], (err, redeemed) => {
    if (err) return res.status(500).json({ success: false, message: 'Error obteniendo cupones' });
    const redeemedIds = redeemed.map(r => r.coupon_id);

    db.all(`SELECT * FROM coupons WHERE is_active = 1 AND (expires_at IS NULL OR expires_at > datetime('now'))`, [], (err2, allCoupons) => {
      if (err2) return res.status(500).json({ success: false, message: 'Error obteniendo cupones' });

      // "Disponibles" = cupones ya canjeados por el usuario y listos para usar.
      // "Usados" = cupones canjeados que ya se aplicaron a un pedido.
      const usedCouponIds = redeemed.filter(r => r.used_at).map(r => r.coupon_id);
      const unusedRedeemedIds = redeemedIds.filter(id => !usedCouponIds.includes(id));
      const available = allCoupons.filter(c => unusedRedeemedIds.includes(c.id));
      const used = allCoupons.filter(c => usedCouponIds.includes(c.id));

      res.json({ success: true, available, used });
    });
  });
});

app.post('/api/coupons/redeem', authenticateToken, requireRole('user'), (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ success: false, message: 'Ingresa un código' });

  db.get('SELECT * FROM coupons WHERE code = ? AND is_active = 1', [code.toUpperCase()], (err, coupon) => {
    if (err) return res.status(500).json({ success: false, message: 'Error verificando el cupón' });
    if (!coupon) return res.status(404).json({ success: false, message: 'Cupón no válido o expirado' });

    db.get('SELECT * FROM user_coupons WHERE user_id = ? AND coupon_id = ?', [req.user.id, coupon.id], (err2, existing) => {
      if (err2) return res.status(500).json({ success: false, message: 'Error verificando el cupón' });
      if (existing) return res.status(400).json({ success: false, message: 'Ya tienes este cupón' });

      const id = 'ucoupon-' + Date.now();
      db.run('INSERT INTO user_coupons (id, user_id, coupon_id) VALUES (?, ?, ?)', [id, req.user.id, coupon.id], (err3) => {
        if (err3) return res.status(500).json({ success: false, message: 'Error guardando el cupón' });
        res.json({ success: true, coupon });
      });
    });
  });
});

// --- Notificaciones ---
app.get('/api/notifications/preferences', authenticateToken, requireRole('user'), (req, res) => {
  db.get('SELECT * FROM notification_preferences WHERE user_id = ?', [req.user.id], (err, row) => {
    if (err) return res.status(500).json({ success: false, message: 'Error obteniendo preferencias' });
    if (!row) {
      return res.json({ success: true, preferences: { orders_enabled: true, promotions_enabled: true, offers_enabled: true, news_enabled: false } });
    }
    res.json({ success: true, preferences: row });
  });
});

app.put('/api/notifications/preferences', authenticateToken, requireRole('user'), (req, res) => {
  const { orders, promotions, offers, news } = req.body;
  db.run(
    `INSERT INTO notification_preferences (user_id, orders_enabled, promotions_enabled, offers_enabled, news_enabled)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET orders_enabled = ?, promotions_enabled = ?, offers_enabled = ?, news_enabled = ?`,
    [req.user.id, !!orders, !!promotions, !!offers, !!news, !!orders, !!promotions, !!offers, !!news],
    (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Error guardando preferencias' });
      res.json({ success: true });
    }
  );
});

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
    stripePublishableKey: STRIPE_PUBLISHABLE_KEY,
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
