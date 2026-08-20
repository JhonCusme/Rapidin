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
    photo_url TEXT,
    stripe_customer_id VARCHAR(100),
    loyalty_points INT DEFAULT 0,
    referral_code VARCHAR(20),
    referred_by VARCHAR(20),
    referral_rewarded BOOLEAN DEFAULT FALSE,
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
    tags TEXT,
    description TEXT,
    hours TEXT,
    paused_until TIMESTAMP
);

-- Categorías del catálogo de cada comercio (ej. Hamburguesas, Bebidas, Postres)
CREATE TABLE IF NOT EXISTS product_categories (
    id VARCHAR(50) PRIMARY KEY,
    store_id VARCHAR(50) NOT NULL REFERENCES stores(id),
    name VARCHAR(100) NOT NULL,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Catálogo de Productos / Platillos
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(50) PRIMARY KEY,
    store_id VARCHAR(50) REFERENCES stores(id),
    category_id VARCHAR(50) REFERENCES product_categories(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price_usd DECIMAL(10, 2) NOT NULL,
    image_url TEXT,
    is_popular BOOLEAN DEFAULT FALSE,
    is_available BOOLEAN DEFAULT TRUE,
    availability_status VARCHAR(20) DEFAULT 'available', -- 'available', 'out_of_stock', 'paused'
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
    status_step INT DEFAULT 0, -- 0: Creado, 1: Aceptado/Preparando, 2: Listo/esperando repartidor, 3: En camino, 4: Entregado
    status_text VARCHAR(255),
    customer_address TEXT,
    items_json TEXT,
    subtotal_usd DECIMAL(10, 2) NOT NULL,
    shipping_fee_usd DECIMAL(10, 2) NOT NULL,
    driver_tip_usd DECIMAL(10, 2) DEFAULT 0.00,
    total_amount_usd DECIMAL(10, 2) NOT NULL,
    platform_commission_usd DECIMAL(10, 2) NOT NULL, -- 15% para Super Admin
    coupon_code VARCHAR(50),
    discount_usd DECIMAL(10, 2) DEFAULT 0.00,
    rating_order INT,
    rating_driver INT,
    rating_store INT,
    review_text TEXT,
    is_delayed BOOLEAN DEFAULT FALSE,
    is_cancelled BOOLEAN DEFAULT FALSE,
    cancel_reason TEXT,
    delivery_instructions TEXT,
    customer_lat DECIMAL(10, 6),
    customer_lng DECIMAL(10, 6),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Direcciones guardadas del usuario
CREATE TABLE IF NOT EXISTS addresses (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id),
    label VARCHAR(50) NOT NULL DEFAULT 'Casa', -- 'Casa', 'Trabajo', 'Otra'
    address_text TEXT NOT NULL,
    reference TEXT,
    lat DECIMAL(10, 6),
    lng DECIMAL(10, 6),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Métodos de pago guardados (referencia a Stripe - nunca se guarda el número completo ni el CVV)
CREATE TABLE IF NOT EXISTS payment_methods (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id),
    stripe_payment_method_id VARCHAR(100) NOT NULL,
    brand VARCHAR(30),
    last4 VARCHAR(4),
    exp_month INT,
    exp_year INT,
    cardholder_name VARCHAR(255),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Cupones/promociones disponibles en la plataforma
CREATE TABLE IF NOT EXISTS coupons (
    id VARCHAR(50) PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    discount_type VARCHAR(20) NOT NULL DEFAULT 'fixed', -- 'fixed', 'percent', 'shipping'
    discount_value DECIMAL(10, 2) NOT NULL DEFAULT 0,
    min_order_usd DECIMAL(10, 2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP,
    promo_type VARCHAR(20) DEFAULT 'general' -- 'general', '2x1', 'envio_gratis', 'flash'
);

-- Cupones canjeados/usados por cada usuario
CREATE TABLE IF NOT EXISTS user_coupons (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id),
    coupon_id VARCHAR(50) NOT NULL REFERENCES coupons(id),
    redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP,
    order_id VARCHAR(50) REFERENCES orders(id)
);

-- Preferencias de notificaciones por usuario
CREATE TABLE IF NOT EXISTS notification_preferences (
    user_id VARCHAR(50) PRIMARY KEY REFERENCES users(id),
    orders_enabled BOOLEAN DEFAULT TRUE,
    promotions_enabled BOOLEAN DEFAULT TRUE,
    offers_enabled BOOLEAN DEFAULT TRUE,
    news_enabled BOOLEAN DEFAULT FALSE
);

-- Mensajes de chat entre cliente y repartidor, por pedido
CREATE TABLE IF NOT EXISTS order_messages (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL REFERENCES orders(id),
    sender_role VARCHAR(20) NOT NULL, -- 'user' o 'driver'
    sender_id VARCHAR(50) NOT NULL,
    text TEXT,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Casos de soporte / ayuda
CREATE TABLE IF NOT EXISTS support_tickets (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id),
    order_id VARCHAR(50) REFERENCES orders(id),
    category VARCHAR(50) NOT NULL, -- 'pedido', 'pago', 'cuenta', 'delivery', 'promociones', 'otro'
    subject VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open', 'closed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS support_messages (
    id VARCHAR(50) PRIMARY KEY,
    ticket_id VARCHAR(50) NOT NULL REFERENCES support_tickets(id),
    sender_role VARCHAR(20) NOT NULL, -- 'user' o 'support'
    text TEXT,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Historial de puntos de fidelizacion (Rapidin Club)
CREATE TABLE IF NOT EXISTS points_history (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id),
    type VARCHAR(20) NOT NULL, -- 'earned', 'redeemed', 'referral_bonus'
    amount INT NOT NULL,
    description TEXT,
    order_id VARCHAR(50) REFERENCES orders(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rapidin Envios: envio de paquetes/documentos
CREATE TABLE IF NOT EXISTS shipments (
    id VARCHAR(50) PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL REFERENCES users(id),
    driver_id VARCHAR(50) REFERENCES drivers(id),
    origin_address TEXT NOT NULL,
    origin_lat DECIMAL(10, 6),
    origin_lng DECIMAL(10, 6),
    destination_address TEXT NOT NULL,
    destination_lat DECIMAL(10, 6),
    destination_lng DECIMAL(10, 6),
    package_size VARCHAR(20) NOT NULL DEFAULT 'small', -- 'small', 'medium', 'large'
    package_description TEXT,
    recipient_name VARCHAR(255),
    recipient_phone VARCHAR(20),
    distance_km DECIMAL(10, 2),
    price_usd DECIMAL(10, 2) NOT NULL,
    status_step INT DEFAULT 0, -- 0: Creado, 1: Recogido, 2: En camino, 3: Entregado
    status_text VARCHAR(255),
    is_cancelled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
