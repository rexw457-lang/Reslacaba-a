import mongoose from "mongoose";

const tableSchema = new mongoose.Schema({
    name: {
        type: String,
        trim: true,
        default: ''
    },
    number: {
        type: Number,
        required: true
    },
    capacity: {
        type: Number,
        required: true
    },
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Restaurant",
        required: true
    },
    status: {
        type: String,
        enum: ["disponible", "no disponible"],
        default: "disponible"
    },
    isDeleted: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Índice único para number por restaurant
tableSchema.index({ number: 1, restaurant: 1 }, { unique: true });

export default mongoose.model("Table", tableSchema);
