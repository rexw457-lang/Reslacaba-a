import express from "express";
import {
    createMenuItem,
    getMenuItems,
    getMenuItemsByRestaurant,
    updateMenuItem,
    deleteMenuItem
} from "../controllers/menuItem.controller.js";
import { verifyToken, verifyRole } from "../middleware/auth.middleware.js";
import upload from "../middleware/upload.js";
import { ROLE_ADMIN } from "../utils/roles.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: MenuItems
 *   description: Gestión del menú del restaurante
 */

/**
 * @swagger
 * /menu-items:
 *   post:
 *     summary: Crear un nuevo platillo
 *     tags: [MenuItems]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *               - restaurant
 *             properties:
 *               name:
 *                 type: string
 *                 example: Hamburguesa Clásica
 *               description:
 *                 type: string
 *                 example: Hamburguesa con carne molida, queso y vegetales
 *               price:
 *                 type: number
 *                 example: 45.50
 *               category:
 *                 type: string
 *                 example: Carnes
 *               restaurant:
 *                 type: string
 *                 example: 64f123abc
 *                 description: ID del restaurante
 *     responses:
 *       201:
 *         description: Platillo creado correctamente
 *       400:
 *         description: Datos inválidos
 *       404:
 *         description: El restaurante no existe
 *       500:
 *         description: Error del servidor
 */
router.post("/", verifyToken, upload.single("image"), createMenuItem);

/**
 * @swagger
 * /menu-items:
 *   get:
 *     summary: Obtener todos los platillos
 *     tags: [MenuItems]
 *     responses:
 *       200:
 *         description: Lista de platillos
 *       500:
 *         description: Error del servidor
 */
router.get("/", getMenuItems);

/**
 * @swagger
 * /menu-items/restaurant/{restaurantId}:
 *   get:
 *     summary: Obtener platillos de un restaurante
 *     tags: [MenuItems]
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del restaurante
 *     responses:
 *       200:
 *         description: Platillos del restaurante
 *       500:
 *         description: Error del servidor
 */
router.get("/restaurant/:restaurantId", getMenuItemsByRestaurant);

/**
 * @swagger
 * /menu-items/{id}:
 *   put:
 *     summary: Actualizar un platillo
 *     tags: [MenuItems]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               category:
 *                 type: string
 *     responses:
 *       200:
 *         description: Platillo actualizado correctamente
 *       404:
 *         description: Platillo no encontrado
 *       400:
 *         description: Datos inválidos
 */
router.put("/:id", verifyToken, upload.single("image"), updateMenuItem);

/**
 * @swagger
 * /menu-items/{id}:
 *   delete:
 *     summary: Eliminar un platillo
 *     tags: [MenuItems]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Platillo eliminado correctamente
 *       404:
 *         description: Platillo no encontrado
 *       500:
 *         description: Error del servidor
 */
router.delete("/:id", verifyToken, deleteMenuItem);

export default router;
