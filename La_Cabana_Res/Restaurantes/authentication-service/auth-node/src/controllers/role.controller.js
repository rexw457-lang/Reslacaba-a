import Role from "../models/Role.js";
import { normalizeRoleName } from "../utils/roles.js";

export const createRole = async (req, res) => {
  try {
    const roleName = normalizeRoleName(req.body.name);

    if (!roleName) {
      return res.status(400).json({
        message: "El rol solo puede ser cliente o admin"
      });
    }

    const existing = await Role.findOne({ name: roleName });
    if (existing) {
      return res.status(400).json({ message: "El rol ya existe" });
    }

    const role = new Role({ name: roleName });
    await role.save();

    return res.status(201).json(role);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error al crear el rol",
      error: error.message
    });
  }
};

export const getRoles = async (req, res) => {
  try {
    const roles = await Role.find().sort({ createdAt: -1 });
    return res.status(200).json(roles);
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Error al obtener roles",
      error: error.message
    });
  }
};
