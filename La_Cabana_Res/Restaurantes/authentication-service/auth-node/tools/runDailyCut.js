import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { runDailyCut } from '../src/services/dailyCut.service.js';

dotenv.config();

// Uso:
//   node tools/runDailyCut.js --dry-run   -> solo lista los pedidos que se cerrarían
//   node tools/runDailyCut.js             -> ejecuta el corte ahora
// Cierra como Entregado los pedidos activos creados ANTES de hoy (hora de Guatemala).
const dryRun = process.argv.includes('--dry-run');

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI no definido en .env');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);

  const { cutoff, closedCount, orders } = await runDailyCut({ dryRun });
  console.log(`Pedidos activos creados antes de ${cutoff.toISOString()}`);

  if (dryRun) {
    console.log(`[simulación] Se cerrarían ${orders.length} pedido(s):`);
    for (const order of orders) {
      console.log(`  ${order.orderNumber}  creado ${order.createdAt.toISOString()}`);
    }
  } else {
    console.log(`${closedCount} pedido(s) marcados como Entregado.`);
  }

  await mongoose.disconnect();
};

run().catch((e) => { console.error(e); process.exit(1); });
