import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Order from '../src/models/Order.js';

dotenv.config();

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI no definido en .env');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const orders = await Order.find({ 'items.isIncluded': true }).limit(1000);
  let updatedCount = 0;
  for (const order of orders) {
    let modified = false;
    // use raw _doc to detect missing field in stored document
    const raw = order._doc || {};
    if (Array.isArray(raw.items)) {
      raw.items.forEach((rawItem, idx) => {
        if (rawItem && rawItem.isIncluded && !Object.prototype.hasOwnProperty.call(rawItem, 'hideInBebidas')) {
          const label = String(rawItem.label || '').toLowerCase();
          // set on the mongoose document's items as well
          order.items[idx].hideInBebidas = label.includes('tostada');
          modified = true;
        }
      });
    }
    if (modified) {
      await order.save();
      updatedCount++;
    }
  }
  console.log('Orders updated:', updatedCount);
  await mongoose.disconnect();
};

run().catch((e) => { console.error(e); process.exit(1); });
