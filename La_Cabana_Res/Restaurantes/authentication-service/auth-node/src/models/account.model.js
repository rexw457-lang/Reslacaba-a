import mongoose from "mongoose";

const accountSchema = new mongoose.Schema({
    userId: {  
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    accountNumber: {
        type: String,
        required: true,
        unique: true
    },
    type: {  
        type: String,
        enum: ['ahorro', 'monetaria', 'corriente'],
        required: true
    },
    balance: {
        type: Number,
        default: 0,
        min: 0
    }
}, { timestamps: true });

export default mongoose.model('Account', accountSchema);