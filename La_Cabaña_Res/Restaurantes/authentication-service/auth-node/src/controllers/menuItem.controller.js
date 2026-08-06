import MenuItem from "../models/MenuItem.js";
import cloudinary from "../config/cloudinary.js";
import fs from "fs/promises";

const buildMenuItemPayload = async (body, file) => {
    const payload = {
        name: body.name?.trim(),
        description: body.description?.trim(),
        category: body.category?.trim(),
        available: body.available !== undefined ? body.available === true || body.available === "true" : true,
    };

    if (body.restaurant) {
        payload.restaurant = body.restaurant;
    }

    if (body.price !== undefined && body.price !== "") {
        payload.price = Number(body.price);
    }

    if (file) {
        const uploadResult = await cloudinary.uploader.upload(file.path, {
            folder: process.env.CLOUDINARY_FOLDER || "menu-items"
        });
        payload.image = uploadResult.secure_url;
        await fs.unlink(file.path).catch(() => {});
    }

    return payload;
};

export const createMenuItem = async (req, res) => {
    try {
        const payload = await buildMenuItemPayload(req.body, req.file);

        const menuItem = await MenuItem.create(payload);

        res.status(201).json({
            message: "Platillo creado correctamente",
            menuItem,
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const getMenuItems = async (req, res) => {
    try {
        const menuItems = await MenuItem.find({ isDeleted: { $ne: true } }).sort({ category: 1, name: 1 });

        res.json({
            message: "Catálogo del restaurante obtenido correctamente",
            menuItems,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const getMenuItemsByRestaurant = async (req, res) => {
    try {
        const menuItems = await MenuItem.find({ restaurant: req.params.restaurantId, isDeleted: { $ne: true } }).sort({ category: 1, name: 1 });
        res.json({
            message: "Platillos del restaurante obtenidos correctamente",
            menuItems,
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updateMenuItem = async (req, res) => {
    try {
        const payload = await buildMenuItemPayload(req.body, req.file);
        const menuItem = await MenuItem.findOneAndUpdate(
            { _id: req.params.id, isDeleted: { $ne: true } },
            payload,
            { new: true, runValidators: true },
        );
        if (!menuItem) {
            return res.status(404).json({ message: "Platillo no encontrado" });
        }
        res.json({
            message: "Platillo actualizado correctamente",
            menuItem,
        });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const deleteMenuItem = async (req, res) => {
    try {
        const menuItem = await MenuItem.findOneAndUpdate(
            { _id: req.params.id, isDeleted: { $ne: true } },
            { isDeleted: true },
            { new: true },
        );
        if (!menuItem) {
            return res.status(404).json({ message: "Platillo no encontrado" });
        }
        res.json({ message: "Platillo desactivado correctamente", menuItem });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

