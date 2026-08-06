import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Order from '../src/models/Order.js';
import MenuItem from '../src/models/MenuItem.js';

dotenv.config();

const run = async () => {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI no definido en .env');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const orders = await Order.find().sort({ createdAt: -1 }).limit(5).populate('items.menuItem');
  for (const order of orders) {
    console.log('ORDER', order._id.toString(), order.orderNumber, order.status, order.drinkStatus, order.kitchenStatus);
    for (const item of order.items) {
      console.log('  ITEM', item.quantity, item.price, 'delivered=', item.delivered, 'isIncluded=', item.isIncluded, 'hideInBebidas=', item.hideInBebidas, 'label=', item.label || '', 'menuItem=', item.menuItem?.name || '—');
    }
  }
  await mongoose.disconnect();
};

run().catch((e) => { console.error(e); process.exit(1); });
