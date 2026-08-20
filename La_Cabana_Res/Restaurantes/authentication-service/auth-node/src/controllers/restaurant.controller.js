import Restaurant from "../models/Restaurant.js";
import cloudinary from "../config/cloudinary.js";
import fs from "fs/promises";

const buildRestaurantPayload = async (body, file) => {
    const payload = {
        name: body.name?.trim(),
        address: body.address?.trim(),
        phone: body.phone?.trim(),
        email: body.email?.trim(),
        city: body.city?.trim(),
        manager: body.manager?.trim(),
        openingHours: body.openingHours?.trim(),
    };

    if (body.capacity !== undefined && body.capacity !== "") {
        payload.capacity = Number(body.capacity);
    }

    // Configuración de impresión automática ePOS-Print. Solo se incluye en
    // el payload si viene en el body, para no pisar los valores guardados
    // cuando el formulario que hace la petición no envía estos campos
    // (por ejemplo, al editar solo el nombre o la dirección del restaurante).
    if (body.printerEnabled !== undefined) {
        payload.printerEnabled = body.printerEnabled === true || body.printerEnabled === "true";
    }
    if (body.printerKitchenIp !== undefined) {
        payload.printerKitchenIp = body.printerKitchenIp?.trim();
    }
    if (body.printerKitchenPort !== undefined && body.printerKitchenPort !== "") {
        payload.printerKitchenPort = Number(body.printerKitchenPort);
    }
    if (body.printerDrinksIp !== undefined) {
        payload.printerDrinksIp = body.printerDrinksIp?.trim();
    }
    if (body.printerDrinksPort !== undefined && body.printerDrinksPort !== "") {
        payload.printerDrinksPort = Number(body.printerDrinksPort);
    }

    if (file?.path) {
        const uploadResult = await cloudinary.uploader.upload(file.path, {
            folder: process.env.CLOUDINARY_FOLDER || "restaurants",
        });
        payload.image = uploadResult.secure_url;
        await fs.unlink(file.path).catch(() => {});
    }

    return payload;
};

export const createRestaurant = async (req, res) => {
    try {
        const payload = await buildRestaurantPayload(req.body, req.file);
        const restaurant = await Restaurant.create(payload);
        res.status(201).json({
            message: "Restaurante creado correctamente",
            restaurant
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const getRestaurants = async (req, res) => {
    try {
        const restaurants = await Restaurant.find({ isDeleted: { $ne: true } });
        res.json({
            message: "Restaurantes obtenidos correctamente",
            restaurants
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getRestaurantById = async (req, res) => {
    try {
        const restaurant = await Restaurant.findOne({ _id: req.params.id, isDeleted: { $ne: true } });
        if (!restaurant) {
            return res.status(404).json({ message: "Restaurante no encontrado" });
        }
        res.json({
            message: "Restaurante obtenido correctamente",
            restaurant
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateRestaurant = async (req, res) => {
    try {
        const payload = await buildRestaurantPayload(req.body, req.file);
        const restaurant = await Restaurant.findOneAndUpdate(
            { _id: req.params.id, isDeleted: { $ne: true } },
            payload,
            { new: true, runValidators: true }
        );
        if (!restaurant) {
            return res.status(404).json({ message: "Restaurante no encontrado" });
        }
        res.json({
            message: "Restaurante actualizado correctamente",
            restaurant
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteRestaurant = async (req, res) => {
    try {
        const restaurant = await Restaurant.findOneAndUpdate(
            { _id: req.params.id, isDeleted: { $ne: true } },
            { isDeleted: true },
            { new: true }
        );
        if (!restaurant) {
            return res.status(404).json({ message: "Restaurante no encontrado" });
        }
        res.json({ message: "Restaurante desactivado correctamente", restaurant });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

