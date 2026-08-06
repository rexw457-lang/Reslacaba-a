import jwt from "jsonwebtoken";
import { normalizeRoleName } from "../utils/roles.js";
import { getJwtSecret, getJwtVerifyOptions } from "../utils/authSecurity.js";

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, message: "Token requerido" });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ success: false, message: "Token mal formado" });
  }

  try {
    req.user = jwt.verify(token, getJwtSecret(), getJwtVerifyOptions());
    return next();
  } catch (error) {
    const expired = error.name === "TokenExpiredError";
    return res.status(expired ? 401 : 403).json({
      success: false,
      message: "Token invalido",
      error: expired ? "TOKEN_EXPIRED" : "TOKEN_INVALID"
    });
  }
};

export const verifyRole = (roleOrRoles) => {
  return (req, res, next) => {
    const requiredRoles = Array.isArray(roleOrRoles)
      ? roleOrRoles.map((role) => normalizeRoleName(role)).filter(Boolean)
      : [normalizeRoleName(roleOrRoles)].filter(Boolean);

    const userRole = normalizeRoleName(req.user?.role);

    if (!requiredRoles.length || !userRole || !requiredRoles.includes(userRole)) {
      return res.status(403).json({ success: false, message: "No autorizado" });
    }

    return next();
  };
};
