import { Router } from "express";
import { verifyToken, verifyRole } from "../middleware/auth.middleware.js";
import { ROLE_ADMIN } from "../utils/roles.js";
import { createUser, getUsers, promoteToAdmin } from "../controllers/user.controller.js";

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: Gestión de usuarios
 */

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Crear un nuevo usuario
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: juan123
 *               email:
 *                 type: string
 *                 example: juan@gmail.com
 *               password:
 *                 type: string
 *                 example: 123456
 *               role:
 *                 type: string
 *                 example: admin
 *               secretKey:
 *                 type: string
 *                 example: string
 *                 description: Requerida sólo si el rol es admin. Si es cliente, se ignora.
 *     responses:
 *       201:
 *         description: Usuario creado correctamente
 *       400:
 *         description: Datos inválidos
 *       500:
 *         description: Error del servidor
 */
router.post("/", verifyToken, verifyRole(ROLE_ADMIN), createUser);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Obtener todos los usuarios
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   _id:
 *                     type: string
 *                   username:
 *                     type: string
 *                     example: juan123
 *                   email:
 *                     type: string
 *                     example: juan@gmail.com
 *                   role:
 *                     type: string
 *       500:
 *         description: Error del servidor
 */
router.get("/", verifyToken, verifyRole(ROLE_ADMIN), getUsers);

/**
 * @swagger
 * /users/{id}/promote:
 *   patch:
 *     summary: Promover un usuario a admin
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del usuario a promocionar
 *     responses:
 *       200:
 *         description: Usuario promovido a admin correctamente
 *       404:
 *         description: Usuario no encontrado
 *       403:
 *         description: No autorizado
 */
router.patch("/:id/promote", verifyToken, verifyRole(ROLE_ADMIN), promoteToAdmin);

export default router;