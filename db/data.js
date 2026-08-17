/* ==========================================================================
   RAPIDIN - DATOS DE EJEMPLO PARA SEEDING (db/seed.js)
   ========================================================================== */

module.exports = {
  stores: [
    {
      id: 'store-1',
      name: 'Burger Prime',
      category: 'restaurants',
      badge: 'Popular',
      rating: 4.8,
      deliveryTime: '20-30 min',
      deliveryFee: 1.99,
      minOrder: 5,
      isTurbo: false,
      lat: -12.0865,
      lng: -77.0335,
      address: 'Av. Principal 123, Lima',
      deliveryRadiusKm: 6,
      image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
      logo: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=200',
      tags: ['Hamburguesas', 'Rápida', 'Carnes'],
      products: [
        {
          id: 'p-101',
          name: 'Double Bacon Smoked Burger',
          description: 'Doble carne, doble tocino, queso cheddar ahumado y salsa especial.',
          price: 11.90,
          image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400',
          popular: true,
          calories: '890 kcal',
          options: [
            { title: 'Punto de cocción', required: true, type: 'radio', choices: [
              { name: 'Término medio', extra: 0 },
              { name: 'Bien cocido', extra: 0 }
            ]},
            { title: 'Extras', required: false, type: 'checkbox', choices: [
              { name: 'Queso extra', extra: 1.50 },
              { name: 'Tocino extra', extra: 2.00 }
            ]}
          ]
        },
        {
          id: 'p-102',
          name: 'Truffle Smash Burger',
          description: 'Smash burger con mayonesa de trufa y hongos salteados.',
          price: 13.50,
          image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=400',
          popular: true,
          calories: '760 kcal',
          options: []
        },
        {
          id: 'p-103',
          name: 'Papas Supremas Cheddar & Tocino',
          description: 'Papas fritas cubiertas con salsa cheddar y trozos de tocino.',
          price: 5.90,
          image: 'https://images.unsplash.com/photo-1576107232684-1279f3908594?w=400',
          popular: false,
          calories: '540 kcal',
          options: []
        }
      ]
    },
    {
      id: 'store-2',
      name: 'Sushi Turbo',
      category: 'turbo',
      badge: '15 MIN',
      rating: 4.9,
      deliveryTime: '15 min',
      deliveryFee: 2.49,
      minOrder: 8,
      isTurbo: true,
      lat: -12.0921,
      lng: -77.0282,
      address: 'Calle Los Sauces 456, Lima',
      deliveryRadiusKm: 4,
      image: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=800',
      logo: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=200',
      tags: ['Sushi', 'Turbo', 'Japonesa'],
      products: [
        {
          id: 'p-201',
          name: 'Combo California x20',
          description: '20 piezas de California roll con salsa acevichada.',
          price: 22.90,
          image: 'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=400',
          popular: true,
          calories: '620 kcal',
          options: []
        },
        {
          id: 'p-202',
          name: 'Ramen Tonkotsu',
          description: 'Caldo de cerdo 12 horas, chashu, huevo marinado y nori.',
          price: 16.50,
          image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400',
          popular: false,
          calories: '710 kcal',
          options: []
        }
      ]
    },
    {
      id: 'store-3',
      name: 'Mercado Fresco Express',
      category: 'supermarket',
      badge: 'Ofertas',
      rating: 4.6,
      deliveryTime: '30-40 min',
      deliveryFee: 2.99,
      minOrder: 10,
      isTurbo: false,
      lat: -12.0801,
      lng: -77.0401,
      address: 'Jr. Comercio 789, Lima',
      deliveryRadiusKm: 8,
      image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800',
      logo: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=200',
      tags: ['Supermercado', 'Abarrotes', 'Frutas'],
      products: [
        {
          id: 'p-301',
          name: 'Canasta de Frutas Mixtas 2kg',
          description: 'Selección de frutas frescas de temporada.',
          price: 9.90,
          image: 'https://images.unsplash.com/photo-1519996529931-28324d5a630e?w=400',
          popular: true,
          calories: '—',
          options: []
        },
        {
          id: 'p-302',
          name: 'Pack Snacks Saludables',
          description: 'Frutos secos, barras de granola y jugos naturales.',
          price: 7.50,
          image: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=400',
          popular: false,
          calories: '—',
          options: []
        }
      ]
    },
    {
      id: 'store-4',
      name: 'Farmacia 24/7 Salud Total',
      category: 'pharmacy',
      badge: '24 hrs',
      rating: 4.7,
      deliveryTime: '25-35 min',
      deliveryFee: 1.49,
      minOrder: 3,
      isTurbo: false,
      lat: -12.0790,
      lng: -77.0350,
      address: 'Av. Salud 321, Lima',
      deliveryRadiusKm: 7,
      image: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=800',
      logo: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=200',
      tags: ['Farmacia', '24 horas', 'Salud'],
      products: [
        {
          id: 'p-401',
          name: 'Kit Primeros Auxilios',
          description: 'Botiquín básico con vendas, alcohol y curitas.',
          price: 14.90,
          image: 'https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=400',
          popular: true,
          calories: '—',
          options: []
        }
      ]
    },
    {
      id: 'store-5',
      name: 'Licorería La Bodega',
      category: 'drinks',
      badge: 'Frio',
      rating: 4.5,
      deliveryTime: '20-30 min',
      deliveryFee: 2.49,
      minOrder: 15,
      isTurbo: false,
      lat: -12.0930,
      lng: -77.0410,
      address: 'Av. Fiesta 654, Lima',
      deliveryRadiusKm: 5,
      image: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800',
      logo: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=200',
      tags: ['Licores', 'Bebidas', 'Fiesta'],
      products: [
        {
          id: 'p-501',
          name: 'Pack Cervezas Artesanales x6',
          description: 'Selección de cervezas artesanales locales bien frías.',
          price: 24.90,
          image: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=400',
          popular: true,
          calories: '—',
          options: []
        }
      ]
    },
    {
      id: 'store-6',
      name: 'Mándame Algo Express',
      category: 'express',
      badge: 'Nuevo',
      rating: 4.9,
      deliveryTime: '30-45 min',
      deliveryFee: 3.49,
      minOrder: 0,
      isTurbo: false,
      lat: -12.0850,
      lng: -77.0300,
      address: 'Servicio de mensajería - Cobertura ciudad',
      deliveryRadiusKm: 10,
      image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800',
      logo: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=200',
      tags: ['Mensajería', 'Encargos', 'Documentos'],
      products: [
        {
          id: 'p-601',
          name: 'Envío de Documentos',
          description: 'Recojo y entrega de documentos en la ciudad.',
          price: 4.90,
          image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400',
          popular: false,
          calories: '—',
          options: []
        }
      ]
    }
  ]
};
