export const ROLE_ADMIN = "ADMIN";
export const ROLE_COCINA = "COCINA";
export const ROLE_RECEPCION = "RECEPCION";

export const normalizeRoleName = (value) => {
    if (!value || typeof value !== "string") {
        return null;
    }

    const normalized = value.trim().toLowerCase();

    if (normalized === "admin" || normalized === "adminrestaurante" || normalized === "super_admin") {
        return ROLE_ADMIN;
    }

    if (normalized === "cocina" || normalized === "kitchen") {
        return ROLE_COCINA;
    }

    if (normalized === "recepcion" || normalized === "recepcionista" || normalized === "frontdesk") {
        return ROLE_RECEPCION;
    }

    return null;
};
