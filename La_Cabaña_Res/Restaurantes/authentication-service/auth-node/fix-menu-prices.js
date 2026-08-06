import dotenv from 'dotenv';
import mongoose from 'mongoose';
import MenuItem from './src/models/MenuItem.js';

dotenv.config();

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error('Error: MONGO_URI no está definido. Crea .env con la conexión a MongoDB.');
  process.exit(1);
}

const baseItems = [
  { name: 'Papas Supreme', category: 'Entradas', price: 25, description: 'Papas con toppings.' },
  { name: 'Nachos Supreme', category: 'Entradas', price: 25, description: 'Nachos con queso y toppings.' },
  { name: 'Papas fritas', category: 'Entradas', price: 10, description: 'Papas fritas tradicionales.' },
  { name: 'Papas con queso', category: 'Entradas', price: 15, description: 'Papas con queso suave.' },
  { name: 'Porción de Camarones (Al Ajillo, A la Diabla, Empanizados o Encebollados)', category: 'Extras', price: 40, description: 'Porción de camarones al estilo de la casa.' },
  { name: 'Porción de tortillas', category: 'Extras', price: 5, description: 'Porción de tortillas frescas.' },
  { name: 'Porción de tostadas', category: 'Extras', price: 8, description: 'Porción de tostadas.' },
  { name: 'Camarones Empanizados', category: 'Platos Fuertes', price: 65, description: 'Camarones empanizados.' },
  { name: 'Camarones Encebollados', category: 'Platos Fuertes', price: 65, description: 'Camarones encebollados.' },
  { name: 'Camarones a la Diabla', category: 'Platos Fuertes', price: 65, description: 'Camarones a la diabla.' },
  { name: 'Camarones al Ajillo', category: 'Platos Fuertes', price: 65, description: 'Camarones al ajillo.' },
  { name: 'Mar y Tierra', category: 'Platos Fuertes', price: 130, description: 'Combinación de mar y tierra.' },
  { name: 'Caldo de Mariscos', category: 'Platos Fuertes', price: 95, description: 'Caldo tradicional de mariscos.' },
  { name: 'Caldo de Camarones', category: 'Platos Fuertes', price: 65, description: 'Caldo de camarones.' },
  { name: 'Pechuga Empanizada o a la Plancha', category: 'Platos Fuertes', price: 45, description: 'Pechuga preparada al estilo del cliente.' },
  { name: 'Ceviche Mixto', category: 'Platos Fuertes', price: 50, description: 'Ceviche mixto refrescante.' },
  { name: 'Ceviche de Camarón', category: 'Platos Fuertes', price: 60, description: 'Ceviche de camarón.' },
  { name: 'Mojarra Frita (Empanizada o al Vapor)', category: 'Platos Fuertes', price: null, description: 'Mojarra frita según tamaño solicitado.' },
  { name: 'Mojarra Frita con Camarones', category: 'Platos Fuertes', price: 150, description: 'Mojarra con camarones.' },
  { name: 'Costillas en Barbacoa', category: 'Platos Fuertes', price: 65, description: 'Costillas en barbacoa.' },
  { name: 'Alitas en Barbacoa o Búfalo', category: 'Platos Fuertes', price: 60, description: 'Alitas al estilo del chef.' },
  { name: 'Hamburguesa de Res', category: 'Hamburguesas', price: 40, description: 'Hamburguesa de res.' },
  { name: 'Hamburguesa de Pollo', category: 'Hamburguesas', price: 40, description: 'Hamburguesa de pollo.' },
  { name: 'Hamburguesa de Tocino', category: 'Hamburguesas', price: 50, description: 'Hamburguesa de tocino.' },
  { name: 'Hamburguesa Torito', category: 'Hamburguesas', price: 45, description: 'Hamburguesa Torito.' },
  { name: 'Hamburguesa Doble', category: 'Hamburguesas', price: 60, description: 'Hamburguesa doble.' },
  { name: 'Hamburguesa de Camarón', category: 'Hamburguesas', price: 50, description: 'Hamburguesa de camarón.' },
  { name: 'Capuccino', category: 'Bebidas Calientes (Starbucks)', price: 25, description: 'Bebida caliente estilo Starbucks.' },
  { name: 'Latte', category: 'Bebidas Calientes (Starbucks)', price: 25, description: 'Latte.' },
  { name: 'Caramel Macchiato', category: 'Bebidas Calientes (Starbucks)', price: 25, description: 'Caramel macchiato.' },
  { name: 'White Mocha', category: 'Bebidas Calientes (Starbucks)', price: 25, description: 'White mocha.' },
  { name: 'Capuccino', category: 'Bebidas calientes', price: 18, description: 'Capuccino clásico.' },
  { name: 'Café con leche', category: 'Bebidas calientes', price: 15, description: 'Café con leche.' },
  { name: 'Café con cremora', category: 'Bebidas calientes', price: 15, description: 'Café con cremora.' },
  { name: 'Té (variedad)', category: 'Bebidas calientes', price: 15, description: 'Té de variedad.' },
  { name: 'Chocolate', category: 'Bebidas calientes', price: 18, description: 'Chocolate caliente.' },
  { name: 'Café', category: 'Bebidas calientes', price: 15, description: 'Café de la casa.' },
  { name: 'Soda (variedad)', category: 'Bebidas frias', price: 10, description: 'Soda.' },
  { name: 'Limonada', category: 'Bebidas frias', price: 15, description: 'Limonada fresca.' },
  { name: 'Naranjada', category: 'Bebidas frias', price: 15, description: 'Naranjada.' },
  { name: 'Jamaica', category: 'Bebidas frias', price: 15, description: 'Jamaica.' },
  { name: 'Licuado de frutas', category: 'Bebidas frias', price: 15, description: 'Licuado de frutas.' },
  { name: 'Shakalaka', category: 'Bebidas frias', price: 10, description: 'Shakalaka.' },
  { name: 'Yogurt con frutas', category: 'Postres', price: 15, description: 'Yogurt con frutas.' },
  { name: 'Copa de helado', category: 'Postres', price: 15, description: 'Copa de helado.' },
  { name: 'Crepas', category: 'Postres', price: 35, description: 'Crepas.' },
  { name: 'Crepa con helado', category: 'Postres', price: 45, description: 'Crepa con helado.' },
  { name: 'Plato de frutas', category: 'Postres', price: 15, description: 'Plato de frutas.' },
];

const applyPriceFix = async () => {
  await mongoose.connect(mongoUri);
  console.log('Conectado a MongoDB');

  for (const item of baseItems) {
    const query = { name: item.name, category: item.category, isDeleted: { $ne: true } };
    const existing = await MenuItem.findOne(query);
    if (!existing) {
      if (item.price !== null) {
        await MenuItem.create({ ...item, available: true });
        console.log(`Creado: ${item.category} / ${item.name} -> Q${item.price}`);
      } else {
        await MenuItem.create({ ...item, available: true });
        console.log(`Creado sin precio: ${item.category} / ${item.name}`);
      }
      continue;
    }

    const updates = {};
    if (item.price !== null && (!existing.price || Number(existing.price) === 0 || Number(existing.price) !== Number(item.price))) {
      updates.price = item.price;
    }
    if (!existing.description || existing.description.trim() === '') {
      updates.description = item.description;
    }
    if (typeof item.available === 'boolean' && existing.available !== item.available) {
      updates.available = item.available;
    }

    if (Object.keys(updates).length > 0) {
      await MenuItem.updateOne({ _id: existing._id }, { $set: updates });
      console.log(`Actualizado: ${item.category} / ${item.name} ->`, updates);
    }
  }

  await mongoose.disconnect();
  console.log('Corrección de precios completada.');
};

applyPriceFix().catch((err) => {
  console.error(err);
  process.exit(1);
});
