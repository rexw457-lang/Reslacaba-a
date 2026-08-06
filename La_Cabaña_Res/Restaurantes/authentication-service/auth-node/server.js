import express from "express";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

import restaurantRoutes from "./src/routes/restaurant.routes.js";
import menuItemRoutes from "./src/routes/menuItem.routes.js";
import orderRoutes from "./src/routes/order.routes.js";
import authRoutes from "./src/routes/auth.routes.js";
import userRoutes from "./src/routes/user.routes.js";
import roleRoutes from "./src/routes/role.routes.js";
import tableRoutes from "./src/routes/table.routes.js";
import reservationRoutes from "./src/routes/reservation.routes.js";

// Importar modelos
import Restaurant from "./src/models/Restaurant.js";
import MenuItem from "./src/models/MenuItem.js";
import Order from "./src/models/Order.js";
import Table from "./src/models/Table.js";
import Reservation from "./src/models/Reservation.js";
import Review from "./src/models/Review.js";
import User from "./src/models/User.js";
import Role from "./src/models/Role.js";


dotenv.config();

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "100kb" }));

const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        return callback(new Error("Origen no permitido por CORS"));
    },
    credentials: true
}));

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
    console.error("Error: MONGO_URI no está definido. Crea un archivo .env con la variable MONGO_URI de tu conexión MongoDB.");
    process.exit(1);
}

mongoose.connect(mongoUri)
    .then(async () => {
        console.log("MongoDB conectado");
        await seedInternalProfiles();
        await seedBaseMenuItems();
        await seedDefaultRestaurantAndTables();
    })
    .catch(err => console.error(err));

const seedDefaultRestaurantAndTables = async () => {
    try {
        const defaultRestaurantName = process.env.SEED_RESTAURANT_NAME || "Los Rubios Rojos";
        let restaurant = await Restaurant.findOne({ name: defaultRestaurantName, isDeleted: { $ne: true } });
        if (!restaurant) {
            restaurant = await Restaurant.create({
                name: defaultRestaurantName,
                address: process.env.SEED_RESTAURANT_ADDRESS || "Centro gastronómico",
            });
        }

        const defaultTables = [
            { number: 1, name: "Mesa 1", capacity: 4 },
            { number: 2, name: "Mesa 2", capacity: 4 },
            { number: 3, name: "Mesa 3", capacity: 4 },
            { number: 4, name: "Mesa 4", capacity: 4 },
            { number: 5, name: "Mesa café", capacity: 4 },
            { number: 6, name: "Mesa butacas y sillas", capacity: 4 },
            { number: 7, name: "Mesa espejos", capacity: 4 },
            { number: 8, name: "Mesa congelador", capacity: 4 },
            { number: 9, name: "Mesa grande", capacity: 6 },
        ];

        for (const tableData of defaultTables) {
            const exists = await Table.findOne({ restaurant: restaurant._id, number: tableData.number, isDeleted: { $ne: true } });
            if (!exists) {
                await Table.create({
                    ...tableData,
                    restaurant: restaurant._id,
                    status: "disponible",
                });
                continue;
            }

            const updates = {};
            if (exists.name !== tableData.name) updates.name = tableData.name;
            if (exists.capacity !== tableData.capacity) updates.capacity = tableData.capacity;
            if (Object.keys(updates).length > 0) {
                await Table.updateOne({ _id: exists._id }, { $set: updates });
            }
        }

        console.log("[Seed] Mesas base verificadas.");
    } catch (error) {
        console.error("[Seed] Error al crear mesas base:", error.message);
    }
};

const seedBaseMenuItems = async () => {
    try {
        const baseItems = [
            { name: "Papas Supreme", category: "Entradas", description: "Papas con toppings." , price: 25, available: true },
            { name: "Nachos Supreme", category: "Entradas", description: "Nachos con queso y toppings.", price: 25, available: true },
            { name: "Papas fritas", category: "Entradas", description: "Papas fritas tradicionales.", price: 10, available: true },
            { name: "Papas con queso", category: "Entradas", description: "Papas con queso suave.", price: 15, available: true },
            { name: "Porción de Camarones (Al Ajillo, A la Diabla, Empanizados o Encebollados)", category: "Extras", description: "Porción de camarones al estilo de la casa.", price: 40, available: true },
            { name: "Porción de tortillas", category: "Extras", description: "Porción de tortillas frescas.", price: 5, available: true },
            { name: "Porción de tostadas", category: "Extras", description: "Porción de tostadas.", price: 8, available: true },
            { name: "Camarones Empanizados", category: "Platos Fuertes", description: "Camarones empanizados.", price: 65, available: true },
            { name: "Camarones Encebollados", category: "Platos Fuertes", description: "Camarones encebollados.", price: 65, available: true },
            { name: "Camarones a la Diabla", category: "Platos Fuertes", description: "Camarones a la diabla.", price: 65, available: true },
            { name: "Camarones al Ajillo", category: "Platos Fuertes", description: "Camarones al ajillo.", price: 65, available: true },
            { name: "Mar y Tierra", category: "Platos Fuertes", description: "Combinación de mar y tierra.", price: 130, available: true },
            { name: "Caldo de Mariscos", category: "Platos Fuertes", description: "Caldo tradicional de mariscos.", price: 95, available: true },
            { name: "Caldo de Camarones", category: "Platos Fuertes", description: "Caldo de camarones.", price: 65, available: true },
            { name: "Pechuga Empanizada o a la Plancha", category: "Platos Fuertes", description: "Pechuga preparada al estilo del cliente.", price: 45, available: true },
            { name: "Ceviche Mixto", category: "Platos Fuertes", description: "Ceviche mixto refrescante.", price: 50, available: true },
            { name: "Ceviche de Camarón", category: "Platos Fuertes", description: "Ceviche de camarón.", price: 60, available: true },
            { name: "Mojarra Frita (Empanizada o al Vapor)", category: "Platos Fuertes", description: "Mojarra frita según tamaño solicitado.", price: 110, available: true },
            { name: "Mojarra Frita con Camarones", category: "Platos Fuertes", description: "Mojarra con camarones.", price: 150, available: true },
            { name: "Costillas en Barbacoa", category: "Platos Fuertes", description: "Costillas en barbacoa.", price: 65, available: true },
            { name: "Alitas en Barbacoa o Búfalo", category: "Platos Fuertes", description: "Alitas al estilo del chef.", price: 60, available: true },
            { name: "Hamburguesa de Res", category: "Hamburguesas", description: "Hamburguesa de res.", price: 40, available: true },
            { name: "Hamburguesa de Pollo", category: "Hamburguesas", description: "Hamburguesa de pollo.", price: 40, available: true },
            { name: "Hamburguesa de Tocino", category: "Hamburguesas", description: "Hamburguesa de tocino.", price: 50, available: true },
            { name: "Hamburguesa Torito", category: "Hamburguesas", description: "Hamburguesa Torito.", price: 45, available: true },
            { name: "Hamburguesa Doble", category: "Hamburguesas", description: "Hamburguesa doble.", price: 60, available: true },
            { name: "Hamburguesa de Camarón", category: "Hamburguesas", description: "Hamburguesa de camarón.", price: 50, available: true },
            { name: "Capuccino", category: "Bebidas Calientes (Starbucks)", description: "Bebida caliente estilo Starbucks.", price: 25, available: true },
            { name: "Latte", category: "Bebidas Calientes (Starbucks)", description: "Latte.", price: 25, available: true },
            { name: "Caramel Macchiato", category: "Bebidas Calientes (Starbucks)", description: "Caramel macchiato.", price: 25, available: true },
            { name: "White Mocha", category: "Bebidas Calientes (Starbucks)", description: "White mocha.", price: 25, available: true },
            { name: "Capuccino", category: "Bebidas calientes", description: "Capuccino clásico.", price: 18, available: true },
            { name: "Café con leche", category: "Bebidas calientes", description: "Café con leche.", price: 15, available: true },
            { name: "Café con cremora", category: "Bebidas calientes", description: "Café con cremora.", price: 15, available: true },
            { name: "Té (variedad)", category: "Bebidas calientes", description: "Té de variedad.", price: 15, available: true },
            { name: "Chocolate", category: "Bebidas calientes", description: "Chocolate caliente.", price: 18, available: true },
            { name: "Café", category: "Bebidas calientes", description: "Café de la casa.", price: 15, available: true },
            { name: "Soda (variedad)", category: "Bebidas frias", description: "Soda.", price: 10, available: true },
            { name: "Limonada", category: "Bebidas frias", description: "Limonada fresca.", price: 15, available: true },
            { name: "Naranjada", category: "Bebidas frias", description: "Naranjada.", price: 15, available: true },
            { name: "Jamaica", category: "Bebidas frias", description: "Jamaica.", price: 15, available: true },
            { name: "Licuado de frutas", category: "Bebidas frias", description: "Licuado de frutas.", price: 15, available: true },
            { name: "Shakalaka", category: "Bebidas frias", description: "Shakalaka.", price: 10, available: true },
            { name: "Yogurt con frutas", category: "Postres", description: "Yogurt con frutas.", price: 15, available: true },
            { name: "Copa de helado", category: "Postres", description: "Copa de helado.", price: 15, available: true },
            { name: "Crepas", category: "Postres", description: "Crepas.", price: 35, available: true },
            { name: "Crepa con helado", category: "Postres", description: "Crepa con helado.", price: 45, available: true },
            { name: "Plato de frutas", category: "Postres", description: "Plato de frutas.", price: 15, available: true },
        ];

        for (const item of baseItems) {
            const exists = await MenuItem.findOne({ name: item.name, category: item.category, isDeleted: { $ne: true } });
            if (!exists) {
                await MenuItem.create({ ...item, price: Number(item.price || 0) });
                continue;
            }

            const priceValue = Number(item.price || 0);
            const shouldUpdatePrice = priceValue > 0 && (!exists.price || Number(exists.price) === 0);
            const shouldUpdateDescription = !exists.description || exists.description.trim() === '';
            const updates = {};

            if (shouldUpdatePrice) updates.price = priceValue;
            if (shouldUpdateDescription) updates.description = item.description;
            if (typeof item.available === 'boolean' && exists.available !== item.available) updates.available = item.available;

            if (Object.keys(updates).length > 0) {
                await MenuItem.updateOne({ _id: exists._id }, { $set: updates });
            }
        }

        console.log("[Seed] Menú base verificado.");
    } catch (error) {
        console.error("[Seed] Error al crear el menú base:", error.message);
    }
};

const seedInternalProfiles = async () => {
    try {
        const defaultProfiles = [
            {
                username: process.env.SEED_ADMIN_USERNAME || "adminrestaurante",
                email: (process.env.SEED_ADMIN_EMAIL || "adminrestaurante@losrezagados.com").toLowerCase().trim(),
                password: process.env.SEED_ADMIN_PASSWORD || "Admin123",
                roleName: process.env.SEED_ADMIN_ROLE || "ADMIN",
                label: "admin"
            },
            {
                username: process.env.SEED_COCINA_USERNAME || "cocina",
                email: (process.env.SEED_COCINA_EMAIL || "cocina@losrezagados.com").toLowerCase().trim(),
                password: process.env.SEED_COCINA_PASSWORD || "Cocina123",
                roleName: process.env.SEED_COCINA_ROLE || "COCINA",
                label: "cocina"
            },
            {
                username: process.env.SEED_RECEPCION_USERNAME || "recepcion",
                email: (process.env.SEED_RECEPCION_EMAIL || "recepcion@losrezagados.com").toLowerCase().trim(),
                password: process.env.SEED_RECEPCION_PASSWORD || "Recepcion123",
                roleName: process.env.SEED_RECEPCION_ROLE || "RECEPCION",
                label: "recepcion"
            }
        ];

        for (const profile of defaultProfiles) {
            const role = await Role.findOneAndUpdate(
                { name: profile.roleName },
                { name: profile.roleName },
                { new: true, upsert: true }
            );

            let user = await User.findOne({ email: profile.email });
            if (!user) {
                user = new User({
                    username: profile.username,
                    email: profile.email,
                    password: profile.password,
                    role: role._id,
                    verified: true,
                    verificationToken: null,
                    verificationTokenExpires: null,
                    loginAttempts: 0,
                    lockUntil: null
                });
                await user.save();
                console.log(`[Seed] Perfil ${profile.label} creado: ${profile.email}`);
                continue;
            }

            if (user.role?.toString() !== role._id.toString()) {
                user.role = role._id;
            }

            if (!user.verified) {
                user.verified = true;
                user.verificationToken = null;
                user.verificationTokenExpires = null;
            }

            const passwordMatches = await user.comparePassword(profile.password);
            if (!passwordMatches) {
                user.password = profile.password;
            }

            await user.save();
            console.log(`[Seed] Perfil ${profile.label} actualizado: ${profile.email}`);
        }
    } catch (error) {
        console.error("Error al sembrar perfiles internos:", error);
    }
};

const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "API Restaurante",
            version: "1.0.0",
            description: "API completa para gestión de restaurante"
        },
        servers: [
            { url: "http://localhost:3000", description: "Node.js API" },
            { url: "http://localhost:5022", description: ".NET API" }
        ],
        security: [
            {
                bearerAuth: []
            }
        ],

        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT"
                }
            },

            schemas: {
                    Restaurant: {
                    type: "object",
                    properties: {
                        _id: { type: "string" },
                        name: { type: "string" },
                        address: { type: "string" },
                        phone: { type: "string" },
                        city: { type: "string" }
                    }
                },
                MenuItem: {
                    type: "object",
                    properties: {
                        _id: { type: "string" },
                        name: { type: "string" },
                        price: { type: "number" },
                        restaurant: { type: "string" }
                    }
                },
                Order: {
                    type: "object",
                    properties: {
                        _id: { type: "string" },
                        table: { type: "string" },
                        items: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    menuItem: { type: "string" },
                                    quantity: { type: "number" },
                                    price: { type: "number" }
                                }
                            }
                        },
                        total: { type: "number" },
                        status: { type: "string" }
                    }
                },
                Table: {
                    type: "object",
                    properties: {
                        _id: { type: "string" },
                        number: { type: "number" },
                        capacity: { type: "number" },
                        restaurant: { type: "string" },
                        status: { 
                            type: "string", 
                            enum: ["disponible", "no disponible"] 
                        }
                    }
                },
                Reservation: {
                    type: "object",
                    properties: {
                        _id: { type: "string" },
                        customerName: { type: "string" },
                        customerPhone: { type: "string" },
                        customerEmail: { type: "string" },
                        reservationDate: { type: "string", format: "date-time" },
                        numberOfGuests: { type: "number" },
                        restaurant: { type: "string" },
                        table: { type: "string" },
                        isDeleted: { type: "boolean" }
                    }
                },
                    Review: {
                    type: "object",
                    properties: {
                        _id: { type: "string" },
                        restaurant: { type: "string" },
                        rating: { type: "number" },
                        comment: { type: "string" }
                    }
                },
                AuthResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        message: { type: "string" },
                        token: { type: "string", nullable: true }
                    }
                }
            }
        }
    },

    apis: ["./server.js", "./src/routes/restaurant.routes.js", "./src/routes/menuItem.routes.js", "./src/routes/order.routes.js"]
};

const specs = swaggerJsdoc(options);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));


app.use("/restaurants", restaurantRoutes);
app.use("/menu-items", menuItemRoutes);
app.use("/menu", menuItemRoutes);
app.use("/orders", orderRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/roles", roleRoutes);
app.use("/tables", tableRoutes);
app.use("/api/reservations", reservationRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error("Error:", err.message);
    console.error(err.stack);
    res.status(500).json({ message: "Error interno del servidor", error: err.message });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Excepción no capturada:', error);
    process.exit(1);
});

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Rechazo no manejado en:', promise, 'razón:', reason);
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log("Servidor en http://localhost:" + PORT);
    console.log("Swagger UI disponible en: http://localhost:" + PORT + "/api-docs");
});

server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
        console.error(`El puerto ${PORT} ya está en uso. Cierra el proceso existente o cambia PORT en .env.`);
        process.exit(1);
    }
    console.error('Error de servidor:', error);
    process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM recibido, cerrando servidor...');
    server.close(() => {
        console.log('Servidor cerrado');
        process.exit(0);
    });
});
 