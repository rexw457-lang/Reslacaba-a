import Order from "../models/Order.js";
import MenuItem from "../models/MenuItem.js";
import Table from "../models/Table.js";

const BEVERAGE_CATEGORY_KEYWORDS = ["bebidas", "postres"];
const BEVERAGE_NAME_KEYWORDS = ["tortilla", "tortillas", "tostada", "tostadas"];
// Cantidad de tortillas que trae cada plato fuerte. Por defecto son 5;
// pechugas, alitas y carne a la plancha llevan solo 4. Si en el futuro se agrega otro platillo
// con una cantidad distinta, solo hay que sumarlo aquí.
const FOUR_TORTILLAS_KEYWORDS = ["pechuga", "alita", "carne a la plancha", "caldito de camarones"]; // "alita" cubre "Alitas ..." también
const DEFAULT_TORTILLAS_PER_MAIN_COURSE = 5;
const REDUCED_TORTILLAS_PER_MAIN_COURSE = 4;

const normalizeStatus = (status) => {
    if (!status) return "Pendiente";
    const value = String(status).trim().toLowerCase();

    if (value === "pendiente") return "Pendiente";
    if (["preparando", "preparacion", "preparación"].includes(value)) return "Preparando";
    if (["entregado", "completado", "completada"].includes(value)) return "Entregado";
    if (["cancelado", "cancelada"].includes(value)) return "Cancelado";

    return null;
};

const normalizePartSection = (section) => {
    if (!section) return null;
    const value = String(section).trim().toLowerCase();
    if (value === "drink" || value === "drinks" || value === "bebidas") return "drink";
    if (value === "kitchen" || value === "cocina") return "kitchen";
    return null;
};

const isDrinkItemFromMenu = (menuItem) => {
    if (!menuItem) return false;
    const category = String(menuItem.category || "").toLowerCase();
    const name = String(menuItem.name || "").toLowerCase();

    return BEVERAGE_CATEGORY_KEYWORDS.some((keyword) => category.includes(keyword)) ||
        BEVERAGE_NAME_KEYWORDS.some((keyword) => name.includes(keyword));
};

const isIncludedFreeItem = (item) => {
    if (!item) return false;
    const label = String(item?.label || "").toLowerCase();
    return item?.isIncluded || (Number(item?.price || 0) === 0 && (label.includes("tortilla") || label.includes("tostada")));
};

const isDrinkOrderItem = (item) => {
    if (!item) return false;
    if (item.isIncluded) return !Boolean(item.hideInBebidas);
    if (item.isDrinkItem) return true;
    const label = String(item?.label || "").toLowerCase();
    if (item?.menuItem && (label.includes("tortilla") || label.includes("tostada"))) return true;
    return isDrinkItemFromMenu(item.menuItem);
};

const isMainCourseItem = (menuItem) => {
    if (!menuItem) return false;
    const category = String(menuItem.category || "").toLowerCase();
    const name = String(menuItem.name || "").toLowerCase();
    // Los ceviches son "Platos Fuertes" en la categoría, pero llevan tostadas
    // en vez de tortillas, así que se excluyen de aquí para no generarles
    // también tortillas. La comanda de cocina ya no agrega un ítem aparte
    // de "tostadas": con ver "Ceviche" en el nombre del platillo, cocina ya
    // sabe que debe servirlo con tostadas.
    return category.includes("platos fuertes") && !name.includes("ceviche");
};

// Pechugas, alitas y carne a la plancha llevan 4 tortillas; el resto de platos fuertes (caldos,
// camarones, mojarras, costillas, mar y tierra, etc.) llevan 5.
const getTortillasPerMainCourse = (name) => {
    const lowerName = String(name || "").toLowerCase();
    if (FOUR_TORTILLAS_KEYWORDS.some((keyword) => lowerName.includes(keyword))) {
        return REDUCED_TORTILLAS_PER_MAIN_COURSE;
    }
    return DEFAULT_TORTILLAS_PER_MAIN_COURSE;
};

const ensureIncludedFreeItemsForOrder = ({ items, existingDeliveredIncludedItems = [] }) => {
    const preservedLabels = new Set(existingDeliveredIncludedItems.map((it) => it.label));

    const preserved = existingDeliveredIncludedItems.map((it) => ({
        label: it.label,
        quantity: it.quantity,
        price: it.price,
        observations: it.observations || "",
        delivered: true,
        isIncluded: true,
        hideInBebidas: Boolean(it.hideInBebidas),
    }));

    const includedItems = [...preserved];

    // En vez de un ítem "Tortillas para: <platillo>" por cada plato fuerte
    // distinto, se suman todas las tortillas de la orden en un solo ítem
    // "Tortillas" con la cantidad total. Sigue teniendo precio 0 (cortesía);
    // las tortillas extra (con precio) son un ítem aparte y no se tocan aquí.
    let totalTortillas = 0;
    items.forEach((it) => {
        const menuItem = it.menuItemDoc || it.menuItem;
        if (!isMainCourseItem(menuItem)) return;
        const label = String(menuItem.name || it.label || '').trim();
        if (!label) return;
        const tortillasPerUnit = getTortillasPerMainCourse(label);
        totalTortillas += Number(it.quantity || 1) * tortillasPerUnit;
    });

    const TORTILLAS_INCLUDED_LABEL = "Tortillas";
    if (totalTortillas > 0 && !preservedLabels.has(TORTILLAS_INCLUDED_LABEL)) {
        includedItems.push({
            label: TORTILLAS_INCLUDED_LABEL,
            quantity: totalTortillas,
            price: 0,
            observations: "",
            delivered: false,
            isIncluded: true,
            hideInBebidas: false,
        });
    }

    return includedItems;
};

const normalizeOrderResponse = (order) => {
    if (!order) return order;
    const response = order.toObject ? order.toObject() : { ...order };
    response.drinkStatus = normalizeStatus(response.drinkStatus) || "Pendiente";
    response.kitchenStatus = normalizeStatus(response.kitchenStatus) || "Pendiente";
    response.status = normalizeStatus(response.status) || "Pendiente";
    // Ensure legacy included items have hideInBebidas set correctly
    if (Array.isArray(response.items)) {
        response.items = response.items.map((it) => {
            const item = { ...it };
            if (item.isIncluded && item.hideInBebidas == null) {
                const label = String(item.label || '').toLowerCase();
                item.hideInBebidas = label.includes('tostada');
            }
            return item;
        });
    }
    return response;
};

const makeOrderNumber = () => `PED-${Date.now().toString().slice(-6)}`;
const populateOrder = (query) => query.populate({ path: "table", select: "number status name" }).populate({ path: "items.menuItem", select: "name category price image available" });

export const createOrder = async (req, res) => {
    try {
        const { table, items, observations, isToGo, waiter } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "Debe enviar al menos un platillo en el pedido." });
        }

        if (table) {
            const existingTable = await Table.findOne({ _id: table, isDeleted: { $ne: true } });
            if (!existingTable) {
                return res.status(404).json({ error: "Mesa no encontrada" });
            }
        }

        let total = 0;
        const detailedItems = await Promise.all(items.map(async (item) => {
            if (!item.menuItem || !Number.isFinite(Number(item.quantity)) || Number(item.quantity) < 1) {
                throw new Error("Cada platillo debe tener un ID válido y una cantidad mayor a cero.");
            }

            const menuItem = await MenuItem.findOne({ _id: item.menuItem, isDeleted: { $ne: true }, available: { $ne: false } });
            if (!menuItem) {
                throw new Error("Uno o más platillos no están disponibles en el catálogo.");
            }

            const quantity = Number(item.quantity);

            // Allow optional price override coming from client (manual cost entry)
            let priceToUse = menuItem.price;
            if (item.price !== undefined && item.price !== null && item.price !== '') {
                const parsed = Number(item.price);
                if (!Number.isFinite(parsed) || parsed < 0) {
                    throw new Error('Precio inválido para uno de los platillos.');
                }
                priceToUse = parsed;
            }

            const subtotal = priceToUse * quantity;
            total += subtotal;

            return {
                menuItem: menuItem._id,
                menuItemDoc: menuItem,
                quantity,
                price: priceToUse,
                observations: item.observations?.trim() || "",
                delivered: false,
                isDrinkItem: isDrinkOrderItem({ menuItem }),
            };
        }));

        const explicitOrderItems = detailedItems.map(({ menuItemDoc, ...item }) => item);
        const includedItems = ensureIncludedFreeItemsForOrder({ items: detailedItems });
        const orderItems = [...explicitOrderItems, ...includedItems];

        const hasDrinkPending = orderItems.some((item) => (item.isDrinkItem || isDrinkOrderItem(item)) && !item.delivered);
        const hasKitchenPending = orderItems.some((item) => !(item.isDrinkItem || isDrinkOrderItem(item)) && !item.delivered);

        const order = new Order({
            orderNumber: makeOrderNumber(),
            table: table || undefined,
            items: orderItems,
            observations: observations?.trim() || "",
            waiter: waiter?.trim() || "",
            isToGo: Boolean(isToGo),
            total,
            drinkStatus: hasDrinkPending ? "Pendiente" : "Entregado",
            kitchenStatus: hasKitchenPending ? "Pendiente" : "Entregado",
            status: "Pendiente",
        });

        await order.save();

        if (table) {
            await Table.findByIdAndUpdate(table, { status: "no disponible" });
        }

        const populatedOrder = await populateOrder(Order.findById(order._id)).exec();
        res.status(201).json(populatedOrder);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const updateStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const normalizedStatus = normalizeStatus(status);

        if (!normalizedStatus) {
            return res.status(400).json({ error: "Estado no válido. Usa: Pendiente, Preparando, Entregado o Cancelado." });
        }

        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ error: "Pedido no encontrado." });
        }

        // La parte de cocina y de bebidas ya no se controla desde aquí: el
        // botón de la vista Entregas es el único lugar donde se puede marcar
        // un pedido como "Entregado", sin exigir que kitchenStatus/drinkStatus
        // estén en "Entregado" primero (se asume que siempre están listas).
        const updated = await populateOrder(
            Order.findByIdAndUpdate(req.params.id, { status: normalizedStatus }, { new: true }),
        ).exec();

        res.json(normalizeOrderResponse(updated));
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const updatePartStatus = async (req, res) => {
    try {
        const { section, status } = req.body;
        const normalizedSection = normalizePartSection(section);
        const normalizedStatus = normalizeStatus(status);

        if (!normalizedSection) {
            return res.status(400).json({ error: "Sección inválida. Usa: drink o kitchen." });
        }

        if (!normalizedStatus || normalizedStatus === "Cancelado" || normalizedStatus === "Preparando") {
            return res.status(400).json({ error: "Estado no válido para la sección. Usa: Pendiente o Entregado." });
        }

        const field = normalizedSection === "drink" ? "drinkStatus" : "kitchenStatus";

        // Load order with items.menuItem to decide which items to mark delivered
        const orderDoc = await Order.findById(req.params.id).populate('items.menuItem');
        if (!orderDoc) {
            return res.status(404).json({ error: "Pedido no encontrado." });
        }

        orderDoc[field] = normalizedStatus;


        if (normalizedStatus === 'Entregado') {
            // Mark corresponding items as delivered
            orderDoc.items.forEach((it) => {
                const drink = isDrinkOrderItem(it);
                if ((normalizedSection === 'drink' && drink) || (normalizedSection === 'kitchen' && !drink)) {
                    it.delivered = true;
                }
            });
        }

        await orderDoc.save();

        const order = await populateOrder(Order.findById(req.params.id)).exec();
        res.json(normalizeOrderResponse(order));
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const getOrders = async (req, res) => {
    try {
        const orders = await populateOrder(Order.find().sort({ createdAt: -1 })).exec();
        res.json(orders.map(normalizeOrderResponse));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getOrderById = async (req, res) => {
    try {
        const order = await populateOrder(Order.findById(req.params.id)).exec();
        if (!order) {
            return res.status(404).json({ error: "Pedido no encontrado." });
        }

        res.json(normalizeOrderResponse(order));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const deleteOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);
        if (!order) {
            return res.status(404).json({ error: 'Pedido no encontrado.' });
        }

        if (order.table) {
            await Table.findByIdAndUpdate(order.table, { status: 'disponible' });
        }

        await Order.findByIdAndDelete(req.params.id);
        res.json({ message: 'Pedido eliminado correctamente.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Borra TODOS los pedidos de un día. El cliente manda el rango del día en
// hora local (start = 00:00, end = 00:00 del día siguiente) para que "el día"
// sea el de Guatemala y no el del servidor (UTC).
export const deleteOrdersByDay = async (req, res) => {
    try {
        const start = new Date(req.query.start);
        const end = new Date(req.query.end);

        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
            return res.status(400).json({ error: 'Rango de fechas inválido.' });
        }

        // Seguro: nunca borrar más de ~1 día de golpe por un error de rango.
        const MAX_RANGE_MS = 48 * 60 * 60 * 1000;
        if (end - start > MAX_RANGE_MS) {
            return res.status(400).json({ error: 'El rango no puede ser mayor a un día.' });
        }

        const filter = { createdAt: { $gte: start, $lt: end } };
        const orders = await Order.find(filter).select('_id table').lean();

        if (orders.length === 0) {
            return res.json({ message: 'No había pedidos en ese día.', deletedCount: 0 });
        }

        const tableIds = [...new Set(orders.filter((o) => o.table).map((o) => String(o.table)))];

        const result = await Order.deleteMany(filter);

        // Liberar mesas, salvo las que todavía tengan un pedido activo de otro día.
        for (const tableId of tableIds) {
            const stillActive = await Order.exists({
                table: tableId,
                status: { $nin: ['Entregado', 'Cancelado'] },
            });
            if (!stillActive) {
                await Table.findByIdAndUpdate(tableId, { status: 'disponible' });
            }
        }

        res.json({
            message: 'Día borrado correctamente.',
            deletedCount: result.deletedCount,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Borra TODO el historial de pedidos (todos los días). El cliente exige una
// confirmación escrita; aquí además se pide el flag confirm=true para que una
// llamada accidental a la ruta no pueda borrar todo.
export const deleteAllOrders = async (req, res) => {
    try {
        if (String(req.query.confirm) !== 'true') {
            return res.status(400).json({ error: 'Falta la confirmación para borrar todo el historial.' });
        }

        const tableIds = await Order.distinct('table', { table: { $ne: null } });
        const result = await Order.deleteMany({});

        if (tableIds.length > 0) {
            await Table.updateMany({ _id: { $in: tableIds } }, { status: 'disponible' });
        }

        res.json({
            message: 'Historial borrado correctamente.',
            deletedCount: result.deletedCount,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getOrderHistory = async (req, res) => {
    try {
        const { status } = req.query;
        const normalizedStatus = normalizeStatus(status);
        const filter = normalizedStatus ? { status: normalizedStatus } : {};

        const orders = await populateOrder(Order.find(filter).sort({ createdAt: -1 })).exec();
        res.json(orders.map(normalizeOrderResponse));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const updateOrderItems = async (req, res) => {
    try {
        const { items, waiter } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Debe enviar al menos un platillo para actualizar.' });
        }

        const existingOrder = await Order.findById(req.params.id).populate('items.menuItem');
        if (!existingOrder) {
            return res.status(404).json({ error: 'Pedido no encontrado.' });
        }

        const existingDeliveredIncludedItems = existingOrder.items
            .filter((it) => it.delivered && isIncludedFreeItem(it))
            .map((it) => ({
                label: it.label,
                quantity: it.quantity,
                price: it.price,
                observations: it.observations || '',
                delivered: true,
                isIncluded: true,
                hideInBebidas: Boolean(it.hideInBebidas),
            }));

        let total = 0;
        const detailedItems = await Promise.all(items.map(async (item) => {
            const quantity = Number(item.quantity);
            if (!Number.isFinite(quantity) || quantity < 1) {
                throw new Error('Cada platillo debe tener una cantidad mayor a cero.');
            }

            if (item.isIncluded) {
                const label = String(item.label || '').trim();
                if (!label) {
                    throw new Error('Cada item incluido debe tener una etiqueta.');
                }

                if (Number(item.price || 0) !== 0) {
                    throw new Error('Los items incluidos deben tener precio 0.');
                }

                return {
                    menuItem: undefined,
                    label,
                    quantity,
                    price: 0,
                    observations: String(item.observations || '').trim(),
                    delivered: Boolean(item.delivered),
                    isIncluded: true,
                };
            }

            if (!item.menuItem) {
                throw new Error('Cada platillo debe tener un ID válido.');
            }

            const menuItem = await MenuItem.findOne({ _id: item.menuItem, isDeleted: { $ne: true }, available: { $ne: false } });
            if (!menuItem) {
                throw new Error('Uno o más platillos no están disponibles en el catálogo.');
            }

            // Allow optional price override when updating items
            let priceToUse = menuItem.price;
            if (item.price !== undefined && item.price !== null && item.price !== '') {
                const parsed = Number(item.price);
                if (!Number.isFinite(parsed) || parsed < 0) {
                    throw new Error('Precio inválido para uno de los platillos.');
                }
                priceToUse = parsed;
            }

            const subtotal = priceToUse * quantity;
            total += subtotal;

            return {
                menuItem: menuItem._id,
                menuItemDoc: menuItem,
                quantity,
                price: priceToUse,
                observations: String(item.observations || '').trim(),
                delivered: Boolean(item.delivered),
                isIncluded: false,
                isDrinkItem: isDrinkItemFromMenu(menuItem),
            };
        }));

        const explicitItems = detailedItems.filter((it) => !it.isIncluded);
        const includedItems = ensureIncludedFreeItemsForOrder({
            items: detailedItems,
            existingDeliveredIncludedItems,
        });

        const mappedItems = [
            ...explicitItems.map((entry) => ({
                menuItem: entry.menuItem,
                quantity: entry.quantity,
                price: entry.price,
                observations: entry.observations || '',
                delivered: entry.delivered,
                isIncluded: false,
                isDrinkItem: entry.isDrinkItem,
            })),
            ...includedItems,
        ];

        const remainingDrinkPending = mappedItems.some((it) => (it.isDrinkItem || isDrinkOrderItem(it)) && !it.delivered);
        const remainingKitchenPending = mappedItems.some((it) => !(it.isDrinkItem || isDrinkOrderItem(it)) && !it.delivered);

        const updates = {
            items: mappedItems,
            total,
            drinkStatus: remainingDrinkPending ? 'Pendiente' : 'Entregado',
            kitchenStatus: remainingKitchenPending ? 'Pendiente' : 'Entregado',
        };

        if (waiter !== undefined) {
            updates.waiter = String(waiter || '').trim();
        }

        const order = await populateOrder(
            Order.findByIdAndUpdate(req.params.id, updates, { new: true })
        ).exec();

        res.json(order);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Etiqueta del ítem incluido (cortesía) que suma todas las tortillas de la orden.
// Debe coincidir con TORTILLAS_INCLUDED_LABEL de ensureIncludedFreeItemsForOrder.
const INCLUDED_TORTILLAS_LABEL = "Tortillas";

/**
 * Ajusta UN renglón de la orden sin tocar los demás:
 *   - { remove: true }  -> quita el platillo completo (todas sus unidades).
 *   - { delta: 1 }      -> suma una unidad (delta positivo).
 *   - { delta: -1 }     -> resta una unidad; si llega a 0, quita el renglón.
 * Después recalcula el total, las tortillas incluidas y los estados de
 * bebidas/cocina, igual que lo hace updateOrderItems.
 */
export const adjustOrderItem = async (req, res) => {
    try {
        const { id, itemId } = req.params;
        const { delta, remove } = req.body || {};

        const order = await Order.findById(id).populate("items.menuItem");
        if (!order) {
            return res.status(404).json({ error: "Pedido no encontrado." });
        }

        const item = order.items.id(itemId);
        if (!item) {
            return res.status(404).json({ error: "Ese platillo ya no está en el pedido." });
        }

        if (item.isIncluded) {
            return res.status(400).json({ error: "Las tortillas incluidas se calculan solas según los platos fuertes del pedido." });
        }

        let removeLine = remove === true;
        if (!removeLine) {
            const step = Number(delta);
            if (!Number.isInteger(step) || step === 0) {
                return res.status(400).json({ error: "Indica { remove: true } o un delta entero distinto de cero." });
            }
            const newQuantity = Number(item.quantity) + step;
            if (newQuantity < 1) {
                removeLine = true;
            } else {
                item.quantity = newQuantity;
                // Las unidades nuevas todavía no se han entregado.
                if (step > 0) item.delivered = false;
            }
        }

        if (removeLine) {
            const explicitCount = order.items.filter((it) => !it.isIncluded).length;
            if (explicitCount <= 1) {
                return res.status(400).json({ error: "No se puede quitar el último platillo del pedido. Usa \"Cancelar pedido\" para eliminarlo completo." });
            }
            order.items.pull(itemId);
        }

        // Re-sincroniza las tortillas incluidas con los platos fuertes que quedaron.
        let totalTortillas = 0;
        order.items.forEach((it) => {
            if (it.isIncluded || !isMainCourseItem(it.menuItem)) return;
            const name = String(it.menuItem.name || it.label || "").trim();
            if (!name) return;
            totalTortillas += Number(it.quantity || 1) * getTortillasPerMainCourse(name);
        });
        const tortillasItem = order.items.find((it) => it.isIncluded && it.label === INCLUDED_TORTILLAS_LABEL);
        if (tortillasItem) {
            if (totalTortillas === 0) {
                order.items.pull(tortillasItem._id);
            } else if (!tortillasItem.delivered) {
                tortillasItem.quantity = totalTortillas;
            }
        }

        order.total = order.items.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0), 0);

        const hasDrinkPending = order.items.some((it) => isDrinkOrderItem(it) && !it.delivered);
        const hasKitchenPending = order.items.some((it) => !isDrinkOrderItem(it) && !it.delivered);
        order.drinkStatus = hasDrinkPending ? "Pendiente" : "Entregado";
        order.kitchenStatus = hasKitchenPending ? "Pendiente" : "Entregado";

        await order.save();

        const updated = await populateOrder(Order.findById(id)).exec();
        res.json(normalizeOrderResponse(updated));
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};