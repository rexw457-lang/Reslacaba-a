import mongoose from "mongoose";

const reservationSchema = new mongoose.Schema({
    customerName: { type: String, required: true },
    customerPhone: String,
    customerEmail: String,
    reservationDate: { type: Date, required: true },
    numberOfGuests: Number,
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Restaurant",
        required: true
    },
    table: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Table",
        required: true
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

export default mongoose.model("Reservation", reservationSchema);
