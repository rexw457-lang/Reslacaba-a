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

