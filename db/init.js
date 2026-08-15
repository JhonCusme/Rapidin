/* ==========================================================================
   RAPIDIN - INITIALIZE SQLITE DATABASE FROM SCHEMA
   ========================================================================== */

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'rapidin.db');
const schemaPath = path.join(__dirname, '../shared/schema.sql');

console.log('📦 Inicializando base de datos Rapidin en:', dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error abriendo la base de datos', err.message);
    process.exit(1);
  }
});

const schema = fs.readFileSync(schemaPath, 'utf8');

// Dividir el archivo schema.sql en sentencias individuales
const statements = schema
  .split(';')
  .map(stmt => stmt.trim())
  .filter(stmt => stmt.length > 0);

db.serialize(() => {
  console.log(`Ejecutando ${statements.length} sentencias SQL...`);
  
  statements.forEach(stmt => {
    db.run(stmt, (err) => {
      if (err) {
        console.error('Error ejecutando sentencia:', err.message);
        console.error('Sentencia fallida:', stmt);
      }
    });
  });

  console.log('✅ Base de datos inicializada correctamente.');
});

db.close();
