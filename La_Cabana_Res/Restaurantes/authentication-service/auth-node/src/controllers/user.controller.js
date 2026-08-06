import User from "../models/User.js";
import Role from "../models/Role.js";
import { sendAdminActivationEmail, sendVerificationEmail } from "../services/email.service.js";
import { normalizeRoleName, ROLE_ADMIN, ROLE_RECEPCION } from "../utils/roles.js";
import {
  createRawToken,
  hashToken,
  normalizeEmail,
  validateEmail,
  validatePassword
} from "../utils/authSecurity.js";

const publicUser = (user, roleName) => ({
  _id: user._id,
  id: user._id,
  username: user.username,
  email: user.email,
  verified: user.verified,
  emailConfirmed: user.verified,
  role: roleName
});

export const createUser = async (req, res) => {
  try {
    const { username, email, password, role } = req.body;
    const normalizedUsername = username?.trim();
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedUsername || !normalizedEmail || !password) {
      return res.status(400).json({
        message: "Username, correo y contrasena son obligatorios"
      });
    }

    if (normalizedUsername.length < 3) {
      return res.status(400).json({
        message: "El username debe tener al menos 3 caracteres"
      });
    }

    if (!validateEmail(normalizedEmail)) {
      return res.status(400).json({
        message: "El formato del correo electronico no es valido"
      });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ message: passwordError });
    }

    const requestedRoleName = normalizeRoleName(role || ROLE_RECEPCION);
    if (!requestedRoleName) {
      return res.status(400).json({ message: "El rol solo puede ser admin, cocina o recepcion" });
    }

    const roleName = requestedRoleName;

    const userExists = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }]
    });

    if (userExists) {
      return res.status(400).json({ message: "El usuario ya existe" });
    }

    const roleDocument = await Role.findOneAndUpdate(
      { name: roleName },
      { name: roleName },
      { new: true, upsert: true }
    );

    const verificationToken = createRawToken();
    const user = new User({
      username: normalizedUsername,
      email: normalizedEmail,
      password,
      role: roleDocument._id,
      verified: false,
      verificationToken: hashToken(verificationToken),
      verificationTokenExpires: Date.now() + 60 * 60 * 1000
    });

    await user.save();
    await sendVerificationEmail(user, verificationToken);

    if (requestedRoleName === ROLE_ADMIN) {
      const activationToken = createRawToken();
      user.adminActivationToken = hashToken(activationToken);
      user.adminActivationTokenExpires = Date.now() + 30 * 60 * 1000;
      user.adminActivationRequestedAt = Date.now();
      user.adminActivationRequestedBy = req.user?.id || req.user?.sub || null;
      await user.save();
      await sendAdminActivationEmail(user, activationToken);
    }

    return res.status(201).json({
      message:
        requestedRoleName === ROLE_ADMIN
          ? "Usuario creado correctamente. El usuario debe verificar su correo y activar el rol admin desde el enlace enviado."
          : "Usuario creado correctamente. El usuario debe verificar su correo.",
      user: publicUser(user, roleDocument.name)
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error al crear usuario",
      error: error.message
    });
  }
};

export const getUsers = async (req, res) => {
  try {
    const users = await User.find().populate("role").sort({ createdAt: -1 });

    return res.status(200).json({
      message: "Usuarios obtenidos correctamente",
      users: users.map((user) => publicUser(user, user.role?.name || null))
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error al obtener usuarios",
      error: error.message
    });
  }
};

export const promoteToAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).populate("role");

    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    if (!user.verified) {
      return res.status(400).json({
        message: "El usuario debe verificar su correo antes de ser admin"
      });
    }

    if (normalizeRoleName(user.role?.name) === ROLE_ADMIN) {
      return res.status(200).json({
        message: "El usuario ya es admin",
        user: publicUser(user, ROLE_ADMIN)
      });
    }

    const activationToken = createRawToken();
    user.adminActivationToken = hashToken(activationToken);
    user.adminActivationTokenExpires = Date.now() + 30 * 60 * 1000;
    user.adminActivationRequestedAt = Date.now();
    user.adminActivationRequestedBy = req.user?.id || req.user?.sub || null;
    await user.save();
    await sendAdminActivationEmail(user, activationToken);

    return res.status(200).json({
      message: "Solicitud enviada. El usuario debe activar el rol admin desde el enlace enviado a su correo.",
      adminActivationRequired: true,
      user: publicUser(user, normalizeRoleName(user.role?.name) || ROLE_RECEPCION)
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error al promover usuario",
      error: error.message
    });
  }
};
