import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Role from "../models/Role.js";
import { sendVerificationEmail } from "../services/email.service.js";
import { normalizeRoleName, ROLE_ADMIN, ROLE_COCINA, ROLE_RECEPCION } from "../utils/roles.js";
import {
  createRawToken,
  getJwtOptions,
  getJwtSecret,
  hashToken,
  normalizeEmail,
  validateEmail,
  validatePassword
} from "../utils/authSecurity.js";

export const register = async (req, res) => {
  return res.status(403).json({
    success: false,
    message: "El registro de usuarios está deshabilitado. Usa las credenciales internas asignadas al restaurante."
  });
};

export const verifyEmail = async (req, res) => {
  try {
    const token = req.query.token || req.body.token;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token de verificacion requerido"
      });
    }

    const tokenHash = hashToken(token);
    const user = await User.findOne({
      verificationToken: { $in: [tokenHash, token] },
      verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Token invalido o expirado"
      });
    }

    user.verified = true;
    user.verificationToken = null;
    user.verificationTokenExpires = null;
    await user.save();

    return res.json({
      success: true,
      message: "Correo verificado correctamente. Ya puedes iniciar sesion."
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Error interno al verificar el correo"
    });
  }
};

export const resendVerification = async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.body.email);

    if (!normalizedEmail || !validateEmail(normalizedEmail)) {
      return res.status(400).json({
        success: false,
        message: "Correo electronico valido requerido"
      });
    }

    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "No existe ninguna cuenta con ese correo"
      });
    }

    if (user.verified) {
      return res.status(400).json({
        success: false,
        message: "La cuenta ya esta verificada"
      });
    }

    const verificationToken = createRawToken();
    user.verificationToken = hashToken(verificationToken);
    user.verificationTokenExpires = Date.now() + 60 * 60 * 1000;
    await user.save();

    await sendVerificationEmail(user, verificationToken);

    return res.json({
      success: true,
      message: "Se ha reenviado el correo de verificacion"
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Error interno al reenviar el correo"
    });
  }
};

export const activateAdminRole = async (req, res) => {
  try {
    const token = req.query.token || req.body.token;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token de activacion admin requerido"
      });
    }

    const tokenHash = hashToken(token);
    const user = await User.findOne({
      adminActivationToken: { $in: [tokenHash, token] },
      adminActivationTokenExpires: { $gt: Date.now() }
    }).populate("role");

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Token de activacion admin invalido o expirado"
      });
    }

    if (!user.verified) {
      return res.status(400).json({
        success: false,
        message: "Debes verificar tu correo antes de activar el rol admin"
      });
    }

    const role = await Role.findOneAndUpdate(
      { name: ROLE_ADMIN },
      { name: ROLE_ADMIN },
      { new: true, upsert: true }
    );

    user.role = role._id;
    user.adminActivationToken = null;
    user.adminActivationTokenExpires = null;
    user.adminActivationRequestedAt = null;
    user.adminActivationRequestedBy = null;
    await user.save();

    return res.json({
      success: true,
      message: "Rol admin activado correctamente. Inicia sesion nuevamente para obtener tus permisos."
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Error interno al activar el rol admin"
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email y contrasena son requeridos"
      });
    }

    const user = await User.findOne({ email: normalizeEmail(email) }).populate("role");
    if (!user) {
      return res.status(401).json({ success: false, message: "Credenciales invalidas" });
    }

    if (user.isLocked()) {
      return res.status(429).json({
        success: false,
        message: "Muchos intentos fallidos. Intenta nuevamente mas tarde."
      });
    }

    const validPassword = await user.comparePassword(password);
    if (!validPassword) {
      await user.incrementLoginAttempts();
      return res.status(401).json({ success: false, message: "Credenciales invalidas" });
    }

    if (!user.verified) {
      return res.status(403).json({
        success: false,
        message: "La cuenta no esta verificada. Revisa tu correo para activar tu usuario.",
        emailVerificationRequired: true
      });
    }

    await user.resetLoginAttempts();

    const roleName = normalizeRoleName(user.role?.name) || ROLE_ADMIN;
    const token = jwt.sign(
      {
        sub: user._id.toString(),
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: roleName,
        verified: user.verified
      },
      getJwtSecret(),
      getJwtOptions()
    );

    return res.json({ success: true, message: "Login exitoso", token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Error interno al iniciar sesion"
    });
  }
};

export const me = async (req, res) => {
  try {
    const user = await User.findById(req.user?.id || req.user?.sub)
      .select(
        "-password -verificationToken -verificationTokenExpires -adminActivationToken -adminActivationTokenExpires -loginAttempts -lockUntil"
      )
      .populate("role");

    if (!user || !user.verified) {
      return res.status(401).json({
        success: false,
        message: "Sesion invalida"
      });
    }

    return res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: normalizeRoleName(user.role?.name) || ROLE_ADMIN,
        verified: user.verified
      }
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Error interno al obtener la sesion"
    });
  }
};
