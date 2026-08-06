import express from "express";
import { createReservation, getReservations, deleteReservation } from "../controllers/reservation.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";

const router = express.Router();

// GET /api/reservations — obtener todas (requiere token)
router.get("/", verifyToken, getReservations);

// POST /api/reservations — crear reservación (requiere token)
router.post("/", verifyToken, createReservation);

// DELETE /api/reservations/:id — cancelar (soft delete)
router.put("/:id/cancel", verifyToken, async (req, res) => {
    const { default: Reservation } = await import("../models/Reservation.js");
    const { default: Table } = await import("../models/Table.js");
    try {
        const reservation = await Reservation.findById(req.params.id);
        if (!reservation) return res.status(404).json({ message: "Reserva no encontrada" });
        await Table.findByIdAndUpdate(reservation.table, { status: "disponible" });
        const updated = await Reservation.findByIdAndUpdate(
            req.params.id,
            { isDeleted: true, status: "Cancelada" },
            { new: true }
        );
        res.json(updated);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

export default router;
