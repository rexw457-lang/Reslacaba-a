import mongoose from "mongoose";

const roleSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: [true, "El nombre del rol es obligatorio"],
        unique: true,
        trim: true,
        uppercase: true
    }
}, { 
    timestamps: true 
});

export default mongoose.models.Role || mongoose.model("Role", roleSchema);
