const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'rapidin.db');

const db = new sqlite3.Database(dbPath);

console.log('🌱 Iniciando seedeo de la base de datos...');

const RAPIDIN_DATA = require('./data.js');

if (!RAPIDIN_DATA || !RAPIDIN_DATA.stores) {
  console.error('No se pudo cargar los datos desde db/data.js');
  process.exit(1);
}

db.serialize(() => {
  db.run('BEGIN TRANSACTION');

  RAPIDIN_DATA.stores.forEach(store => {
    const isTurbo = store.isTurbo ? 1 : 0;
    const tags = store.tags ? JSON.stringify(store.tags) : '[]';
    
    db.run(
      `INSERT INTO stores (id, name, category, country_code, badge, rating, delivery_time, delivery_fee, min_order, is_turbo, is_open, lat, lng, address, delivery_radius_km, image_url, logo_url, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        store.id,
        store.name,
        store.category || 'restaurants',
        'PE',
        store.badge || '',
        store.rating || 5.0,
        store.deliveryTime || '30 min',
        store.deliveryFee || 0,
        store.minOrder || 0,
        isTurbo,
        1,
        store.lat || 0,
        store.lng || 0,
        store.address || '',
        store.deliveryRadiusKm || 5.00,
        store.image || '',
        store.logo || '',
        tags
      ]
    );

    if (store.products) {
      store.products.forEach(prod => {
        const isPopular = prod.popular ? 1 : 0;
        const optionsJson = prod.options ? JSON.stringify(prod.options) : '[]';
        
        db.run(
          `INSERT INTO products (id, store_id, name, description, price_usd, image_url, is_popular, is_available, calories, options_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            prod.id,
            store.id,
            prod.name,
            prod.description || '',
            prod.price || 0,
            prod.image || '',
            isPopular,
            1,
            prod.calories || '',
            optionsJson
          ]
        );
      });
    }
  });

  db.run('COMMIT', (err) => {
    if (err) {
      console.error('❌ Error guardando los datos (COMMIT)', err.message);
    } else {
      console.log('✅ Base de datos poblada con éxito desde data.js');
    }
    db.close();
  });
});
