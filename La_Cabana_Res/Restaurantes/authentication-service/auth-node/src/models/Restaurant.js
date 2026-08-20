import mongoose from "mongoose";

const restaurantSchema = new mongoose.Schema({
    name: { type: String, required: true },
    address: { type: String, required: true },
    phone: String,
    email: String,
    city: String,
    capacity: Number,
    openingHours: String,
    manager: String,
    image: String,
    // Configuración de impresión automática (ePOS-Print) a las impresoras
    // térmicas WiFi/Ethernet de cocina y bebidas. Se llenan desde el panel
    // de "Configurar impresoras" en Orders.jsx una vez que las impresoras
    // físicas estén conectadas a la red del restaurante.
    printerEnabled: {
        type: Boolean,
        default: false
    },
    printerKitchenIp: String,
    printerKitchenPort: {
        type: Number,
        default: 80
    },
    printerDrinksIp: String,
    printerDrinksPort: {
        type: Number,
        default: 80
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

export default mongoose.model("Restaurant", restaurantSchema);
