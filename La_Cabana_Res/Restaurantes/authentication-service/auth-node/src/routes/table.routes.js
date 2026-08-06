import express from "express";
import * as controller from "../controllers/tableController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Tables
 *   description: Gestión de mesas del restaurante
 */

/**
 * @swagger
 * /tables:
 *   post:
 *     summary: Crear una nueva mesa
 *     tags: [Tables]
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
 *                 example: 5
 *               capacity:
 *                 type: number
 *                 example: 4
 *               status:
 *                 type: string
 *                 example: disponible
 *     responses:
 *       201:
 *         description: Mesa creada correctamente
 *       400:
 *         description: Datos inválidos
 *       500:
 *         description: Error del servidor
 */
router.post("/", controller.createTable);

/**
 * @swagger
 * /tables:
 *   get:
 *     summary: Obtener todas las mesas
 *     tags: [Tables]
 *     responses:
 *       200:
 *         description: Lista de mesas
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   number:
 *                     type: number
 *                     example: 5
 *                   capacity:
 *                     type: number
 *                     example: 4
 *                   status:
 *                     type: string
 *                     example: disponible
 *       500:
 *         description: Error del servidor
 */
router.get("/", controller.getTables);

router.put("/:id", controller.updateTable);

router.delete("/:id", controller.deleteTable);

export default router;
