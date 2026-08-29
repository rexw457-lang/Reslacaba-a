import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
    {
        orderNumber: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        table: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Table",
            required: false,
        },
        items: [
            {
                menuItem: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "MenuItem",
                    required: false,
                },
                label: {
                    type: String,
                    trim: true,
                    default: "",
                },
                quantity: {
                    type: Number,
                    required: true,
                    min: 1,
                },
                price: {
                    type: Number,
                    required: true,
                },
                observations: {
                    type: String,
                    default: "",
                },
                delivered: {
                    type: Boolean,
                    default: false,
                },
                isIncluded: {
                    type: Boolean,
                    default: false,
                },
                hideInBebidas: {
                    type: Boolean,
                    default: false,
                },
            },
        ],
        observations: {
            type: String,
            default: "",
        },
        isToGo: {
            type: Boolean,
            default: false,
        },
        total: {
            type: Number,
            default: 0,
        },
        drinkStatus: {
            type: String,
            enum: ["Pendiente", "Entregado"],
            default: "Pendiente",
        },
        kitchenStatus: {
            type: String,
            enum: ["Pendiente", "Entregado"],
            default: "Pendiente",
        },
        status: {
            type: String,
            enum: ["Pendiente", "Preparando", "Entregado", "Cancelado"],
            default: "Pendiente",
        },
    },
    { timestamps: true },
);

export default mongoose.model("Order", orderSchema);