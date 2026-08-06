import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Restaurant",
        required: true
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
        required: true
    },
    comment: {
        type: String,
        trim: true
    },
    customerName: {
        type: String,
        trim: true
    },
    customerEmail: {
        type: String,
        trim: true
    }
}, { timestamps: true });

export default mongoose.model("Review", reviewSchema);
