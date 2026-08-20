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

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || null;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || null;
const TWILIO_VERIFY_SERVICE_SID = process.env.TWILIO_VERIFY_SERVICE_SID || null;
const twilioClient = (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) ? require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) : null;
if (!twilioClient || !TWILIO_VERIFY_SERVICE_SID) {
  if (NODE_ENV === 'production') {
    console.error('❌ TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_VERIFY_SERVICE_SID no están definidos. En producción es obligatorio configurarlos.');
    process.exit(1);
  }
  console.warn('⚠️  Twilio no configurado: la verificación por SMS usará el código de prueba 123456 (solo desarrollo).');
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
    db.run("ALTER TABLE orders ADD COLUMN is_delayed BOOLEAN DEFAULT 0", (err) => {});
    db.run("ALTER TABLE orders ADD COLUMN is_cancelled BOOLEAN DEFAULT 0", (err) => {});
    db.run("ALTER TABLE orders ADD COLUMN cancel_reason TEXT", (err) => {});
    db.run("ALTER TABLE orders ADD COLUMN delivery_instructions TEXT", (err) => {});
    db.run("ALTER TABLE orders ADD COLUMN customer_lat DECIMAL(10,6)", (err) => {});
    db.run("ALTER TABLE orders ADD COLUMN customer_lng DECIMAL(10,6)", (err) => {});
    db.run("ALTER TABLE stores ADD COLUMN description TEXT", (err) => {});
    db.run("ALTER TABLE stores ADD COLUMN hours TEXT", (err) => {});
    db.run("ALTER TABLE stores ADD COLUMN paused_until TIMESTAMP", (err) => {});
    db.run("ALTER TABLE stores ADD COLUMN owner_user_id VARCHAR(50)", (err) => {});
    db.run("ALTER TABLE orders ADD COLUMN store_reply_text TEXT", (err) => {});
    db.run("ALTER TABLE orders ADD COLUMN store_reply_at TIMESTAMP", (err) => {});
    db.run("ALTER TABLE coupons ADD COLUMN store_id VARCHAR(50)", (err) => {});
    db.run("ALTER TABLE stores ADD COLUMN special_days TEXT", (err) => {});
    db.run("ALTER TABLE stores ADD COLUMN prep_time_minutes INT DEFAULT 20", (err) => {});
    db.run("ALTER TABLE products ADD COLUMN category_id VARCHAR(50)", (err) => {});
    db.run("ALTER TABLE products ADD COLUMN availability_status VARCHAR(20) DEFAULT 'available'", (err) => {});
    db.run(`CREATE TABLE IF NOT EXISTS product_categories (
      id VARCHAR(50) PRIMARY KEY, store_id VARCHAR(50) NOT NULL, name VARCHAR(100) NOT NULL,
      sort_order INT DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run("ALTER TABLE coupons ADD COLUMN promo_type VARCHAR(20) DEFAULT 'general'", (err) => {});
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
      sender_id VARCHAR(50) NOT NULL, text TEXT, image_url TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run("ALTER TABLE order_messages ADD COLUMN image_url TEXT", (err) => {});
    db.run(`CREATE TABLE IF NOT EXISTS support_tickets (
      id VARCHAR(50) PRIMARY KEY, user_id VARCHAR(50) NOT NULL, order_id VARCHAR(50),
      category VARCHAR(50) NOT NULL, subject VARCHAR(255) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'open',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS support_messages (
      id VARCHAR(50) PRIMARY KEY, ticket_id VARCHAR(50) NOT NULL, sender_role VARCHAR(20) NOT NULL,
      text TEXT, image_url TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run("ALTER TABLE support_messages ADD COLUMN image_url TEXT", (err) => {});
    db.run("ALTER TABLE users ADD COLUMN loyalty_points INT DEFAULT 0", (err) => {});
    db.run("ALTER TABLE users ADD COLUMN referral_code VARCHAR(20)", (err) => {});
    db.run("ALTER TABLE users ADD COLUMN referred_by VARCHAR(20)", (err) => {});
    db.run("ALTER TABLE users ADD COLUMN referral_rewarded BOOLEAN DEFAULT 0", (err) => {});
    db.run(`CREATE TABLE IF NOT EXISTS points_history (
      id VARCHAR(50) PRIMARY KEY, user_id VARCHAR(50) NOT NULL, type VARCHAR(20) NOT NULL,
      amount INT NOT NULL, description TEXT, order_id VARCHAR(50), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS shipments (
      id VARCHAR(50) PRIMARY KEY, customer_id VARCHAR(50) NOT NULL, driver_id VARCHAR(50),
      origin_address TEXT NOT NULL, origin_lat DECIMAL(10,6), origin_lng DECIMAL(10,6),
      destination_address TEXT NOT NULL, destination_lat DECIMAL(10,6), destination_lng DECIMAL(10,6),
      package_size VARCHAR(20) NOT NULL DEFAULT 'small', package_description TEXT,
      recipient_name VARCHAR(255), recipient_phone VARCHAR(20),
      distance_km DECIMAL(10,2), price_usd DECIMAL(10,2) NOT NULL,
      status_step INT DEFAULT 0, status_text VARCHAR(255), is_cancelled BOOLEAN DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        
        db.run(`INSERT INTO stores (id, owner_user_id, name, category, address) VALUES (?, ?, ?, ?, ?)`,
          [storeId, userId, name, category || 'General', address || ''], function(err2) {
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
function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// Envía un código de verificación por SMS al número indicado (Twilio Verify)
app.post('/api/auth/send-otp', async (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ success: false, message: 'Falta el número de teléfono' });
  }

  if (!twilioClient || !TWILIO_VERIFY_SERVICE_SID) {
    console.warn(`⚠️  Twilio no configurado: código de prueba 123456 para ${phone}`);
    return res.json({ success: true, devMode: true });
  }

  try {
    await twilioClient.verify.v2.services(TWILIO_VERIFY_SERVICE_SID).verifications.create({ to: phone, channel: 'sms' });
    res.json({ success: true });
  } catch (twilioErr) {
    console.error('Error enviando SMS de verificación:', twilioErr.message);
    res.status(500).json({ success: false, message: 'No se pudo enviar el código de verificación. Revisa el número e intenta de nuevo.' });
  }
});

async function verifyOtpCode(phone, code) {
  if (!twilioClient || !TWILIO_VERIFY_SERVICE_SID) {
    return code === '123456';
  }
  try {
    const check = await twilioClient.verify.v2.services(TWILIO_VERIFY_SERVICE_SID).verificationChecks.create({ to: phone, code });
    return check.status === 'approved';
  } catch (twilioErr) {
    console.error('Error verificando código SMS:', twilioErr.message);
    return false;
  }
}

// Verifica el código SMS y emite un ticket de corta duración que prueba la propiedad del número
// (el código de Twilio Verify es de un solo uso, así que no puede volver a chequearse en /phone-login)
app.post('/api/auth/verify-otp', async (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) {
    return res.status(400).json({ success: false, message: 'Falta el número o el código de verificación' });
  }
  const otpValid = await verifyOtpCode(phone, code);
  if (!otpValid) {
    return res.status(401).json({ success: false, message: 'El código de verificación no es correcto o expiró.' });
  }
  const verificationTicket = jwt.sign({ phone, purpose: 'phone_verified' }, JWT_SECRET, { expiresIn: '10m' });
  res.json({ success: true, verificationTicket });
});

function checkVerificationTicket(phone, ticket) {
  if (!ticket) return false;
  try {
    const payload = jwt.verify(ticket, JWT_SECRET);
    return payload.purpose === 'phone_verified' && payload.phone === phone;
  } catch (e) {
    return false;
  }
}

app.post('/api/auth/phone-login', async (req, res) => {
  const { phone, name, email, referralCode, verificationTicket } = req.body;
  if (!phone) {
    return res.status(400).json({ success: false, message: 'Falta el número de teléfono' });
  }
  if (!checkVerificationTicket(phone, verificationTicket)) {
    return res.status(401).json({ success: false, message: 'Verificación de teléfono inválida o expirada. Verifica tu número de nuevo.' });
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
    const myReferralCode = generateReferralCode();

    const finishRegistration = (referredBy) => {
      const sql = `INSERT INTO users (id, role, email, password_hash, name, phone, referral_code, referred_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
      db.run(sql, [userId, 'user', email, passwordHash, name, phone, myReferralCode, referredBy], function(insertErr) {
        if (insertErr) {
          if (insertErr.message.includes('UNIQUE')) {
            return res.status(400).json({ success: false, message: 'El correo ya está registrado' });
          }
          return res.status(500).json({ success: false, message: 'Error interno de BD' });
        }
        const token = jwt.sign({ id: userId, email, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ success: true, token, user: { id: userId, email, name, role: 'user', phone } });
      });
    };

    if (referralCode) {
      db.get(`SELECT id FROM users WHERE referral_code = ?`, [referralCode.toUpperCase()], (refErr, refUser) => {
        finishRegistration(refUser ? referralCode.toUpperCase() : null);
      });
    } else {
      finishRegistration(null);
    }
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

    // El token debe llevar storeId/driverId también al iniciar sesión (no solo al registrarse),
    // o los endpoints que dependen de esos campos fallan para cuentas que vuelven a loguearse.
    const finish = (extra) => {
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role, ...extra }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ success: true, token, user: { id: user.id, email: user.email, name: user.name, role: user.role, ...extra } });
    };

    if (user.role === 'store') {
      db.get('SELECT id FROM stores WHERE owner_user_id = ?', [user.id], (storeErr, row) => {
        finish(row ? { storeId: row.id } : {});
      });
    } else if (user.role === 'driver') {
      db.get('SELECT id FROM drivers WHERE user_id = ?', [user.id], (drvErr, row) => {
        finish(row ? { driverId: row.id } : {});
      });
    } else {
      finish({});
    }
  });
});

// 3. Crear Pedido (Orders)
app.post('/api/orders', authenticateToken, requireRole('user'), (req, res) => {
  const newOrder = req.body;
  const orderId = newOrder.id; // 'RPD-12345'
  const items = newOrder.items || [];

  db.get('SELECT id, name, is_open, paused_until FROM stores WHERE id = ?', [newOrder.storeId], (storeErr, store) => {
    if (storeErr) return res.status(500).json({ success: false, message: 'Error de servidor' });
    if (!store) return res.status(404).json({ success: false, code: 'STORE_NOT_FOUND', message: 'El negocio no existe.' });
    if (!store.is_open) {
      return res.status(409).json({ success: false, code: 'STORE_CLOSED', message: `${store.name} está cerrado en este momento.` });
    }
    if (store.paused_until && new Date(store.paused_until + 'Z') > new Date()) {
      return res.status(409).json({ success: false, code: 'STORE_CLOSED', message: `${store.name} pausó temporalmente la recepción de pedidos.` });
    }

    const productIds = items.map(i => i.productId).filter(Boolean);
    const checkAvailability = productIds.length
      ? new Promise((resolve) => {
          db.all(`SELECT id, name, is_available FROM products WHERE id IN (${productIds.map(() => '?').join(',')})`, productIds, (prodErr, rows) => {
            resolve(prodErr ? [] : rows);
          });
        })
      : Promise.resolve([]);

    checkAvailability.then(async (productRows) => {
      const unavailable = productRows.filter(p => !p.is_available).map(p => p.name);
      if (unavailable.length) {
        return res.status(409).json({ success: false, code: 'PRODUCT_UNAVAILABLE', message: 'Algunos productos ya no están disponibles.', unavailableItems: unavailable });
      }

      // Si el pedido lleva un cupón, verificamos que siga activo y que, si es un
      // cupón propio de un comercio, se esté usando en ese mismo comercio.
      if (newOrder.couponCode) {
        const coupon = await new Promise((resolve) => {
          db.get(`SELECT * FROM coupons WHERE code = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > datetime('now'))`, [newOrder.couponCode], (e, r) => resolve(e ? null : r));
        });
        if (!coupon || (coupon.store_id && coupon.store_id !== newOrder.storeId)) {
          return res.status(400).json({ success: false, code: 'COUPON_INVALID', message: 'El cupón ya no es válido para este pedido.' });
        }
      }

      const itemsJson = JSON.stringify(items);
      const subtotal = newOrder.subtotal || 0;
      const shipping = newOrder.shippingFee || 1.99;
      const tip = newOrder.driverTip || 0;
      const discount = newOrder.discount || 0;
      const total = newOrder.total || (subtotal + shipping + tip - discount);
      const commission = total * 0.15; // 15% platform commission

      // Cobro real con Stripe si el cliente eligió una tarjeta guardada
      if (newOrder.paymentMethodId && newOrder.paymentMethodId !== 'cash' && stripe) {
        try {
          const [user, pm] = await Promise.all([
            new Promise((resolve, reject) => db.get('SELECT * FROM users WHERE id = ?', [req.user.id], (e, r) => e ? reject(e) : resolve(r))),
            new Promise((resolve, reject) => db.get('SELECT * FROM payment_methods WHERE id = ? AND user_id = ?', [newOrder.paymentMethodId, req.user.id], (e, r) => e ? reject(e) : resolve(r)))
          ]);
          if (!pm) {
            return res.status(400).json({ success: false, code: 'PAYMENT_METHOD_NOT_FOUND', message: 'El método de pago seleccionado ya no existe.' });
          }
          const customerId = await getOrCreateStripeCustomer(user);
          await stripe.paymentIntents.create({
            amount: Math.round(total * 100),
            currency: 'usd',
            customer: customerId,
            payment_method: pm.stripe_payment_method_id,
            off_session: true,
            confirm: true
          });
        } catch (chargeErr) {
          return res.status(402).json({ success: false, code: 'PAYMENT_DECLINED', message: chargeErr.message || 'El pago fue rechazado por el banco.' });
        }
      }

      const sql = `
        INSERT INTO orders (
          id, customer_id, store_id, customer_address, items_json,
          subtotal_usd, shipping_fee_usd, driver_tip_usd, total_amount_usd, platform_commission_usd,
          status_step, status_text, coupon_code, discount_usd
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

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
      ], async (err) => {
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

        try { await awardOrderPoints(req.user.id, orderId, total); } catch (e) { console.error('Error otorgando puntos:', e); }

// Emitir por Sockets a todos los comercios conectados
        io.emit('ORDER_CREATED', newOrder);
        res.json({ success: true, order: newOrder });
      });
    });
  });
});

// 3.1 Obtener pedidos de una tienda
app.get('/api/orders/store/:storeId', authenticateToken, requireRole('store', 'admin'), (req, res) => {
  const { storeId } = req.params;
  if (req.user.role === 'store' && req.user.storeId !== storeId) {
    return res.status(403).json({ success: false, message: 'No puedes ver pedidos de otro comercio' });
  }
  const sql = `
    SELECT orders.*, stores.name as storeName, users.name as customerName, users.phone as customerPhone
    FROM orders
    LEFT JOIN stores ON orders.store_id = stores.id
    LEFT JOIN users ON orders.customer_id = users.id
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

// 3.2.1 Entrega activa del repartidor autenticado (en camino, todavía no entregada)
app.get('/api/orders/driver/active', authenticateToken, requireRole('driver'), (req, res) => {
  db.get('SELECT id FROM drivers WHERE user_id = ?', [req.user.id], (err, driverRow) => {
    if (err || !driverRow) return res.status(403).json({ success: false, message: 'No tienes un perfil de repartidor activo' });
    const sql = `
      SELECT orders.*, stores.name as storeName, users.name as customerName, users.phone as customerPhone
      FROM orders
      LEFT JOIN stores ON orders.store_id = stores.id
      LEFT JOIN users ON orders.customer_id = users.id
      WHERE orders.driver_id = ? AND orders.status_step = 3 AND orders.is_cancelled = 0
      ORDER BY orders.created_at DESC LIMIT 1
    `;
    db.get(sql, [driverRow.id], (orderErr, row) => {
      if (orderErr) return res.status(500).json({ success: false, message: 'Error obteniendo tu entrega activa' });
      if (!row) return res.json({ success: true, order: null });
      res.json({ success: true, order: { ...row, items: row.items_json ? JSON.parse(row.items_json) : [] } });
    });
  });
});

// 3.4 Obtener un pedido por ID
app.get('/api/orders/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const sql = `
    SELECT orders.*, stores.name as storeName,
      drivers.name as driverName, drivers.vehicle_info as driverVehicle, drivers.rating as driverRating,
      driverUser.id as driverUserId, driverUser.phone as driverPhone
    FROM orders
    LEFT JOIN stores ON orders.store_id = stores.id
    LEFT JOIN drivers ON orders.driver_id = drivers.id
    LEFT JOIN users driverUser ON drivers.user_id = driverUser.id
    WHERE orders.id = ?
  `;
  db.get(sql, [id], (err, row) => {
    if (err) return res.status(500).json({ success: false, message: 'Error fetching order' });
    if (!row) return res.status(404).json({ success: false, message: 'Order not found' });

    const isOwner = req.user.role === 'admin'
      || req.user.id === row.customer_id
      || (req.user.role === 'store' && req.user.storeId === row.store_id)
      // Un repartidor solo puede ver pedidos ya asignados a él, o pedidos listos/en preparación
      // todavía sin asignar (para poder decidir si los acepta).
      || (req.user.role === 'driver' && (row.driverUserId === req.user.id || (!row.driver_id && row.status_step >= 1 && row.status_step < 3)));
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

  const applyUpdate = (driverId) => {
    const sql = driverId
      ? `UPDATE orders SET status_step = ?, status_text = ?, driver_id = COALESCE(driver_id, ?) WHERE id = ?`
      : `UPDATE orders SET status_step = ?, status_text = ? WHERE id = ?`;
    const params = driverId ? [statusStep, statusText, driverId, id] : [statusStep, statusText, id];

    db.run(sql, params, function(err) {
      if (err) return res.status(500).json({ success: false, message: 'Error updating order' });

      const payload = { orderId: id, statusStep, statusText, ...extraData };
      io.emit('ORDER_STATUS_CHANGED', payload);

      // Cuando el repartidor marca la entrega como completada, se le acredita
      // el pago (tarifa de envío + propina) a sus ganancias totales.
      if (driverId && statusStep === 4) {
        db.get('SELECT shipping_fee_usd, driver_tip_usd FROM orders WHERE id = ?', [id], (payErr, order) => {
          if (!payErr && order) {
            const driverPay = (order.shipping_fee_usd || 0) + (order.driver_tip_usd || 0);
            db.run('UPDATE drivers SET earnings_total = earnings_total + ? WHERE id = ?', [driverPay, driverId]);
          }
        });
      }

      res.json({ success: true, payload });
    });
  };

  // Cuando un repartidor acepta/actualiza un pedido, lo asignamos como su repartidor
  // (si todavía no tenía uno asignado), y validamos que la transición de estado tenga sentido.
  if (req.user.role === 'driver') {
    db.get('SELECT id FROM drivers WHERE user_id = ?', [req.user.id], (err, driverRow) => {
      if (err || !driverRow) return res.status(403).json({ success: false, message: 'No tienes un perfil de repartidor activo' });

      db.get('SELECT status_step, driver_id FROM orders WHERE id = ?', [id], (orderErr, order) => {
        if (orderErr || !order) return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
        if (order.driver_id && order.driver_id !== driverRow.id) {
          return res.status(403).json({ success: false, message: 'Este pedido ya fue tomado por otro repartidor' });
        }
        const validTransition = (order.status_step === 2 && statusStep === 3) || (order.status_step === 3 && statusStep === 4);
        if (!validTransition) {
          return res.status(400).json({ success: false, message: 'Ese cambio de estado no es válido para este pedido' });
        }
        applyUpdate(driverRow.id);
      });
    });
  } else {
    applyUpdate(null);
  }
});

// 3.3.1 El comercio rechaza un pedido nuevo (solo mientras está pendiente de aceptación)
app.put('/api/orders/:id/reject', authenticateToken, requireRole('store', 'admin'), (req, res) => {
  const { reason } = req.body;
  db.get('SELECT * FROM orders WHERE id = ?', [req.params.id], (err, order) => {
    if (err || !order) return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    if (req.user.role === 'store' && req.user.storeId !== order.store_id) {
      return res.status(403).json({ success: false, message: 'No puedes rechazar pedidos de otro comercio' });
    }
    if (order.status_step !== 0 || order.is_cancelled) {
      return res.status(400).json({ success: false, message: 'Este pedido ya no se puede rechazar' });
    }
    db.run(
      `UPDATE orders SET is_cancelled = 1, cancel_reason = ?, status_text = 'El comercio rechazó tu pedido' WHERE id = ?`,
      [reason || 'Rechazado por el comercio', req.params.id],
      (updErr) => {
        if (updErr) return res.status(500).json({ success: false, message: 'Error rechazando el pedido' });
        io.emit('ORDER_STATUS_CHANGED', { orderId: req.params.id, statusStep: order.status_step, statusText: 'El comercio rechazó tu pedido', isCancelled: true });
        res.json({ success: true });
      }
    );
  });
});

// 3.3.2 Resumen del panel del comercio: pedidos por estado, ventas y pedidos de hoy
app.get('/api/stores/me/dashboard', authenticateToken, requireRole('store'), (req, res) => {
  const storeId = req.user.storeId;
  const sql = `
    SELECT status_step, is_cancelled, total_amount_usd, created_at
    FROM orders WHERE store_id = ?
  `;
  db.all(sql, [storeId], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Error obteniendo el resumen del negocio' });

    const todayStr = new Date().toISOString().slice(0, 10);
    let newCount = 0, preparingCount = 0, readyCount = 0;
    let todaySales = 0, todayOrders = 0, completedTotal = 0;

    rows.forEach(o => {
      if (!o.is_cancelled) {
        if (o.status_step === 0) newCount++;
        else if (o.status_step === 1) preparingCount++;
        else if (o.status_step === 2) readyCount++;
        if (o.status_step >= 4) completedTotal++;
      }
      const isToday = (o.created_at || '').slice(0, 10) === todayStr;
      if (isToday && !o.is_cancelled) {
        todaySales += o.total_amount_usd || 0;
        todayOrders++;
      }
    });

    db.get('SELECT is_open, paused_until, rating FROM stores WHERE id = ?', [storeId], (storeErr, store) => {
      res.json({
        success: true,
        newCount, preparingCount, readyCount,
        todaySales: Math.round(todaySales * 100) / 100,
        todayOrders, completedTotal,
        isOpen: store ? !!store.is_open : false,
        pausedUntil: store ? store.paused_until : null,
        rating: store ? store.rating : null
      });
    });
  });
});

// 3.3.3 Abrir/cerrar el negocio, o pausar la recepción de pedidos por un rato
app.put('/api/stores/me/status', authenticateToken, requireRole('store'), (req, res) => {
  const { isOpen, pauseMinutes, resume } = req.body;
  const storeId = req.user.storeId;

  const updates = [];
  const params = [];
  if (typeof isOpen === 'boolean') { updates.push('is_open = ?'); params.push(isOpen ? 1 : 0); }
  if (resume) { updates.push('paused_until = NULL'); }
  else if (typeof pauseMinutes === 'number' && pauseMinutes > 0) {
    updates.push(`paused_until = datetime('now', '+${Math.floor(pauseMinutes)} minutes')`);
  }
  if (!updates.length) return res.status(400).json({ success: false, message: 'Nada que actualizar' });

  params.push(storeId);
  db.run(`UPDATE stores SET ${updates.join(', ')} WHERE id = ?`, params, (err) => {
    if (err) return res.status(500).json({ success: false, message: 'Error actualizando el estado del negocio' });
    db.get('SELECT is_open, paused_until FROM stores WHERE id = ?', [storeId], (getErr, store) => {
      res.json({ success: true, isOpen: store ? !!store.is_open : false, pausedUntil: store ? store.paused_until : null });
    });
  });
});

// Verifica que el usuario autenticado sea el cliente, el repartidor asignado o un admin del pedido.
function checkOrderAccess(orderId, user, callback) {
  db.get('SELECT orders.*, drivers.user_id as driverUserId FROM orders LEFT JOIN drivers ON orders.driver_id = drivers.id WHERE orders.id = ?', [orderId], (err, order) => {
    if (err || !order) return callback(null, false);
    const allowed = user.role === 'admin' || user.id === order.customer_id || (user.role === 'driver' && user.id === order.driverUserId);
    callback(order, allowed);
  });
}

// 3.5 Chat del pedido (cliente <-> repartidor)
app.get('/api/orders/:id/messages', authenticateToken, (req, res) => {
  checkOrderAccess(req.params.id, req.user, (order, allowed) => {
    if (!order) return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    if (!allowed) return res.status(403).json({ success: false, message: 'No autorizado' });
    db.all('SELECT * FROM order_messages WHERE order_id = ? ORDER BY created_at ASC', [req.params.id], (err2, rows) => {
      if (err2) return res.status(500).json({ success: false, message: 'Error obteniendo mensajes' });
      res.json({ success: true, messages: rows });
    });
  });
});

app.post('/api/orders/:id/messages', authenticateToken, (req, res) => {
  const { text, imageUrl } = req.body;
  if (!text && !imageUrl) return res.status(400).json({ success: false, message: 'Escribe un mensaje o adjunta una imagen' });

  checkOrderAccess(req.params.id, req.user, (order, allowed) => {
    if (!order) return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    if (!allowed) return res.status(403).json({ success: false, message: 'No autorizado' });

    const msgId = 'omsg-' + Date.now();
    const senderRole = req.user.role === 'driver' ? 'driver' : 'user';
    db.run(
      `INSERT INTO order_messages (id, order_id, sender_role, sender_id, text, image_url) VALUES (?, ?, ?, ?, ?, ?)`,
      [msgId, req.params.id, senderRole, req.user.id, text || null, imageUrl || null],
      (err2) => {
        if (err2) return res.status(500).json({ success: false, message: 'Error enviando el mensaje' });
        const message = { id: msgId, order_id: req.params.id, sender_role: senderRole, sender_id: req.user.id, text: text || null, image_url: imageUrl || null };
        io.emit('CHAT_MESSAGE_SENT', { orderId: req.params.id, message });
        res.json({ success: true, message });
      }
    );
  });
});

// 3.6 Cancelar pedido (solo el cliente, mientras el comercio no lo haya marcado listo)
app.put('/api/orders/:id/cancel', authenticateToken, requireRole('user'), (req, res) => {
  const { reason } = req.body;
  db.get('SELECT * FROM orders WHERE id = ? AND customer_id = ?', [req.params.id, req.user.id], (err, order) => {
    if (err || !order) return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    if (order.status_step >= 2) {
      return res.status(400).json({ success: false, message: 'Tu pedido ya está listo o en camino y no se puede cancelar. Contacta a soporte.' });
    }
    db.run(
      `UPDATE orders SET is_cancelled = 1, cancel_reason = ?, status_text = 'Pedido cancelado' WHERE id = ?`,
      [reason || '', req.params.id],
      (err2) => {
        if (err2) return res.status(500).json({ success: false, message: 'Error cancelando el pedido' });
        io.emit('ORDER_STATUS_CHANGED', { orderId: req.params.id, cancelled: true });
        res.json({ success: true });
      }
    );
  });
});

// 3.7 Instrucciones de entrega y ubicación compartida
app.put('/api/orders/:id/instructions', authenticateToken, requireRole('user'), (req, res) => {
  const { instructions, lat, lng } = req.body;
  db.run(
    `UPDATE orders SET delivery_instructions = COALESCE(?, delivery_instructions), customer_lat = COALESCE(?, customer_lat), customer_lng = COALESCE(?, customer_lng) WHERE id = ? AND customer_id = ?`,
    [instructions ?? null, lat ?? null, lng ?? null, req.params.id, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ success: false, message: 'Error guardando las instrucciones' });
      if (this.changes === 0) return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
      res.json({ success: true });
    }
  );
});

// 3.8 Calificar pedido / repartidor / negocio
app.put('/api/orders/:id/rate', authenticateToken, requireRole('user'), (req, res) => {
  const { ratingOrder, ratingDriver, ratingStore, reviewText } = req.body;
  db.run(
    `UPDATE orders SET rating_order = ?, rating_driver = ?, rating_store = ?, review_text = ? WHERE id = ? AND customer_id = ?`,
    [ratingOrder || null, ratingDriver || null, ratingStore || null, reviewText || '', req.params.id, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ success: false, message: 'Error guardando tu calificación' });
      if (this.changes === 0) return res.status(404).json({ success: false, message: 'Pedido no encontrado' });

      // Actualiza el promedio de calificación del repartidor con la nueva reseña
      if (ratingDriver) {
        db.get('SELECT driver_id FROM orders WHERE id = ?', [req.params.id], (e, row) => {
          if (row && row.driver_id) {
            db.all('SELECT rating_driver FROM orders WHERE driver_id = ? AND rating_driver IS NOT NULL', [row.driver_id], (e2, ratings) => {
              if (!e2 && ratings.length) {
                const avg = ratings.reduce((s, r) => s + r.rating_driver, 0) / ratings.length;
                db.run('UPDATE drivers SET rating = ? WHERE id = ?', [avg, row.driver_id]);
              }
            });
          }
        });
      }

      res.json({ success: true });
    }
  );
});

// 3.9 Agregar/actualizar propina al repartidor (antes o después de la entrega)
app.put('/api/orders/:id/tip', authenticateToken, requireRole('user'), (req, res) => {
  const { tip } = req.body;
  if (tip === undefined || tip < 0) return res.status(400).json({ success: false, message: 'Monto de propina inválido' });

  db.get('SELECT total_amount_usd, driver_tip_usd FROM orders WHERE id = ? AND customer_id = ?', [req.params.id, req.user.id], (err, order) => {
    if (err || !order) return res.status(404).json({ success: false, message: 'Pedido no encontrado' });
    const newTotal = Number(order.total_amount_usd) - Number(order.driver_tip_usd) + Number(tip);
    db.run(
      'UPDATE orders SET driver_tip_usd = ?, total_amount_usd = ? WHERE id = ?',
      [tip, newTotal, req.params.id],
      (err2) => {
        if (err2) return res.status(500).json({ success: false, message: 'Error guardando la propina' });
        res.json({ success: true, tip, total: newTotal });
      }
    );
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

// --- Fidelización: Rapidín Club ---
const LOYALTY_TIERS = [
  { key: 'explorador', label: 'Explorador', min: 0, max: 499, benefits: ['1 punto por cada $1 gastado', 'Acceso a promociones exclusivas'] },
  { key: 'plata', label: 'Plata', min: 500, max: 1499, benefits: ['Todo lo del nivel Explorador', 'Soporte prioritario', '5% de puntos extra en cada pedido'] },
  { key: 'oro', label: 'Oro', min: 1500, max: Infinity, benefits: ['Todo lo del nivel Plata', 'Envío gratis en pedidos +$15', '10% de puntos extra en cada pedido'] }
];
function getLoyaltyTier(points) {
  return LOYALTY_TIERS.find(t => points >= t.min && points <= t.max) || LOYALTY_TIERS[0];
}
const REDEMPTION_OPTIONS = [
  { id: 'redeem-5', points: 100, discountType: 'fixed', discountValue: 5, minOrder: 0, label: '$5 de descuento' },
  { id: 'redeem-15', points: 250, discountType: 'fixed', discountValue: 15, minOrder: 20, label: '$15 de descuento' },
  { id: 'redeem-shipping', points: 60, discountType: 'shipping', discountValue: 0, minOrder: 0, label: 'Envío gratis' }
];
const REFERRAL_BONUS_REFERRER = 50;
const REFERRAL_BONUS_REFERRED = 20;

function addPoints(userId, amount, type, description, orderId) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE users SET loyalty_points = loyalty_points + ? WHERE id = ?', [amount, userId], (err) => {
      if (err) return reject(err);
      db.run(
        'INSERT INTO points_history (id, user_id, type, amount, description, order_id) VALUES (?, ?, ?, ?, ?, ?)',
        ['ph-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7), userId, type, amount, description, orderId || null],
        (err2) => err2 ? reject(err2) : resolve()
      );
    });
  });
}

async function awardOrderPoints(userId, orderId, total) {
  const points = Math.floor(total);
  if (points > 0) {
    await addPoints(userId, points, 'earned', `Pedido #${orderId}`, orderId);
  }

  const user = await new Promise((resolve, reject) => db.get('SELECT referred_by, referral_rewarded FROM users WHERE id = ?', [userId], (e, r) => e ? reject(e) : resolve(r)));
  if (!user || !user.referred_by || user.referral_rewarded) return;

  const orderCount = await new Promise((resolve, reject) => db.get('SELECT COUNT(*) as c FROM orders WHERE customer_id = ?', [userId], (e, r) => e ? reject(e) : resolve(r.c)));
  if (orderCount !== 1) return;

  const referrer = await new Promise((resolve, reject) => db.get('SELECT id FROM users WHERE referral_code = ?', [user.referred_by], (e, r) => e ? reject(e) : resolve(r)));
  if (!referrer) return;

  await addPoints(referrer.id, REFERRAL_BONUS_REFERRER, 'referral_bonus', 'Bonificación por referido', orderId);
  await addPoints(userId, REFERRAL_BONUS_REFERRED, 'referral_bonus', 'Bonificación por usar código de referido', orderId);
  await new Promise((resolve, reject) => db.run('UPDATE users SET referral_rewarded = 1 WHERE id = ?', [userId], (e) => e ? reject(e) : resolve()));
}

app.get('/api/loyalty/summary', authenticateToken, requireRole('user'), (req, res) => {
  db.get('SELECT loyalty_points, referral_code FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) return res.status(500).json({ success: false, message: 'Error obteniendo tu resumen de Rapidín Club' });
    const points = user.loyalty_points || 0;
    const tier = getLoyaltyTier(points);
    const nextTier = LOYALTY_TIERS[LOYALTY_TIERS.indexOf(tier) + 1] || null;
    db.get('SELECT COUNT(*) as c FROM users WHERE referred_by = ?', [user.referral_code], (refErr, refRow) => {
      res.json({
        success: true,
        points,
        tier: tier.key,
        tierLabel: tier.label,
        benefits: tier.benefits,
        nextTierLabel: nextTier ? nextTier.label : null,
        nextTierThreshold: nextTier ? nextTier.min : null,
        referralCode: user.referral_code,
        referralCount: refErr ? 0 : refRow.c
      });
    });
  });
});

app.get('/api/loyalty/history', authenticateToken, requireRole('user'), (req, res) => {
  db.all('SELECT * FROM points_history WHERE user_id = ? ORDER BY created_at DESC', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Error obteniendo tu historial de puntos' });
    res.json({ success: true, history: rows });
  });
});

app.get('/api/loyalty/redemption-options', authenticateToken, requireRole('user'), (req, res) => {
  res.json({ success: true, options: REDEMPTION_OPTIONS });
});

app.post('/api/loyalty/redeem', authenticateToken, requireRole('user'), (req, res) => {
  const option = REDEMPTION_OPTIONS.find(o => o.id === req.body.optionId);
  if (!option) return res.status(400).json({ success: false, message: 'Opción de canje inválida' });

  db.get('SELECT loyalty_points FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err || !user) return res.status(500).json({ success: false, message: 'Error de servidor' });
    if (user.loyalty_points < option.points) {
      return res.status(400).json({ success: false, message: 'No tienes suficientes puntos para este canje' });
    }

    const couponId = 'cpn-redeem-' + Date.now();
    const code = 'CLUB' + Math.random().toString(36).slice(2, 8).toUpperCase();
    db.run(
      `INSERT INTO coupons (id, code, title, description, discount_type, discount_value, min_order_usd, is_active, promo_type) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 'general')`,
      [couponId, code, option.label, 'Cupón canjeado con puntos de Rapidín Club', option.discountType, option.discountValue, option.minOrder],
      (couponErr) => {
        if (couponErr) return res.status(500).json({ success: false, message: 'Error creando tu cupón' });
        db.run(
          `INSERT INTO user_coupons (id, user_id, coupon_id) VALUES (?, ?, ?)`,
          ['uc-' + Date.now(), req.user.id, couponId],
          async (ucErr) => {
            if (ucErr) return res.status(500).json({ success: false, message: 'Error asignando tu cupón' });
            try {
              await addPoints(req.user.id, -option.points, 'redeemed', `Canje: ${option.label}`, null);
            } catch (e) {
              return res.status(500).json({ success: false, message: 'Error descontando tus puntos' });
            }
            res.json({ success: true, code, label: option.label });
          }
        );
      }
    );
  });
});

app.get('/api/loyalty/referrals', authenticateToken, requireRole('user'), (req, res) => {
  db.get('SELECT referral_code FROM users WHERE id = ?', [req.user.id], (err, me) => {
    if (err || !me) return res.status(500).json({ success: false, message: 'Error de servidor' });
    db.all('SELECT name, created_at, referral_rewarded FROM users WHERE referred_by = ? ORDER BY created_at DESC', [me.referral_code], (refErr, rows) => {
      if (refErr) return res.status(500).json({ success: false, message: 'Error obteniendo tus referidos' });
      res.json({ success: true, referralCode: me.referral_code, referrals: rows });
    });
  });
});

// --- Rapidín Envíos ---
const SHIPMENT_BASE_FEE = 2.50;
const SHIPMENT_PER_KM = 0.80;
const SHIPMENT_SIZE_MULTIPLIER = { small: 1, medium: 1.5, large: 2.2 };

function computeShipmentQuote(originLat, originLng, destLat, destLng, packageSize) {
  const distanceKm = getDistanceFromLatLonInKm(originLat, originLng, destLat, destLng);
  const multiplier = SHIPMENT_SIZE_MULTIPLIER[packageSize] || 1;
  const price = (SHIPMENT_BASE_FEE + distanceKm * SHIPMENT_PER_KM) * multiplier;
  return { distanceKm: Math.round(distanceKm * 100) / 100, price: Math.round(price * 100) / 100 };
}

app.post('/api/shipments/quote', authenticateToken, requireRole('user'), (req, res) => {
  const { originLat, originLng, destLat, destLng, packageSize } = req.body;
  if ([originLat, originLng, destLat, destLng].some(v => typeof v !== 'number' || isNaN(v))) {
    return res.status(400).json({ success: false, message: 'Faltan coordenadas de origen o destino' });
  }
  const quote = computeShipmentQuote(originLat, originLng, destLat, destLng, packageSize);
  res.json({ success: true, ...quote });
});

app.post('/api/shipments', authenticateToken, requireRole('user'), (req, res) => {
  const { originAddress, originLat, originLng, destinationAddress, destLat, destLng, packageSize, packageDescription, recipientName, recipientPhone } = req.body;
  if (!originAddress || !destinationAddress || [originLat, originLng, destLat, destLng].some(v => typeof v !== 'number' || isNaN(v))) {
    return res.status(400).json({ success: false, message: 'Faltan datos del envío' });
  }
  const quote = computeShipmentQuote(originLat, originLng, destLat, destLng, packageSize);
  const shipmentId = 'ENV-' + Math.floor(10000 + Math.random() * 90000);

  db.run(
    `INSERT INTO shipments (id, customer_id, origin_address, origin_lat, origin_lng, destination_address, destination_lat, destination_lng, package_size, package_description, recipient_name, recipient_phone, distance_km, price_usd, status_step, status_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [shipmentId, req.user.id, originAddress, originLat, originLng, destinationAddress, destLat, destLng, packageSize || 'small', packageDescription || '', recipientName || '', recipientPhone || '', quote.distanceKm, quote.price, 'Buscando repartidor 🔎'],
    (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Error creando el envío' });
      io.emit('SHIPMENT_CREATED', { id: shipmentId });
      res.json({ success: true, shipment: { id: shipmentId, distanceKm: quote.distanceKm, price: quote.price } });
    }
  );
});

app.get('/api/shipments/mine', authenticateToken, requireRole('user'), (req, res) => {
  db.all('SELECT * FROM shipments WHERE customer_id = ? ORDER BY created_at DESC', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Error obteniendo tus envíos' });
    res.json({ success: true, shipments: rows });
  });
});

app.get('/api/shipments/:id', authenticateToken, requireRole('user'), (req, res) => {
  db.get('SELECT * FROM shipments WHERE id = ? AND customer_id = ?', [req.params.id, req.user.id], (err, row) => {
    if (err) return res.status(500).json({ success: false, message: 'Error obteniendo el envío' });
    if (!row) return res.status(404).json({ success: false, message: 'Envío no encontrado' });
    res.json({ success: true, shipment: row });
  });
});

app.put('/api/shipments/:id/cancel', authenticateToken, requireRole('user'), (req, res) => {
  db.get('SELECT * FROM shipments WHERE id = ? AND customer_id = ?', [req.params.id, req.user.id], (err, row) => {
    if (err || !row) return res.status(404).json({ success: false, message: 'Envío no encontrado' });
    if (row.status_step >= 3) return res.status(400).json({ success: false, message: 'Este envío ya fue entregado' });
    db.run(`UPDATE shipments SET is_cancelled = 1, status_text = 'Envío cancelado' WHERE id = ?`, [req.params.id], (updErr) => {
      if (updErr) return res.status(500).json({ success: false, message: 'Error cancelando el envío' });
      res.json({ success: true });
    });
  });
});

// --- Cupones y promociones ---
app.get('/api/coupons/active', authenticateToken, (req, res) => {
  const { type, storeId } = req.query;
  let sql = `SELECT * FROM coupons WHERE is_active = 1 AND (expires_at IS NULL OR expires_at > datetime('now'))`;
  const params = [];
  if (type) {
    sql += ` AND promo_type = ?`;
    params.push(type);
  }
  if (storeId) {
    sql += ` AND (store_id IS NULL OR store_id = ?)`;
    params.push(storeId);
  }
  db.all(sql, params, (err, coupons) => {
    if (err) return res.status(500).json({ success: false, message: 'Error obteniendo promociones' });
    res.json({ success: true, coupons });
  });
});

// Negocios con promociones activas cerca de una ubicación
app.get('/api/stores/with-promos', authenticateToken, (req, res) => {
  const { lat, lng } = req.query;
  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);

  db.all(`SELECT stores.*, (SELECT COUNT(*) FROM orders WHERE orders.store_id = stores.id AND orders.rating_store IS NOT NULL) as reviewsCount
          FROM stores WHERE is_open = 1 AND (badge LIKE '%ferta%' OR is_turbo = 1)`, [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Error obteniendo promociones cercanas' });
    let stores = rows.map(store => ({
      ...store,
      image: store.image_url,
      logo: store.logo_url,
      isTurbo: store.is_turbo === 1,
      deliveryTime: store.delivery_time,
      deliveryFee: store.delivery_fee,
      minOrder: store.min_order,
      tags: store.tags ? JSON.parse(store.tags) : []
    }));
    if (!isNaN(userLat) && !isNaN(userLng)) {
      stores = stores.filter(store => {
        if (!store.lat || !store.lng) return true;
        const distanceKm = getDistanceFromLatLonInKm(userLat, userLng, store.lat, store.lng);
        return distanceKm <= (store.delivery_radius_km || 5.00);
      });
    }
    res.json({ success: true, stores });
  });
});

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

// ==========================================
// AYUDA Y SOPORTE
// ==========================================

const RAPIDIN_FAQS = [
  { id: 'faq-1', category: 'pedido', question: '¿Cómo sigo mi pedido en tiempo real?', answer: 'Ve a "Mis pedidos" y toca "Ver seguimiento" en tu pedido activo. Ahí verás el estado actualizado y el mapa con la ubicación del repartidor.' },
  { id: 'faq-2', category: 'pedido', question: '¿Puedo cancelar un pedido después de confirmarlo?', answer: 'Puedes cancelar mientras el comercio no haya empezado a prepararlo. Ve al detalle del pedido y busca la opción de cancelar; si ya está en preparación, contacta a soporte.' },
  { id: 'faq-3', category: 'pedido', question: '¿Qué hago si mi pedido llegó incompleto?', answer: 'Ve a "Mis pedidos", abre el pedido y selecciona "Necesito ayuda" → "Pedido incompleto". Un caso de soporte se creará automáticamente con los detalles del pedido.' },
  { id: 'faq-4', category: 'pago', question: '¿Qué métodos de pago aceptan?', answer: 'Aceptamos tarjetas de crédito/débito (procesadas de forma segura con Stripe) y pago en efectivo al repartidor.' },
  { id: 'faq-5', category: 'pago', question: '¿Es seguro guardar mi tarjeta en Rapidín?', answer: 'Sí. Nunca almacenamos tu número completo ni el CVV — esos datos van directo a Stripe, un procesador de pagos certificado. Nosotros solo guardamos una referencia (marca y últimos 4 dígitos).' },
  { id: 'faq-6', category: 'pago', question: '¿Cómo uso un cupón de descuento?', answer: 'Ve a Perfil → Promociones y cupones, canjea el código, y en el checkout de tu próximo pedido podrás aplicarlo desde la sección "Promoción".' },
  { id: 'faq-7', category: 'cuenta', question: '¿Cómo cambio mi número de teléfono?', answer: 'Ve a Perfil → Configuración → Privacidad y seguridad → Cambiar número.' },
  { id: 'faq-8', category: 'cuenta', question: '¿Puedo eliminar mi cuenta?', answer: 'Sí, desde Perfil → Configuración → Privacidad y seguridad → Eliminar mi cuenta. Esta acción no se puede deshacer.' },
  { id: 'faq-9', category: 'delivery', question: '¿Cómo contacto a mi repartidor?', answer: 'Durante el seguimiento de tu pedido en curso, verás un botón de chat para escribirle directamente a tu repartidor.' },
  { id: 'faq-10', category: 'delivery', question: '¿Puedo dejar propina al repartidor?', answer: 'Sí, puedes agregar propina durante el checkout, antes de confirmar tu pedido.' },
  { id: 'faq-11', category: 'promociones', question: '¿Dónde veo mis cupones disponibles?', answer: 'En Perfil → Promociones y cupones. Ahí verás los cupones que has canjeado y cuáles ya usaste.' },
  { id: 'faq-12', category: 'promociones', question: '¿Los cupones tienen fecha de vencimiento?', answer: 'Algunos sí. Si un cupón tiene fecha límite, la verás junto a su descripción antes de canjearlo.' }
];

const SUPPORT_CATEGORY_LABELS = { pedido: 'Pedido', pago: 'Pago', cuenta: 'Cuenta', delivery: 'Delivery', promociones: 'Promociones', otro: 'Otro' };

// 1. Centro de ayuda: preguntas frecuentes (contenido público, no requiere sesión)
app.get('/api/help/faqs', (req, res) => {
  res.json({ success: true, faqs: RAPIDIN_FAQS });
});

// 2. Crear un caso de soporte
app.post('/api/support/tickets', authenticateToken, requireRole('user'), (req, res) => {
  const { category, subject, orderId, message } = req.body;
  if (!category || !subject) {
    return res.status(400).json({ success: false, message: 'Falta la categoría o el asunto' });
  }
  const ticketId = 'tkt-' + Date.now();

  db.run(
    `INSERT INTO support_tickets (id, user_id, order_id, category, subject) VALUES (?, ?, ?, ?, ?)`,
    [ticketId, req.user.id, orderId || null, category, subject],
    (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Error creando el caso de soporte' });

      const firstMsgId = 'msg-' + Date.now();
      db.run(
        `INSERT INTO support_messages (id, ticket_id, sender_role, text) VALUES (?, ?, 'user', ?)`,
        [firstMsgId, ticketId, message || subject]
      );

      const welcomeMsgId = 'msg-' + (Date.now() + 1);
      const welcomeText = `¡Hola! Recibimos tu caso sobre "${SUPPORT_CATEGORY_LABELS[category] || category}". Nuestro equipo lo revisará y te responderá aquí mismo lo antes posible. 🙌`;
      db.run(
        `INSERT INTO support_messages (id, ticket_id, sender_role, text) VALUES (?, ?, 'support', ?)`,
        [welcomeMsgId, ticketId, welcomeText],
        (err2) => {
          if (err2) return res.status(500).json({ success: false, message: 'Error creando el caso de soporte' });
          res.json({ success: true, ticket: { id: ticketId, category, subject, orderId: orderId || null, status: 'open' } });
        }
      );
    }
  );
});

// 3. Mis casos de soporte
app.get('/api/support/tickets', authenticateToken, requireRole('user'), (req, res) => {
  db.all('SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Error obteniendo tus casos' });
    res.json({ success: true, tickets: rows });
  });
});

// 4. Mensajes de un caso (verifica que el caso sea del usuario autenticado)
app.get('/api/support/tickets/:id/messages', authenticateToken, requireRole('user'), (req, res) => {
  db.get('SELECT * FROM support_tickets WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], (err, ticket) => {
    if (err || !ticket) return res.status(404).json({ success: false, message: 'Caso no encontrado' });
    db.all('SELECT * FROM support_messages WHERE ticket_id = ? ORDER BY created_at ASC', [req.params.id], (err2, rows) => {
      if (err2) return res.status(500).json({ success: false, message: 'Error obteniendo mensajes' });
      res.json({ success: true, ticket, messages: rows });
    });
  });
});

// 5. Enviar un mensaje en un caso existente
app.post('/api/support/tickets/:id/messages', authenticateToken, requireRole('user'), (req, res) => {
  const { text, imageUrl } = req.body;
  if (!text && !imageUrl) return res.status(400).json({ success: false, message: 'Escribe un mensaje o adjunta una imagen' });

  db.get('SELECT * FROM support_tickets WHERE id = ? AND user_id = ?', [req.params.id, req.user.id], (err, ticket) => {
    if (err || !ticket) return res.status(404).json({ success: false, message: 'Caso no encontrado' });

    const msgId = 'msg-' + Date.now();
    db.run(
      `INSERT INTO support_messages (id, ticket_id, sender_role, text, image_url) VALUES (?, ?, 'user', ?, ?)`,
      [msgId, req.params.id, text || null, imageUrl || null],
      (err2) => {
        if (err2) return res.status(500).json({ success: false, message: 'Error enviando el mensaje' });
        res.json({ success: true });
      }
    );
  });
});

// 6. Cerrar un caso
app.put('/api/support/tickets/:id/close', authenticateToken, requireRole('user'), (req, res) => {
  db.run(`UPDATE support_tickets SET status = 'closed' WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id], function(err) {
    if (err) return res.status(500).json({ success: false, message: 'Error cerrando el caso' });
    if (this.changes === 0) return res.status(404).json({ success: false, message: 'Caso no encontrado' });
    res.json({ success: true });
  });
});

// 4. Catálogo: Obtener todos los comercios
app.get('/api/stores', (req, res) => {
  const { lat, lng, category, sortBy } = req.query;
  const userLat = parseFloat(lat);
  const userLng = parseFloat(lng);

  const sql = `
    SELECT stores.*,
      (SELECT COUNT(*) FROM orders WHERE orders.store_id = stores.id AND orders.rating_store IS NOT NULL) as reviewsCount
    FROM stores WHERE is_open = 1
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Error al obtener tiendas' });

    // Parsear tags de JSON string a Array y mapear propiedades
    let stores = rows.map(store => ({
      ...store,
      image: store.image_url,
      logo: store.logo_url,
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

    if (category) {
      const cat = String(category).toLowerCase();
      stores = stores.filter(s =>
        (s.category || '').toLowerCase() === cat ||
        (s.tags || []).some(t => t.toLowerCase() === cat)
      );
    }

    if (sortBy === 'rating') {
      stores.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'fastest') {
      const parseMinutes = (t) => parseInt(String(t).match(/\d+/), 10) || 999;
      stores.sort((a, b) => parseMinutes(a.deliveryTime) - parseMinutes(b.deliveryTime));
    } else if (sortBy === 'offers') {
      stores = stores.filter(s => /oferta/i.test(s.badge || '') || s.isTurbo);
    }

    res.json({ success: true, stores });
  });
});

// 4.1 Catálogo: Reseñas de un comercio (de pedidos calificados)
app.get('/api/stores/:id/reviews', authenticateToken, (req, res) => {
  const sql = `
    SELECT orders.id as orderId, orders.rating_store, orders.rating_order, orders.rating_driver,
           orders.review_text, orders.created_at, orders.store_reply_text, orders.store_reply_at, users.name as customerName
    FROM orders
    JOIN users ON users.id = orders.customer_id
    WHERE orders.store_id = ? AND orders.rating_store IS NOT NULL
    ORDER BY orders.created_at DESC
  `;
  db.all(sql, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Error al obtener reseñas' });
    res.json({ success: true, reviews: rows });
  });
});

// --- Panel de comercios: reputación (ver y responder reseñas) ---
app.get('/api/store/reviews', authenticateToken, requireRole('store'), (req, res) => {
  const sql = `
    SELECT orders.id as orderId, orders.rating_store, orders.rating_order, orders.rating_driver,
           orders.review_text, orders.created_at, orders.store_reply_text, orders.store_reply_at, users.name as customerName
    FROM orders
    JOIN users ON users.id = orders.customer_id
    WHERE orders.store_id = ? AND orders.rating_store IS NOT NULL
    ORDER BY orders.created_at DESC
  `;
  db.all(sql, [req.user.storeId], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Error al obtener tus reseñas' });
    const avg = rows.length ? rows.reduce((s, r) => s + r.rating_store, 0) / rows.length : null;
    res.json({ success: true, reviews: rows, averageRating: avg ? Math.round(avg * 100) / 100 : null, totalReviews: rows.length });
  });
});

app.put('/api/store/reviews/:orderId/reply', authenticateToken, requireRole('store'), (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ success: false, message: 'Escribe una respuesta' });
  db.get('SELECT id FROM orders WHERE id = ? AND store_id = ? AND rating_store IS NOT NULL', [req.params.orderId, req.user.storeId], (err, row) => {
    if (err || !row) return res.status(404).json({ success: false, message: 'Reseña no encontrada' });
    db.run(
      `UPDATE orders SET store_reply_text = ?, store_reply_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [text.trim(), req.params.orderId],
      (updErr) => {
        if (updErr) return res.status(500).json({ success: false, message: 'Error guardando tu respuesta' });
        res.json({ success: true });
      }
    );
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

// --- Panel de comercios: configuración del negocio ---
app.get('/api/store/profile', authenticateToken, requireRole('store'), (req, res) => {
  db.get('SELECT * FROM stores WHERE id = ?', [req.user.storeId], (err, store) => {
    if (err || !store) return res.status(404).json({ success: false, message: 'Comercio no encontrado' });
    res.json({
      success: true,
      store: {
        ...store,
        tags: store.tags ? JSON.parse(store.tags) : [],
        hours: store.hours ? (() => { try { return JSON.parse(store.hours); } catch (e) { return null; } })() : null,
        specialDays: store.special_days ? (() => { try { return JSON.parse(store.special_days); } catch (e) { return []; } })() : []
      }
    });
  });
});

app.put('/api/store/profile', authenticateToken, requireRole('store'), (req, res) => {
  const { name, category, description, imageUrl, logoUrl, address, lat, lng } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'El nombre es obligatorio' });
  db.run(
    `UPDATE stores SET name = ?, category = ?, description = ?, image_url = ?, logo_url = ?, address = ?, lat = ?, lng = ? WHERE id = ?`,
    [name.trim(), category || 'restaurants', description || '', imageUrl || '', logoUrl || '', address || '', lat ?? null, lng ?? null, req.user.storeId],
    function(err) {
      if (err) return res.status(500).json({ success: false, message: 'Error actualizando tu perfil' });
      res.json({ success: true });
    }
  );
});

app.put('/api/store/hours', authenticateToken, requireRole('store'), (req, res) => {
  const { hours } = req.body;
  if (!Array.isArray(hours) || hours.length !== 7) {
    return res.status(400).json({ success: false, message: 'Los horarios deben incluir los 7 días de la semana' });
  }
  db.run('UPDATE stores SET hours = ? WHERE id = ?', [JSON.stringify(hours), req.user.storeId], (err) => {
    if (err) return res.status(500).json({ success: false, message: 'Error actualizando tus horarios' });
    res.json({ success: true });
  });
});

app.put('/api/store/special-days', authenticateToken, requireRole('store'), (req, res) => {
  const { specialDays } = req.body;
  if (!Array.isArray(specialDays)) return res.status(400).json({ success: false, message: 'Formato inválido' });
  db.run('UPDATE stores SET special_days = ? WHERE id = ?', [JSON.stringify(specialDays), req.user.storeId], (err) => {
    if (err) return res.status(500).json({ success: false, message: 'Error actualizando tus días especiales' });
    res.json({ success: true });
  });
});

app.put('/api/store/order-settings', authenticateToken, requireRole('store'), (req, res) => {
  const { deliveryFee, minOrder, deliveryRadiusKm, prepTimeMinutes } = req.body;
  if ([deliveryFee, minOrder, deliveryRadiusKm, prepTimeMinutes].some(v => typeof v !== 'number' || v < 0)) {
    return res.status(400).json({ success: false, message: 'Todos los valores deben ser números válidos' });
  }
  db.run(
    `UPDATE stores SET delivery_fee = ?, min_order = ?, delivery_radius_km = ?, prep_time_minutes = ? WHERE id = ?`,
    [deliveryFee, minOrder, deliveryRadiusKm, prepTimeMinutes, req.user.storeId],
    (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Error actualizando la configuración de pedidos' });
      res.json({ success: true });
    }
  );
});

// --- Panel de comercios: finanzas y liquidaciones ---
// El "neto del comercio" se calcula solo sobre el subtotal de productos (subtotal_usd):
// el envío y la propina son dinero que pasa directo al repartidor, no le pertenecen
// al comercio ni se les aplica comisión de la plataforma.
const STORE_COMMISSION_RATE = 0.15;

function fetchCompletedStoreOrders(storeId, callback) {
  db.all(
    `SELECT id, subtotal_usd, total_amount_usd, items_json, created_at, is_cancelled, status_step
     FROM orders WHERE store_id = ? ORDER BY created_at DESC`,
    [storeId],
    (err, rows) => callback(err, rows || [])
  );
}

app.get('/api/store/finance/summary', authenticateToken, requireRole('store'), (req, res) => {
  fetchCompletedStoreOrders(req.user.storeId, (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Error obteniendo tus finanzas' });

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const monthAgo = new Date(now.getTime() - 30 * 86400000);

    const completed = rows.filter(o => !o.is_cancelled && o.status_step >= 4);
    const cancelled = rows.filter(o => o.is_cancelled);

    const netOf = (o) => o.subtotal_usd * (1 - STORE_COMMISSION_RATE);

    const sumSince = (since) => completed
      .filter(o => new Date(o.created_at.replace(' ', 'T') + 'Z') >= since)
      .reduce((acc, o) => ({ net: acc.net + netOf(o), gross: acc.gross + o.subtotal_usd, count: acc.count + 1 }), { net: 0, gross: 0, count: 0 });

    const today = sumSince(new Date(todayStr + 'T00:00:00Z'));
    const week = sumSince(weekAgo);
    const month = sumSince(monthAgo);
    const allTime = completed.reduce((acc, o) => ({ net: acc.net + netOf(o), gross: acc.gross + o.subtotal_usd, count: acc.count + 1 }), { net: 0, gross: 0, count: 0 });

    const avgTicket = completed.length ? completed.reduce((s, o) => s + o.subtotal_usd, 0) / completed.length : 0;
    const cancellationRate = rows.length ? (cancelled.length / rows.length) * 100 : 0;

    const productCounts = {};
    completed.forEach(o => {
      let items = [];
      try { items = JSON.parse(o.items_json || '[]'); } catch (e) { items = []; }
      items.forEach(it => {
        productCounts[it.name] = (productCounts[it.name] || 0) + (it.quantity || 1);
      });
    });
    const topProducts = Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, qty]) => ({ name, qty }));

    const round2 = (n) => Math.round(n * 100) / 100;
    res.json({
      success: true,
      today: { net: round2(today.net), gross: round2(today.gross), orders: today.count },
      week: { net: round2(week.net), gross: round2(week.gross), orders: week.count },
      month: { net: round2(month.net), gross: round2(month.gross), orders: month.count },
      allTime: { net: round2(allTime.net), gross: round2(allTime.gross), orders: allTime.count },
      avgTicket: round2(avgTicket),
      cancellationRate: round2(cancellationRate),
      topProducts,
      commissionRate: STORE_COMMISSION_RATE
    });
  });
});

app.get('/api/store/finance/sales', authenticateToken, requireRole('store'), (req, res) => {
  fetchCompletedStoreOrders(req.user.storeId, (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Error obteniendo el detalle de ventas' });
    const completed = rows.filter(o => !o.is_cancelled && o.status_step >= 4).slice(0, 100);
    const sales = completed.map(o => ({
      id: o.id,
      createdAt: o.created_at,
      grossSales: o.subtotal_usd,
      commission: Math.round(o.subtotal_usd * STORE_COMMISSION_RATE * 100) / 100,
      netEarnings: Math.round(o.subtotal_usd * (1 - STORE_COMMISSION_RATE) * 100) / 100
    }));
    res.json({ success: true, sales });
  });
});

app.get('/api/store/finance/settlements', authenticateToken, requireRole('store'), (req, res) => {
  fetchCompletedStoreOrders(req.user.storeId, (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Error obteniendo tus liquidaciones' });
    const completed = rows.filter(o => !o.is_cancelled && o.status_step >= 4);
    if (!completed.length) return res.json({ success: true, settlements: [] });

    // Agrupamos en periodos semanales (lunes a domingo) a partir del pedido más antiguo.
    const buckets = {};
    completed.forEach(o => {
      const date = new Date(o.created_at.replace(' ', 'T') + 'Z');
      const day = date.getUTCDay();
      const monday = new Date(date);
      monday.setUTCDate(date.getUTCDate() - ((day + 6) % 7));
      monday.setUTCHours(0, 0, 0, 0);
      const key = monday.toISOString().slice(0, 10);
      if (!buckets[key]) buckets[key] = { orders: 0, gross: 0 };
      buckets[key].orders++;
      buckets[key].gross += o.subtotal_usd;
    });

    const settlements = Object.entries(buckets)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([weekStart, b]) => {
        const start = new Date(weekStart + 'T00:00:00Z');
        const end = new Date(start.getTime() + 6 * 86400000);
        const net = b.gross * (1 - STORE_COMMISSION_RATE);
        return {
          weekStart,
          weekEnd: end.toISOString().slice(0, 10),
          orders: b.orders,
          grossSales: Math.round(b.gross * 100) / 100,
          commission: Math.round(b.gross * STORE_COMMISSION_RATE * 100) / 100,
          netEarnings: Math.round(net * 100) / 100,
          status: 'pending'
        };
      });

    res.json({ success: true, settlements });
  });
});

// --- Panel de comercios: promociones propias ---
app.get('/api/store/promotions', authenticateToken, requireRole('store'), (req, res) => {
  db.all('SELECT * FROM coupons WHERE store_id = ? ORDER BY rowid DESC', [req.user.storeId], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Error obteniendo tus promociones' });
    res.json({ success: true, promotions: rows });
  });
});

app.post('/api/store/promotions', authenticateToken, requireRole('store'), (req, res) => {
  const { code, title, description, discountType, discountValue, minOrder, promoType, expiresAt } = req.body;
  if (!code || !code.trim() || !title || !title.trim()) {
    return res.status(400).json({ success: false, message: 'Código y título son obligatorios' });
  }
  if (!['fixed', 'percent', 'shipping'].includes(discountType)) {
    return res.status(400).json({ success: false, message: 'Tipo de descuento inválido' });
  }
  const id = 'cpn-' + Date.now();
  db.run(
    `INSERT INTO coupons (id, store_id, code, title, description, discount_type, discount_value, min_order_usd, is_active, promo_type, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [id, req.user.storeId, code.trim().toUpperCase(), title.trim(), description || '', discountType, discountValue || 0, minOrder || 0, promoType || 'general', expiresAt || null],
    (err) => {
      if (err) {
        if (err.message.includes('UNIQUE')) return res.status(400).json({ success: false, message: 'Ya existe un cupón con ese código' });
        return res.status(500).json({ success: false, message: 'Error creando la promoción' });
      }
      res.json({ success: true, promotionId: id });
    }
  );
});

app.put('/api/store/promotions/:id', authenticateToken, requireRole('store'), (req, res) => {
  const { title, description, discountType, discountValue, minOrder, promoType, expiresAt } = req.body;
  if (!title || !title.trim() || !['fixed', 'percent', 'shipping'].includes(discountType)) {
    return res.status(400).json({ success: false, message: 'Datos de la promoción inválidos' });
  }
  db.run(
    `UPDATE coupons SET title = ?, description = ?, discount_type = ?, discount_value = ?, min_order_usd = ?, promo_type = ?, expires_at = ?
     WHERE id = ? AND store_id = ?`,
    [title.trim(), description || '', discountType, discountValue || 0, minOrder || 0, promoType || 'general', expiresAt || null, req.params.id, req.user.storeId],
    function(err) {
      if (err) return res.status(500).json({ success: false, message: 'Error actualizando la promoción' });
      if (this.changes === 0) return res.status(404).json({ success: false, message: 'Promoción no encontrada' });
      res.json({ success: true });
    }
  );
});

app.put('/api/store/promotions/:id/toggle', authenticateToken, requireRole('store'), (req, res) => {
  const { isActive } = req.body;
  db.run('UPDATE coupons SET is_active = ? WHERE id = ? AND store_id = ?', [isActive ? 1 : 0, req.params.id, req.user.storeId], function(err) {
    if (err) return res.status(500).json({ success: false, message: 'Error actualizando la promoción' });
    if (this.changes === 0) return res.status(404).json({ success: false, message: 'Promoción no encontrada' });
    res.json({ success: true });
  });
});

app.delete('/api/store/promotions/:id', authenticateToken, requireRole('store'), (req, res) => {
  db.run('DELETE FROM coupons WHERE id = ? AND store_id = ?', [req.params.id, req.user.storeId], function(err) {
    if (err) return res.status(500).json({ success: false, message: 'Error eliminando la promoción' });
    if (this.changes === 0) return res.status(404).json({ success: false, message: 'Promoción no encontrada' });
    res.json({ success: true });
  });
});

// --- Panel de repartidores ---

app.get('/api/drivers/me/dashboard', authenticateToken, requireRole('driver'), (req, res) => {
  db.get('SELECT * FROM drivers WHERE user_id = ?', [req.user.id], (err, driver) => {
    if (err || !driver) return res.status(403).json({ success: false, message: 'No tienes un perfil de repartidor activo' });

    const todayStr = new Date().toISOString().slice(0, 10);
    db.all(
      `SELECT status_step, shipping_fee_usd, driver_tip_usd, created_at FROM orders WHERE driver_id = ? AND status_step = 4`,
      [driver.id],
      (ordersErr, rows) => {
        if (ordersErr) return res.status(500).json({ success: false, message: 'Error obteniendo tu resumen' });

        let earningsToday = 0, tripsToday = 0;
        (rows || []).forEach(o => {
          if ((o.created_at || '').slice(0, 10) === todayStr) {
            earningsToday += (o.shipping_fee_usd || 0) + (o.driver_tip_usd || 0);
            tripsToday++;
          }
        });

        res.json({
          success: true,
          name: driver.name,
          vehicleInfo: driver.vehicle_info,
          rating: driver.rating,
          isOnline: !!driver.is_online,
          earningsTotal: Math.round((driver.earnings_total || 0) * 100) / 100,
          earningsToday: Math.round(earningsToday * 100) / 100,
          tripsToday,
          tripsTotal: (rows || []).length
        });
      }
    );
  });
});

app.put('/api/drivers/me/status', authenticateToken, requireRole('driver'), (req, res) => {
  const { isOnline } = req.body;
  db.run('UPDATE drivers SET is_online = ? WHERE user_id = ?', [isOnline ? 1 : 0, req.user.id], function(err) {
    if (err) return res.status(500).json({ success: false, message: 'Error actualizando tu estado' });
    if (this.changes === 0) return res.status(403).json({ success: false, message: 'No tienes un perfil de repartidor activo' });
    res.json({ success: true, isOnline: !!isOnline });
  });
});

app.put('/api/drivers/me/location', authenticateToken, requireRole('driver'), (req, res) => {
  const { lat, lng } = req.body;
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ success: false, message: 'Coordenadas inválidas' });
  }
  db.run('UPDATE drivers SET current_lat = ?, current_lng = ? WHERE user_id = ?', [lat, lng, req.user.id], function(err) {
    if (err) return res.status(500).json({ success: false, message: 'Error actualizando tu ubicación' });
    res.json({ success: true });
  });
});

// --- Panel de comercios: gestión del catálogo (categorías y productos propios) ---

app.get('/api/store/categories', authenticateToken, requireRole('store'), (req, res) => {
  db.all('SELECT * FROM product_categories WHERE store_id = ? ORDER BY sort_order ASC, created_at ASC', [req.user.storeId], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Error obteniendo categorías' });
    res.json({ success: true, categories: rows });
  });
});

app.post('/api/store/categories', authenticateToken, requireRole('store'), (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'El nombre de la categoría es obligatorio' });
  const id = 'cat-' + Date.now();
  db.run('INSERT INTO product_categories (id, store_id, name) VALUES (?, ?, ?)', [id, req.user.storeId, name.trim()], (err) => {
    if (err) return res.status(500).json({ success: false, message: 'Error creando la categoría' });
    res.json({ success: true, category: { id, store_id: req.user.storeId, name: name.trim() } });
  });
});

app.put('/api/store/categories/:id', authenticateToken, requireRole('store'), (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ success: false, message: 'El nombre de la categoría es obligatorio' });
  db.run('UPDATE product_categories SET name = ? WHERE id = ? AND store_id = ?', [name.trim(), req.params.id, req.user.storeId], function(err) {
    if (err) return res.status(500).json({ success: false, message: 'Error actualizando la categoría' });
    if (this.changes === 0) return res.status(404).json({ success: false, message: 'Categoría no encontrada' });
    res.json({ success: true });
  });
});

app.delete('/api/store/categories/:id', authenticateToken, requireRole('store'), (req, res) => {
  db.get('SELECT id FROM product_categories WHERE id = ? AND store_id = ?', [req.params.id, req.user.storeId], (err, row) => {
    if (err || !row) return res.status(404).json({ success: false, message: 'Categoría no encontrada' });
    db.run('UPDATE products SET category_id = NULL WHERE category_id = ?', [req.params.id], () => {
      db.run('DELETE FROM product_categories WHERE id = ?', [req.params.id], (delErr) => {
        if (delErr) return res.status(500).json({ success: false, message: 'Error eliminando la categoría' });
        res.json({ success: true });
      });
    });
  });
});

app.get('/api/store/products', authenticateToken, requireRole('store'), (req, res) => {
  db.all('SELECT * FROM products WHERE store_id = ? ORDER BY created_at DESC', [req.user.storeId], (err, rows) => {
    if (err) return res.status(500).json({ success: false, message: 'Error obteniendo tu catálogo' });
    const products = rows.map(p => ({ ...p, options: p.options_json ? JSON.parse(p.options_json) : [] }));
    res.json({ success: true, products });
  });
});

app.post('/api/store/products', authenticateToken, requireRole('store'), (req, res) => {
  const { name, description, price, image, categoryId, calories, options } = req.body;
  if (!name || !name.trim() || typeof price !== 'number' || price < 0) {
    return res.status(400).json({ success: false, message: 'Nombre y precio válido son obligatorios' });
  }
  const id = 'p-' + Date.now();
  db.run(
    `INSERT INTO products (id, store_id, category_id, name, description, price_usd, image_url, calories, options_json, is_available, availability_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'available')`,
    [id, req.user.storeId, categoryId || null, name.trim(), description || '', price, image || '', calories || '', JSON.stringify(options || [])],
    (err) => {
      if (err) return res.status(500).json({ success: false, message: 'Error creando el producto' });
      res.json({ success: true, productId: id });
    }
  );
});

app.put('/api/store/products/:id', authenticateToken, requireRole('store'), (req, res) => {
  const { name, description, price, image, categoryId, calories, options } = req.body;
  if (!name || !name.trim() || typeof price !== 'number' || price < 0) {
    return res.status(400).json({ success: false, message: 'Nombre y precio válido son obligatorios' });
  }
  db.run(
    `UPDATE products SET name = ?, description = ?, price_usd = ?, image_url = ?, category_id = ?, calories = ?, options_json = ?
     WHERE id = ? AND store_id = ?`,
    [name.trim(), description || '', price, image || '', categoryId || null, calories || '', JSON.stringify(options || []), req.params.id, req.user.storeId],
    function(err) {
      if (err) return res.status(500).json({ success: false, message: 'Error actualizando el producto' });
      if (this.changes === 0) return res.status(404).json({ success: false, message: 'Producto no encontrado' });
      res.json({ success: true });
    }
  );
});

app.delete('/api/store/products/:id', authenticateToken, requireRole('store'), (req, res) => {
  db.run('DELETE FROM products WHERE id = ? AND store_id = ?', [req.params.id, req.user.storeId], function(err) {
    if (err) return res.status(500).json({ success: false, message: 'Error eliminando el producto' });
    if (this.changes === 0) return res.status(404).json({ success: false, message: 'Producto no encontrado' });
    res.json({ success: true });
  });
});

app.put('/api/store/products/:id/availability', authenticateToken, requireRole('store'), (req, res) => {
  const { status } = req.body;
  if (!['available', 'out_of_stock', 'paused'].includes(status)) {
    return res.status(400).json({ success: false, message: 'Estado de disponibilidad inválido' });
  }
  const isAvailable = status === 'available' ? 1 : 0;
  db.run(
    'UPDATE products SET availability_status = ?, is_available = ? WHERE id = ? AND store_id = ?',
    [status, isAvailable, req.params.id, req.user.storeId],
    function(err) {
      if (err) return res.status(500).json({ success: false, message: 'Error actualizando la disponibilidad' });
      if (this.changes === 0) return res.status(404).json({ success: false, message: 'Producto no encontrado' });
      res.json({ success: true });
    }
  );
});

// 5.1 Catálogo: Búsqueda de negocios y productos
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ success: true, stores: [], products: [] });
  const like = `%${q}%`;

  db.all(`SELECT * FROM stores WHERE is_open = 1 AND (name LIKE ? OR tags LIKE ?)`, [like, like], (storeErr, storeRows) => {
    if (storeErr) return res.status(500).json({ success: false, message: 'Error en la búsqueda' });
    const stores = storeRows.map(store => ({
      ...store,
      image: store.image_url,
      logo: store.logo_url,
      isTurbo: store.is_turbo === 1,
      deliveryTime: store.delivery_time,
      deliveryFee: store.delivery_fee,
      minOrder: store.min_order,
      tags: store.tags ? JSON.parse(store.tags) : []
    }));

    db.all(
      `SELECT products.*, stores.name as storeName FROM products
       JOIN stores ON stores.id = products.store_id
       WHERE products.is_available = 1 AND stores.is_open = 1 AND products.name LIKE ?
       LIMIT 30`,
      [like],
      (prodErr, prodRows) => {
        if (prodErr) return res.status(500).json({ success: false, message: 'Error en la búsqueda' });
        const products = prodRows.map(p => ({
          ...p,
          price: p.price_usd,
          image: p.image_url,
          popular: p.is_popular === 1,
          options: p.options_json ? JSON.parse(p.options_json) : []
        }));
        res.json({ success: true, stores, products });
      }
    );
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
