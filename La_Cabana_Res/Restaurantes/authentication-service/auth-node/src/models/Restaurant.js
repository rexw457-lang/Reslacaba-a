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
    isDeleted: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

export default mongoose.model("Restaurant", restaurantSchema);
