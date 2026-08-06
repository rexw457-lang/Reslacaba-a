import Order from "../models/Order.js";
import MenuItem from "../models/MenuItem.js";
import Table from "../models/Table.js";

const INCLUDED_FREE_TORTILLAS_LABEL = "Tortillas de caldo de mariscos";
const INCLUDED_FREE_TOSTADAS_LABEL = "Tostadas de ceviche";
const BEVERAGE_CATEGORY_KEYWORDS = ["bebidas", "postres"];
const BEVERAGE_NAME_KEYWORDS = ["tortilla", "tortillas", "tostada", "tostadas"];
const CALDO_KEYWORD = "caldo";
const CEVICHE_KEYWORD = "ceviche";

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
    const label = String(item?.label || "").toLowerCase();
    return item?.isIncluded || label.includes("tortilla") || label.includes("tostada");
};

const isDrinkOrderItem = (item) => {
    if (!item) return false;
    if (item.isIncluded) return false;
    if (item.isDrinkItem) return true;
    const label = String(item?.label || "").toLowerCase();
    if (item?.menuItem && (label.includes("tortilla") || label.includes("tostada"))) return true;
    return isDrinkItemFromMenu(item.menuItem);
};

const isCaldoItem = (menuItem) => !!menuItem && String(menuItem.name || "").toLowerCase().includes(CALDO_KEYWORD);
const isCevicheItem = (menuItem) => !!menuItem && String(menuItem.name || "").toLowerCase().includes(CEVICHE_KEYWORD);

const ensureIncludedFreeItemsForOrder = ({ items, existingDeliveredIncludedItems = [] }) => {
    const preservedLabels = new Set(existingDeliveredIncludedItems.map((it) => it.label));
    const hasCaldo = items.some((it) => isCaldoItem(it.menuItemDoc || it.menuItem));
    const hasCeviche = items.some((it) => isCevicheItem(it.menuItemDoc || it.menuItem));

    const preserved = existingDeliveredIncludedItems.map((it) => ({
        label: it.label,
        quantity: it.quantity,
        price: it.price,
        observations: it.observations || "",
        delivered: true,
        isIncluded: true,
    }));

    const includedItems = [...preserved];

    if (hasCaldo && !preservedLabels.has(INCLUDED_FREE_TORTILLAS_LABEL)) {
        includedItems.push({
            label: INCLUDED_FREE_TORTILLAS_LABEL,
            quantity: 1,
            price: 0,
            observations: "",
            delivered: false,
            isIncluded: true,
            hideInBebidas: false,
        });
    }

    if (hasCeviche && !preservedLabels.has(INCLUDED_FREE_TOSTADAS_LABEL)) {
        includedItems.push({
            label: INCLUDED_FREE_TOSTADAS_LABEL,
            quantity: 1,
            price: 0,
            observations: "",
            delivered: false,
            isIncluded: true,
            hideInBebidas: true,
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
        const { table, items, observations } = req.body;

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
            const subtotal = menuItem.price * quantity;
            total += subtotal;

            return {
                menuItem: menuItem._id,
                menuItemDoc: menuItem,
                quantity,
                price: menuItem.price,
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

        if (normalizedStatus === "Entregado") {
            const drinkReady = order.drinkStatus === "Entregado";
            const kitchenReady = order.kitchenStatus === "Entregado";
            if (!drinkReady || !kitchenReady) {
                const missing = [];
                if (!kitchenReady) missing.push("la parte de la cocina");
                if (!drinkReady) missing.push("la parte de bebidas");
                const message = `No se puede marcar como entregado hasta que ${missing.join(' y ')} ${missing.length > 1 ? 'se entreguen' : 'se entregue'}.`;
                return res.status(400).json({ error: message });
            }
        }

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
        const { items } = req.body;

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

            const subtotal = menuItem.price * quantity;
            total += subtotal;

            return {
                menuItem: menuItem._id,
                menuItemDoc: menuItem,
                quantity,
                price: menuItem.price,
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

        const order = await populateOrder(
            Order.findByIdAndUpdate(req.params.id, updates, { new: true })
        ).exec();

        res.json(order);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
