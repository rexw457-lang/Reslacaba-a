import express from "express";
import {
    createRestaurant,
    getRestaurants,
    getRestaurantById,
    updateRestaurant,
    deleteRestaurant
} from "../controllers/restaurant.controller.js";
import { createReservation } from "../controllers/reservation.controller.js";
import { createTable, deleteTable, getTables, updateTable } from "../controllers/tableController.js";
import Reservation from "../models/Reservation.js";
import Review from "../models/Review.js";
import { verifyToken, verifyRole } from "../middleware/auth.middleware.js";
import upload from "../middleware/upload.js";
import { ROLE_ADMIN } from "../utils/roles.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Restaurants
 *   description: Gestión de restaurantes
 */

/**
 * @swagger
 * /restaurants:
 *   post:
 *     summary: Crear un nuevo restaurante
 *     tags: [Restaurants]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - address
 *             properties:
 *               name:
 *                 type: string
 *                 example: Restaurante Centro
 *               address:
 *                 type: string
 *                 example: Avenida Principal 123
 *               phone:
 *                 type: string
 *                 example: +502 2345-6789
 *               email:
 *                 type: string
 *                 example: centro@restaurant.com
 *               city:
 *                 type: string
 *                 example: Guatemala
 *               manager:
 *                 type: string
 *                 example: Juan González
 *               capacity:
 *                 type: number
 *                 example: 50
 *               openingHours:
 *                 type: string
 *                 example: "10:00 - 22:00"
 *     responses:
 *       201:
 *         description: Restaurante creado correctamente
 *       400:
 *         description: Datos inválidos
 *       500:
 *         description: Error del servidor
 */
router.post("/", verifyToken, upload.single("image"), createRestaurant);

/**
 * @swagger
 * /restaurants:
 *   get:
 *     summary: Obtener todos los restaurantes
 *     tags: [Restaurants]
 *     responses:
 *       200:
 *         description: Lista de restaurantes
 *       500:
 *         description: Error del servidor
 */
router.get("/", getRestaurants);

/**
 * @swagger
 * /restaurants/{id}:
 *   get:
 *     summary: Obtener un restaurante por ID
 *     tags: [Restaurants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del restaurante
 *     responses:
 *       200:
 *         description: Restaurante encontrado
 *       404:
 *         description: Restaurante no encontrado
 *       500:
 *         description: Error del servidor
 */
router.get("/:id", getRestaurantById);

/**
 * @swagger
 * /restaurants/{id}:
 *   put:
 *     summary: Actualizar un restaurante
 *     tags: [Restaurants]
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
 *               address:
 *                 type: string
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *               manager:
 *                 type: string
 *               capacity:
 *                 type: number
 *     responses:
 *       200:
 *         description: Restaurante actualizado correctamente
 *       404:
 *         description: Restaurante no encontrado
 *       400:
 *         description: Datos inválidos
 */
router.put("/:id", verifyToken, upload.single("image"), updateRestaurant);

/**
 * @swagger
 * /restaurants/{id}:
 *   delete:
 *     summary: Eliminar un restaurante
 *     tags: [Restaurants]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Restaurante eliminado correctamente
 *       404:
 *         description: Restaurante no encontrado
 *       500:
 *         description: Error del servidor
 */
router.delete("/:id", verifyToken, deleteRestaurant);

/**
 * @swagger
 * /restaurants/{restaurantId}/tables:
 *   post:
 *     summary: Crear una nueva mesa en el restaurante
 *     tags: [Restaurants]
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - number
 *               - capacity
 *             properties:
 *               number:
 *                 type: number
 *                 example: 1
 *               capacity:
 *                 type: number
 *                 example: 4
 *     responses:
 *       201:
 *         description: Mesa creada correctamente
 *       400:
 *         description: Datos inválidos
 */
router.post("/:restaurantId/tables", verifyToken, async (req, res) => {
    req.body.restaurant = req.params.restaurantId;
    await createTable(req, res);
});

/**
 * @swagger
 * /restaurants/{restaurantId}/tables:
 *   get:
 *     summary: Obtener mesas del restaurante
 *     tags: [Restaurants]
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de mesas
 */
router.get("/:restaurantId/tables", async (req, res) => {
    req.query.restaurant = req.params.restaurantId;
    await getTables(req, res);
});

router.put("/:restaurantId/tables/:tableId", verifyToken, async (req, res) => {
    req.body.restaurant = req.params.restaurantId;
    await updateTable(req, res);
});

router.delete("/:restaurantId/tables/:tableId", verifyToken, async (req, res) => {
    await deleteTable(req, res);
});

/**
 * @swagger
 * /restaurants/{restaurantId}/reservations:
 *   post:
 *     summary: Crear una nueva reservación en el restaurante
 *     tags: [Restaurants]
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerName
 *               - reservationDate
 *               - table
 *             properties:
 *               customerName:
 *                 type: string
 *                 example: Juan Pérez
 *               customerPhone:
 *                 type: string
 *                 example: +502 1234-5678
 *               customerEmail:
 *                 type: string
 *                 example: juan@example.com
 *               reservationDate:
 *                 type: string
 *                 format: date-time
 *                 example: 2023-10-01T19:00:00Z
 *               numberOfGuests:
 *                 type: number
 *                 example: 4
 *               table:
 *                 type: string
 *                 example: 64f1b2c3d4e5f6789abc123
 *     responses:
 *       201:
 *         description: Reservación creada correctamente
 *       400:
 *         description: Datos inválidos
 */
router.post("/:restaurantId/reservations", verifyToken, async (req, res) => {
    req.body.restaurant = req.params.restaurantId;
    await createReservation(req, res);
});

/**
 * @swagger
 * /restaurants/{restaurantId}/reservations:
 *   get:
 *     summary: Obtener reservaciones del restaurante
 *     tags: [Restaurants]
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de reservaciones
 */
router.get("/:restaurantId/reservations", async (req, res) => {
    const reservations = await Reservation.find({ restaurant: req.params.restaurantId, isDeleted: false })
        .populate("table")
        .populate("restaurant");
    res.json(reservations);
});

/**
 * @swagger
 * /restaurants/{restaurantId}/reviews:
 *   post:
 *     summary: Crear una nueva reseña para el restaurante
 *     tags: [Restaurants]
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rating
 *             properties:
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 5
 *               comment:
 *                 type: string
 *                 example: Excelente servicio
 *     responses:
 *       201:
 *         description: Reseña creada correctamente
 *       400:
 *         description: Datos inválidos
 */
router.post("/:restaurantId/reviews", verifyToken, async (req, res) => {
    try {
        const rating = Number(req.body.rating);

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ message: "La calificacion debe estar entre 1 y 5" });
        }

        const review = await Review.create({
            ...req.body,
            rating,
            restaurant: req.params.restaurantId,
            customerName: req.body.customerName || req.user?.username,
            customerEmail: req.body.customerEmail || req.user?.email
        });
        res.status(201).json(review);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

/**
 * @swagger
 * /restaurants/{restaurantId}/reviews:
 *   get:
 *     summary: Obtener reseñas del restaurante
 *     tags: [Restaurants]
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de reseñas
 */
router.get("/:restaurantId/reviews", async (req, res) => {
    const reviews = await Review.find({ restaurant: req.params.restaurantId });
    res.json(reviews);
});

export default router;
