-- ==========================================================================
-- RAPIDIN MULTI-NATIONAL DATABASE SCHEMA (PostgreSQL / SQLite Compatible)
-- ==========================================================================

-- Tabla de Usuarios (Clientes, Comercios, Repartidores, Admins)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    role VARCHAR(20) NOT NULL DEFAULT 'user', -- 'user', 'store', 'driver', 'admin'
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone_prefix VARCHAR(10) DEFAULT '+51',
    phone VARCHAR(20),
    country_code VARCHAR(5) DEFAULT 'PE',
    default_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Países y Monedas Internacionales
CREATE TABLE IF NOT EXISTS countries (
    code VARCHAR(5) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    symbol VARCHAR(5) NOT NULL,
    exchange_rate_usd DECIMAL(10, 4) NOT NULL DEFAULT 1.0,
    tax_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.18,
    phone_prefix VARCHAR(10) NOT NULL
);

-- Tabla de Comercios / Restaurantes
CREATE TABLE IF NOT EXISTS stores (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL,
    country_code VARCHAR(5) REFERENCES countries(code),
    badge VARCHAR(50),
    rating DECIMAL(3, 2) DEFAULT 4.9,
    delivery_time VARCHAR(30) DEFAULT '20-30 min',
    delivery_fee DECIMAL(10, 2) DEFAULT 1.99,
    min_order DECIMAL(10, 2) DEFAULT 5.00,
    is_turbo BOOLEAN DEFAULT FALSE,
    is_open BOOLEAN DEFAULT TRUE,
    lat DECIMAL(10, 6),
    lng DECIMAL(10, 6),
    address TEXT,
    delivery_radius_km DECIMAL(5, 2) DEFAULT 5.00,
    image_url TEXT,
    logo_url TEXT,
    tags TEXT
);

-- Tabla de Catálogo de Productos / Platillos
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(50) PRIMARY KEY,
    store_id VARCHAR(50) REFERENCES stores(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price_usd DECIMAL(10, 2) NOT NULL,
    image_url TEXT,
    is_popular BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN DEFAULT TRUE,
    calories VARCHAR(50),
    options_json TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Repartidores
CREATE TABLE IF NOT EXISTS drivers (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    vehicle_info VARCHAR(255) NOT NULL,
    rating DECIMAL(3, 2) DEFAULT 4.95,
    is_online BOOLEAN DEFAULT TRUE,
    current_lat DECIMAL(10, 6),
    current_lng DECIMAL(10, 6),
    earnings_total DECIMAL(10, 2) DEFAULT 0.00
);

-- Tabla de Pedidos Globales
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(50) PRIMARY KEY,
    customer_id VARCHAR(50) REFERENCES users(id),
    store_id VARCHAR(50) REFERENCES stores(id),
    driver_id VARCHAR(50) REFERENCES drivers(id),
    country_code VARCHAR(5) REFERENCES countries(code),
    status_step INT DEFAULT 0, -- 0: Creado, 1: En Preparación, 2: En Camino/Listo, 3: Entregado
    status_text VARCHAR(255),
    customer_address TEXT,
    items_json TEXT,
    subtotal_usd DECIMAL(10, 2) NOT NULL,
    shipping_fee_usd DECIMAL(10, 2) NOT NULL,
    driver_tip_usd DECIMAL(10, 2) DEFAULT 0.00,
    total_amount_usd DECIMAL(10, 2) NOT NULL,
    platform_commission_usd DECIMAL(10, 2) NOT NULL, -- 15% para Super Admin
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
