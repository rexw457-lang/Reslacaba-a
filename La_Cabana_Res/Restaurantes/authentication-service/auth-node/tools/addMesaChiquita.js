import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Table from '../src/models/Table.js';
import Restaurant from '../src/models/Restaurant.js';

dotenv.config();

// Uso: node tools/addMesaChiquita.js [capacidad]
// Crea la mesa "Mesa chiquita" en el primer restaurante, con el siguiente
// número de mesa libre. Si ya existe (aunque esté desactivada), la reactiva.
const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI no definido en .env');
    process.exit(1);
  }
  const capacity = Number(process.argv[2]) || 2;
  await mongoose.connect(process.env.MONGO_URI);

  // Para confirmar que es la MISMA base que usa el servidor en producción.
  const host = mongoose.connection.host;
  const dbName = mongoose.connection.name;
  const totalTables = await Table.countDocuments();
  const totalRestaurants = await Restaurant.countDocuments();
  console.log(`Conectado a: ${host} / base: "${dbName}" (${totalRestaurants} restaurantes, ${totalTables} mesas)`);

  const restaurant = await Restaurant.findOne();
  if (!restaurant) {
    console.error('Esta base de datos no tiene restaurantes: NO es la base que usa tu app.');
    console.error('Revisa el MONGO_URI del .env (debe ser el mismo que usa el servidor en producción).');
    await mongoose.disconnect();
    process.exit(1);
  }

  const existing = await Table.findOne({ restaurant: restaurant._id, name: /^mesa chiquita$/i });
  if (existing) {
    existing.isDeleted = false;
    existing.status = 'disponible';
    await existing.save();
    console.log(`La mesa ya existía (#${existing.number}); quedó activa.`);
  } else {
    const last = await Table.findOne({ restaurant: restaurant._id }).sort({ number: -1 });
    const number = (last?.number || 0) + 1;
    await Table.create({ name: 'Mesa chiquita', number, capacity, restaurant: restaurant._id });
    console.log(`Mesa chiquita creada con número ${number} y capacidad ${capacity}.`);
  }
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});