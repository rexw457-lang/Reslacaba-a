import express from "express";
import * as controller from "../controllers/orderController.js";
import { verifyToken, verifyRole } from "../middleware/auth.middleware.js";
import { ROLE_ADMIN, ROLE_COCINA, ROLE_RECEPCION } from "../utils/roles.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Orders
 *   description: Gestión interna de pedidos del restaurante
 */

/**
 * @swagger
 * /orders:
 *   post:
 *     summary: Crear un nuevo pedido interno
 *     tags: [Orders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *             properties:
 *               table:
 *                 type: string
 *                 example: 64f123abc
 *               observations:
 *                 type: string
 *                 example: Sin cebolla
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - menuItem
 *                     - quantity
 *                   properties:
 *                     menuItem:
 *                       type: string
 *                       example: 64f456def
 *                     quantity:
 *                       type: number
 *                       example: 2
 *                     observations:
 *                       type: string
 *                       example: Poco picante
 *     responses:
 *       201:
 *         description: Pedido creado correctamente
 *       400:
 *         description: Datos inválidos
 *       500:
 *         description: Error del servidor
 */
router.post("/", verifyToken, controller.createOrder);

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: Obtener pedidos activos y en historial
 *     tags: [Orders]
 *     responses:
 *       200:
 *         description: Lista de pedidos
 */
router.get("/", verifyToken, controller.getOrders);

/**
 * @swagger
 * /orders/history:
 *   get:
 *     summary: Obtener historial de pedidos filtrado por estado
 *     tags: [Orders]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [Pendiente, Preparando, Entregado, Cancelado]
 *     responses:
 *       200:
 *         description: Historial de pedidos
 */
router.get("/history", verifyToken, controller.getOrderHistory);

/**
 * @swagger
 * /orders/{id}:
 *   get:
 *     summary: Obtener un pedido por ID
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Pedido encontrado
 */
router.get("/:id", verifyToken, controller.getOrderById);

/**
 * @swagger
 * /orders/{id}/part-status:
 *   patch:
 *     summary: Actualizar el estado de una sección del pedido (bebidas o cocina)
 *     tags: [Orders]
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
 *             required:
 *               - section
 *               - status
 *             properties:
 *               section:
 *                 type: string
 *                 example: drink
 *               status:
 *                 type: string
 *                 example: Preparando
 *     responses:
 *       200:
 *         description: Estado de sección actualizado correctamente
 *       404:
 *         description: Pedido no encontrado
 */
router.patch('/:id/part-status', verifyToken, verifyRole([ROLE_ADMIN, ROLE_COCINA, ROLE_RECEPCION]), controller.updatePartStatus);

/**
 * @swagger
 * /orders/{id}/status:
 *   patch:
 *     summary: Actualizar el estado de un pedido
 *     tags: [Orders]
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 example: Preparando
 *     responses:
 *       200:
 *         description: Estado actualizado correctamente
 *       404:
 *         description: Pedido no encontrado
 */
router.patch('/:id/status', verifyToken, verifyRole([ROLE_ADMIN, ROLE_COCINA, ROLE_RECEPCION]), controller.updateStatus);
router.put('/:id/status', verifyToken, verifyRole([ROLE_ADMIN, ROLE_COCINA, ROLE_RECEPCION]), controller.updateStatus);
// Actualizar items del pedido (cantidad, observaciones, añadir/quitar items)
router.patch('/:id/items', verifyToken, verifyRole([ROLE_ADMIN, ROLE_RECEPCION]), controller.updateOrderItems);

export default router;