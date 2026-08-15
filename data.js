// Data principal de Rapidin - Multi-Categoría, Tiendas, Productos, Ofertas Flash y Seguimiento
const RAPIDIN_DATA = {
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
    {
      id: 'deal-1',
      title: '⚡ Rapidin Turbo - 40% OFF',
      subtitle: 'En frutas, verduras y snacks seleccionados',
      code: 'TURBO40',
      tag: 'OFERTA FLASH',
      gradient: 'linear-gradient(135deg, #FF3366 0%, #FF6600 100%)',
      endsInSeconds: 3590
    },
    {
      id: 'deal-2',
      title: '🍔 2x1 en Hamburguesas Prime',
      subtitle: 'Compra una Smoked Cheddar y llévate la segunda gratis',
      code: '2X1BURGER',
      tag: 'EXCLUSIVO VIP',
      gradient: 'linear-gradient(135deg, #7928CA 0%, #FF0080 100%)',
      endsInSeconds: 7190
    },
    {
      id: 'deal-3',
      title: '🚚 Envío Gratis ilimitado',
      subtitle: 'En tus primeras 3 compras superiores a $10',
      code: 'ENVIOGRATIS',
      tag: 'NUEVO USUARIO',
      gradient: 'linear-gradient(135deg, #0070F3 0%, #00DFD8 100%)',
      endsInSeconds: 14390
    }
  ],

  stores: [
    {
      id: 'store-1',
      name: 'Burger Prime & Grill',
      category: 'restaurants',
      isTurbo: false,
      rating: 4.9,
      reviewsCount: 1420,
      deliveryTime: '20-30 min',
      deliveryFee: 1.99,
      minOrder: 8.00,
      image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=800&q=80',
      logo: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=200&q=80',
      badge: 'Super Top 🔥',
      tags: ['Hamburguesas', 'Gourmet', 'Papas'],
      lat: -2.0553,
      lng: -79.8822,
      address: 'Plaza La Cuadra, La Joya, Guayaquil',
      products: [
        {
          id: 'p1',
          name: 'Double Bacon Smoked Burger',
          price: 11.90,
          description: 'Doble carne de res 100% Angus (300g), queso cheddar derretido, tocino crujiente, cebolla caramelizada y salsa secreta Rapidin.',
          image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80',
          popular: true,
          calories: '890 kcal',
          options: [
            {
              title: 'Término de la carne',
              required: true,
              type: 'radio',
              choices: [
                { name: 'Término Medio (Jugosa)', extra: 0 },
                { name: 'Bien Cocida', extra: 0 },
                { name: 'Tres Cuartos', extra: 0 }
              ]
            },
            {
              title: 'Acompañamiento',
              required: true,
              type: 'radio',
              choices: [
                { name: 'Papas Fritas Crujientes', extra: 0 },
                { name: 'Aros de Cebolla Artesanales', extra: 1.50 },
                { name: 'Camote Frito (Sweet Potato)', extra: 2.00 }
              ]
            },
            {
              title: 'Salsas Extra',
              required: false,
              type: 'checkbox',
              choices: [
                { name: 'Salsa Mayo-Trufada', extra: 0.90 },
                { name: 'BBQ Ahumada', extra: 0.70 },
                { name: 'Queso Cheddar Fundido Extra', extra: 1.50 }
              ]
            }
          ]
        },
        {
          id: 'p2',
          name: 'Truffle Smash Burger',
          price: 13.50,
          description: 'Dos medallas smash crujientes, queso Swiss fundido, aioli de trufa negra fresca y champiñones salteados en mantequilla.',
          image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=600&q=80',
          popular: true,
          calories: '760 kcal',
          options: [
            {
              title: 'Bebida',
              required: false,
              type: 'radio',
              choices: [
                { name: 'Coca-Cola Zero 500ml', extra: 1.80 },
                { name: 'Limonada de la Casa con Menta', extra: 2.50 },
                { name: 'Cerveza Artesanal IPA', extra: 3.90 }
              ]
            }
          ]
        },
        {
          id: 'p3',
          name: 'Papas Supremas Cheddar & Tocino',
          price: 5.90,
          description: 'Porción familiar de papas doradas bañadas en queso cheddar caliente, bits de tocino ahumado y cebollín.',
          image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?auto=format&fit=crop&w=600&q=80',
          popular: false,
          calories: '550 kcal'
        }
      ]
    },
    {
      id: 'store-2',
      name: 'Rapidin Turbo Market ⚡',
      category: 'turbo',
      isTurbo: true,
      rating: 4.95,
      reviewsCount: 3890,
      deliveryTime: '10-15 min',
      deliveryFee: 0.99,
      minOrder: 5.00,
      image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=800&q=80',
      logo: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=200&q=80',
      badge: 'Turbo 15 Min ⚡',
      tags: ['Abarrotes', 'Frutas', 'Snacks', 'Bebidas'],
      lat: -2.0540,
      lng: -79.8840,
      address: 'C.C. El Dorado, Vía a la Aurora',
      products: [
        {
          id: 'p4',
          name: 'Pack Cerveza Corona Extra 6 x 355ml (Heladas)',
          price: 9.90,
          description: 'Llegada ultrarrápida lista para consumir a temperatura helada ideal.',
          image: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?auto=format&fit=crop&w=600&q=80',
          popular: true,
          calories: '150 kcal c/u'
        },
        {
          id: 'p5',
          name: 'Aguacate / Palta Hass Madura (1 Kg)',
          price: 3.80,
          description: 'Selección premium, listas para comer hoy mismo.',
          image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=600&q=80',
          popular: true
        },
        {
          id: 'p6',
          name: 'Pringles Original 124g',
          price: 2.90,
          description: 'Crujientes papas fritas apiladas en tubo clásico.',
          image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?auto=format&fit=crop&w=600&q=80',
          popular: false
        }
      ]
    },
    {
      id: 'store-3',
      name: 'Sakura Sushi Bar & Wok',
      category: 'restaurants',
      isTurbo: false,
      rating: 4.8,
      reviewsCount: 940,
      deliveryTime: '25-35 min',
      deliveryFee: 1.50,
      minOrder: 12.00,
      image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=800&q=80',
      logo: 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?auto=format&fit=crop&w=200&q=80',
      badge: 'Envío GRATIS',
      tags: ['Sushi', 'Japonés', 'Rolls', 'Healthy'],
      lat: -2.0530,
      lng: -79.8850,
      address: 'Vía a Daule Km 14, La Aurora',
      products: [
        {
          id: 'p7',
          name: 'Combo Acevichado & Salmon Roll (20 Pcs)',
          price: 18.90,
          description: '10 pcs Acevichado Roll (Relleno de langostino frito, palta, cobertura de atún y salsa acevichada) + 10 pcs Salmon Passion Roll.',
          image: 'https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?auto=format&fit=crop&w=600&q=80',
          popular: true,
          options: [
            {
              title: 'Salsa Extra',
              required: false,
              type: 'checkbox',
              choices: [
                { name: 'Salsa Teriyaki Dulce', extra: 0.80 },
                { name: 'Wasabi Extra & Jengibre', extra: 0.50 },
                { name: 'Soya Low Sodium', extra: 0.00 }
              ]
            }
          ]
        },
        {
          id: 'p8',
          name: 'Ramen Tonkotsu Especial',
          price: 12.80,
          description: 'Caldo concentrado de cerdo durante 12 horas, fideos artesanales, chashu de cerdo, huevo ajitsuke marinado y alga nori.',
          image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=600&q=80',
          popular: true
        }
      ]
    },
    {
      id: 'store-4',
      name: 'Farmacia Express 24h',
      category: 'pharmacy',
      isTurbo: true,
      rating: 4.9,
      reviewsCount: 2150,
      deliveryTime: '15-20 min',
      deliveryFee: 1.20,
      minOrder: 3.00,
      image: 'https://images.unsplash.com/photo-1586015555751-63c3d059e826?auto=format&fit=crop&w=800&q=80',
      logo: 'https://images.unsplash.com/photo-1576602976047-174e57a47881?auto=format&fit=crop&w=200&q=80',
      badge: 'Abierto 24 Horas',
      tags: ['Medicinas', 'Primeros Auxilios', 'Cuidado'],
      lat: -2.0580,
      lng: -79.8800,
      address: 'Urbanización La Joya, Etapa Ónix',
      products: [
        {
          id: 'p9',
          name: 'Kit Antigripal Rápid-Relief',
          price: 6.50,
          description: 'Paracetamol 500mg + Vitamina C efervescente 1000mg + Caramelos mentolados.',
          image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80',
          popular: true
        },
        {
          id: 'p10',
          name: 'Protector Solar La Roche-Posay Anthelios SPF50+',
          price: 24.90,
          description: 'Fluido invisible ultra resistente al agua y sudor, toque seco.',
          image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80',
          popular: true
        }
      ]
    },
    {
      id: 'store-5',
      name: 'Napoli Pizza Woodfire 🍕',
      category: 'restaurants',
      isTurbo: false,
      rating: 4.85,
      reviewsCount: 1780,
      deliveryTime: '20-30 min',
      deliveryFee: 1.80,
      minOrder: 10.00,
      image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80',
      logo: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=200&q=80',
      badge: '2x1 Hoy',
      tags: ['Pizza', 'Italiana', 'Artesanal'],
      lat: -12.0890,
      lng: -77.0370,
      address: 'Calle Roma 204',
      products: [
        {
          id: 'p11',
          name: 'Pizza Pepperoni & Honey Hot (Familiar 40cm)',
          price: 15.90,
          description: 'Masa de fermentación lenta de 48h, salsa de tomate San Marzano, doble mozzarella fior di latte, cuencos de pepperoni crujiente y chorrito de miel picante.',
          image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=600&q=80',
          popular: true,
          options: [
            {
              title: 'Borde de la pizza',
              required: true,
              type: 'radio',
              choices: [
                { name: 'Borde Tradicional Neapolitano', extra: 0 },
                { name: 'Borde Relleno de Queso Mozzarella', extra: 2.90 },
                { name: 'Borde Relleno de Cream Cheese & Garlic', extra: 3.50 }
              ]
            }
          ]
        }
      ]
    }
  ],

  // Simulación de pedido activo en tiempo real
  activeOrder: {
    id: 'RPD-98421',
    statusStep: 2, // 0: Aceptado, 1: En Preparación, 2: Repartidor en Camino, 3: Entregado
    statusText: 'El repartidor va hacia tu ubicación 🛵',
    estimatedTime: '12 min',
    storeName: 'Burger Prime & Grill',
    storeImage: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=200&q=80',
    total: 23.40,
    itemsCount: 2,
    courier: {
      name: 'Carlos Ruiz',
      vehicle: 'Honda CB 190 Red (Placa RPD-77)',
      rating: 4.96,
      trips: 1840,
      phone: '+51 987 654 321',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
      lat: -12.0865,
      lng: -77.0335
    },
    storeLocation: { lat: -12.0880, lng: -77.0320 },
    userLocation: { lat: -12.0820, lng: -77.0370 },
    timeline: [
      { step: 0, title: 'Pedido Confirmado', time: '20:34', completed: true },
      { step: 1, title: 'El chef está preparando tus alimentos', time: '20:36', completed: true },
      { step: 2, title: 'Repartidor en camino con tu paquete', time: 'En progreso', completed: false, active: true },
      { step: 3, title: 'Entregado en tu puerta', time: 'Est. 20:49', completed: false }
    ],
    items: [
      { name: 'Double Bacon Smoked Burger', quantity: 1, price: 11.90, notes: 'Sin cebolla' },
      { name: 'Papas Supremas Cheddar & Tocino', quantity: 1, price: 5.90, notes: 'Extra crujientes' }
    ]
  },

  coupons: {
    'RAPIDINVIP': { discount: 5.00, type: 'fixed', label: '$5.00 de descuento VIP' },
    'TURBO40': { discount: 0.40, type: 'percent', label: '40% de Descuento Turbo' },
    'ENVIOGRATIS': { discount: 1.99, type: 'shipping', label: 'Envío Gratis' }
  }
};
