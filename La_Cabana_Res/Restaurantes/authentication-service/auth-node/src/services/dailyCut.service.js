import Order from "../models/Order.js";
import Table from "../models/Table.js";

// "Corte" diario: a las 00:00 todos los pedidos que sigan activos (ni Entregado
// ni Cancelado) se cierran como Entregado. El pedido conserva su createdAt, así
// que en el historial, los totales y el dashboard sigue contando en el día en
// que se emitió, no en el día en que se hizo el corte.

const DEFAULT_TIMEZONE = "America/Guatemala";
const FINISHED_STATUSES = ["Entregado", "Cancelado"];
const SAFETY_CHECK_MS = 10 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

// Se lee al usarse (no al importar) porque dotenv.config() se ejecuta en
// server.js después de que se evalúan los imports.
const getTimeZone = () => process.env.CUT_TIMEZONE || DEFAULT_TIMEZONE;

// Diferencia (ms) entre la hora de pared de la zona y UTC en el instante dado.
const getOffsetMs = (date, timeZone) => {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        second: "numeric",
    }).formatToParts(date);

    const v = {};
    for (const part of parts) {
        if (part.type !== "literal") v[part.type] = Number(part.value);
    }

    const wallAsUtc = Date.UTC(v.year, v.month - 1, v.day, v.hour, v.minute, v.second);
    return wallAsUtc - Math.floor(date.getTime() / 1000) * 1000;
};

// Instante (Date en UTC) en que empezó el día de `date` en la zona horaria.
export const startOfDay = (date = new Date(), timeZone = getTimeZone()) => {
    const offset = getOffsetMs(date, timeZone);
    const wall = new Date(date.getTime() + offset);
    const midnightWallAsUtc = Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate());

    // Segundo paso: el offset puede ser distinto a medianoche que ahora
    // (horario de verano). En Guatemala no hay, pero así sirve para cualquier zona.
    const guess = midnightWallAsUtc - offset;
    return new Date(midnightWallAsUtc - getOffsetMs(new Date(guess), timeZone));
};

// Próxima medianoche (inicio del día siguiente) a partir de `date`.
export const nextMidnight = (date = new Date(), timeZone = getTimeZone()) => {
    const today = startOfDay(date, timeZone);
    return startOfDay(new Date(today.getTime() + 36 * HOUR_MS), timeZone);
};

/**
 * Cierra como Entregado todo pedido activo creado antes del inicio del día
 * actual. Es idempotente: si no hay nada pendiente no hace nada.
 * Con { dryRun: true } solo devuelve los pedidos que se cerrarían.
 */
export const runDailyCut = async ({ now = new Date(), dryRun = false } = {}) => {
    const cutoff = startOfDay(now);
    const filter = {
        createdAt: { $lt: cutoff },
        status: { $nin: FINISHED_STATUSES },
    };

    const pending = await Order.find(filter).select("_id orderNumber table createdAt").lean();
    if (dryRun || pending.length === 0) {
        return { cutoff, closedCount: 0, orders: pending };
    }

    // No se toca createdAt (define el día del pedido) ni updatedAt
    // (timestamps: false); el momento real del corte queda en autoClosedAt.
    const result = await Order.updateMany(
        filter,
        {
            $set: {
                status: "Entregado",
                kitchenStatus: "Entregado",
                drinkStatus: "Entregado",
                "items.$[].delivered": true,
                autoClosedAt: now,
            },
        },
        { timestamps: false },
    );

    // Liberar las mesas de esos pedidos, salvo las que aún tengan otro pedido
    // activo. Las mesas desactivadas (isDeleted) no se reactivan.
    const tableIds = [...new Set(pending.filter((o) => o.table).map((o) => String(o.table)))];
    if (tableIds.length > 0) {
        const stillBusy = await Order.distinct("table", {
            table: { $in: tableIds },
            status: { $nin: FINISHED_STATUSES },
        });
        const busy = new Set(stillBusy.map(String));
        const freeIds = tableIds.filter((id) => !busy.has(id));

        if (freeIds.length > 0) {
            await Table.updateMany(
                { _id: { $in: freeIds }, isDeleted: { $ne: true } },
                { status: "disponible" },
            );
        }
    }

    return { cutoff, closedCount: result.modifiedCount ?? pending.length, orders: pending };
};

let midnightTimer = null;
let safetyTimer = null;
let queue = Promise.resolve();

const execute = async (reason) => {
    try {
        const { closedCount, cutoff } = await runDailyCut();
        if (closedCount > 0) {
            console.log(`[corte] (${reason}) ${closedCount} pedido(s) anteriores a ${cutoff.toISOString()} marcados como Entregado.`);
        }
    } catch (error) {
        console.error(`[corte] Error al ejecutar el corte diario (${reason}):`, error);
    }
};

// Los cortes se encadenan para que nunca corran dos a la vez.
const enqueue = (reason) => {
    queue = queue.then(() => execute(reason));
    return queue;
};

const scheduleMidnight = () => {
    // +1 s de margen para que `now` ya caiga dentro del día nuevo.
    const delay = Math.max(nextMidnight().getTime() - Date.now(), 0) + 1000;
    midnightTimer = setTimeout(async () => {
        await enqueue("00:00");
        scheduleMidnight();
    }, delay);
    midnightTimer.unref?.();
};

/**
 * Programa el corte diario. Se ejecuta:
 *  - al arrancar el servidor (por si estuvo apagado a medianoche),
 *  - exactamente a las 00:00 de la zona horaria configurada,
 *  - cada 10 min como red de seguridad (si el equipo se suspendió y el
 *    temporizador se atrasó). Es una consulta barata e idempotente.
 */
export const startDailyCutScheduler = () => {
    stopDailyCutScheduler();

    enqueue("arranque");
    scheduleMidnight();
    safetyTimer = setInterval(() => enqueue("revisión"), SAFETY_CHECK_MS);
    safetyTimer.unref?.();

    console.log(`[corte] Corte diario activo: 00:00 (${getTimeZone()}). Próximo: ${nextMidnight().toISOString()}`);
};

export const stopDailyCutScheduler = () => {
    if (midnightTimer) clearTimeout(midnightTimer);
    if (safetyTimer) clearInterval(safetyTimer);
    midnightTimer = null;
    safetyTimer = null;
};
