import express from "express";
import { activateAdminRole, register, login, verifyEmail, resendVerification, me } from "../controllers/auth.controller.js";
import { verifyToken, verifyRole } from "../middleware/auth.middleware.js";
import { rateLimit } from "../middleware/rateLimit.middleware.js";
import { ROLE_ADMIN } from "../utils/roles.js";
import { getUsers } from "../controllers/user.controller.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Auth
 *   description: AutenticaciÃ³n de usuarios
 */

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Registrar un nuevo usuario
 *     tags: [Auth]
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
 *                 example: cliente
 *               secretKey:
 *                 type: string
 *                 example: string
 *                 description: Requerida sÃ³lo si el rol es admin. Para cliente se ignora.
 *     responses:
 *       201:
 *         description: Usuario registrado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Datos invÃ¡lidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 */
router.post("/register", rateLimit({ scope: "auth-register", max: 8, windowMs: 60 * 60 * 1000 }), register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Iniciar sesiÃ³n
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: juan@gmail.com
 *               password:
 *                 type: string
 *                 example: 123456
 *             description: Proporciona email junto con la contraseÃ±a.
 *     responses:
 *       200:
 *         description: Login exitoso (retorna token JWT)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Credenciales incorrectas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 */
router.post("/login", rateLimit({ scope: "auth-login", max: 10, windowMs: 15 * 60 * 1000 }), login);
router.post("/verify-email", rateLimit({ scope: "auth-verify", max: 20, windowMs: 15 * 60 * 1000 }), verifyEmail);
router.post("/resend-verification", rateLimit({ scope: "auth-resend", max: 4, windowMs: 60 * 60 * 1000 }), resendVerification);
router.post("/activate-admin", rateLimit({ scope: "auth-admin-activate", max: 10, windowMs: 15 * 60 * 1000 }), activateAdminRole);
router.get("/users", verifyToken, verifyRole(ROLE_ADMIN), getUsers);
router.get("/me", verifyToken, me);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Obtener informaciÃ³n del usuario autenticado
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usuario autenticado correctamente
 *       401:
 *         description: Token invÃ¡lido o no proporcionado
 */


export default router;

