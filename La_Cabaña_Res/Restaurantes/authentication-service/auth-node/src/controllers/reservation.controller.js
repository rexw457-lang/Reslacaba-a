import Reservation from "../models/Reservation.js";
import Restaurant from "../models/Restaurant.js";
import Table from "../models/Table.js";

const minutesFromTime = (value) => {
    const [hours, minutes] = String(value || "").split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
    return hours * 60 + minutes;
};

const isReservationInsideOpeningHours = (reservationDate, openingHours) => {
    if (!openingHours) return true;

    const [open = "", close = ""] = openingHours.split("-").map((value) => value.trim());
    const openMinutes = minutesFromTime(open);
    const closeMinutes = minutesFromTime(close);
    const reservationMinutes = reservationDate.getHours() * 60 + reservationDate.getMinutes();

    if (openMinutes === null || closeMinutes === null) return true;
    return reservationMinutes >= openMinutes && reservationMinutes < closeMinutes;
};

export const createReservation = async (req, res) => {
    try {
        const {
            customerName,
            reservationDate,
            restaurant,
            table,
            numberOfGuests
        } = req.body;

        if (!customerName || !reservationDate || !restaurant) {
            return res.status(400).json({
                message: "Nombre, fecha y restaurante son obligatorios"
            });
        }

        const existingRestaurant = await Restaurant.findById(restaurant);
        if (!existingRestaurant) {
            return res.status(404).json({
                message: "El restaurante no existe"
            });
        }

        const parsedReservationDate = new Date(reservationDate);
        if (Number.isNaN(parsedReservationDate.getTime())) {
            return res.status(400).json({ message: "Fecha de reservacion invalida" });
        }

        if (!isReservationInsideOpeningHours(parsedReservationDate, existingRestaurant.openingHours)) {
            return res.status(400).json({
                message: `La hora debe estar dentro del horario del restaurante: ${existingRestaurant.openingHours}`
            });
        }

        const guests = Number(numberOfGuests) || 1;
        const existingTable = table
            ? await Table.findById(table)
            : await Table.findOne({
                restaurant,
                status: "disponible",
                capacity: { $gte: guests }
            }).sort({ capacity: 1, number: 1 });

        if (!existingTable || existingTable.restaurant.toString() !== restaurant) {
            return res.status(404).json({
                message: "No hay una mesa disponible para ese restaurante y cantidad de personas"
            });
        }

        if (existingTable.status === "no disponible") {
            return res.status(400).json({
                message: "La mesa no está disponible"
            });
        }

        const reservation = await Reservation.create({
            ...req.body,
            table: existingTable._id,
            numberOfGuests: guests,
            reservationDate: parsedReservationDate
        });

        // Cambiar status de la mesa a no disponible
        await Table.findByIdAndUpdate(existingTable._id, { status: "no disponible" });

        const populatedReservation = await Reservation.findById(reservation._id)
            .populate("table")
            .populate("restaurant");

        res.status(201).json(populatedReservation);

    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

export const getReservations = async (req, res) => {
    const reservations = await Reservation.find({ isDeleted: false })
        .populate({
            path: "restaurant",
            match: { isDeleted: false }
        })
        .populate("table");

    res.json(reservations);
};

export const deleteReservation = async (req, res) => {
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation) {
        return res.status(404).json({ message: "Reserva no encontrada" });
    }

    // Cambiar status de la mesa a disponible
    await Table.findByIdAndUpdate(reservation.table, { status: "disponible" });

    await Reservation.findByIdAndUpdate(req.params.id, {
        isDeleted: true
    });

    res.json({ message: "Reserva eliminada (soft delete)" });
};

