import { Router } from "express";
import { createRole, getRoles } from "../controllers/role.controller.js";
import { verifyRole, verifyToken } from "../middleware/auth.middleware.js";
import { ROLE_ADMIN } from "../utils/roles.js";

const router = Router();

router.post("/", verifyToken, verifyRole(ROLE_ADMIN), createRole);
router.get("/", verifyToken, verifyRole(ROLE_ADMIN), getRoles);

export default router;
