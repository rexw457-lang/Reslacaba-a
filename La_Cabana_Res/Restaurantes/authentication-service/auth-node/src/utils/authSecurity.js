import crypto from "crypto";

const DEFAULT_DEV_JWT_SECRET = "dev-only-change-me-los-rubios-rojos";

export const normalizeEmail = (email = "") => email.toLowerCase().trim();

export const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export const validatePassword = (password = "") => {
  if (password.length < 8) {
    return "La contrasena debe tener al menos 8 caracteres";
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    return "La contrasena debe incluir mayusculas, minusculas y numeros";
  }

  return null;
};

export const createRawToken = () => crypto.randomBytes(32).toString("hex");

export const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

export const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET || process.env.JWT_KEY;

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is required in production");
  }

  return DEFAULT_DEV_JWT_SECRET;
};

export const getJwtOptions = () => {
  const options = {
    expiresIn: process.env.JWT_EXPIRES_IN || "60m"
  };

  if (process.env.JWT_ISSUER) options.issuer = process.env.JWT_ISSUER;
  if (process.env.JWT_AUDIENCE) options.audience = process.env.JWT_AUDIENCE;

  return options;
};

export const getJwtVerifyOptions = () => {
  const options = {};

  if (process.env.JWT_ISSUER) options.issuer = process.env.JWT_ISSUER;
  if (process.env.JWT_AUDIENCE) options.audience = process.env.JWT_AUDIENCE;

  return options;
};
