/* ==========================================================================
   RAPIDIN - EXPRESS BACKEND REST API, SQLITE & WEBSOCKETS SERVER
   ========================================================================== */

const express = require('express');
const path = require('path');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'rapidin_super_secret_key_2026';

// Conectar a SQLite
const dbPath = path.join(__dirname, 'db', 'rapidin.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error conectando a la base de datos:', err.message);
  } else {
    console.log('📦 Conectado a la Base de Datos SQLite (rapidin.db)');
  }
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

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
app.post('/api/orders', (req, res) => {
  const newOrder = req.body;
  const orderId = newOrder.id; // 'RPD-12345'
  
  const sql = `
    INSERT INTO orders (
      id, store_id, customer_address, items_json,
      subtotal_usd, shipping_fee_usd, driver_tip_usd, total_amount_usd, platform_commission_usd,
      status_step, status_text
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const itemsJson = JSON.stringify(newOrder.items || []);
  const subtotal = newOrder.subtotal || 0;
  const shipping = newOrder.shippingFee || 1.99;
  const tip = newOrder.driverTip || 0;
  const total = newOrder.total || (subtotal + shipping + tip);
  const commission = total * 0.15; // 15% platform commission

  db.run(sql, [
    orderId,
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
app.get('/api/orders/store/:storeId', (req, res) => {
  const { storeId } = req.params;
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

// 3.2 Obtener pedidos pendientes para conductores (listos para recoger o en preparación)
app.get('/api/orders/pending', (req, res) => {
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

// 3.3 Actualizar estado de pedido
app.put('/api/orders/:id/status', (req, res) => {
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
