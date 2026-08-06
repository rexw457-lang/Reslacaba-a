import Table from "../models/Table.js";

export const createTable = async (req, res) => {
    try {
        const table = new Table(req.body);
        await table.save();
        res.status(201).json(table);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};


export const getTables = async (req, res) => {
    const filter = { isDeleted: { $ne: true } };
    if (req.query.restaurant) {
        filter.restaurant = req.query.restaurant;
    }
    const tables = await Table.find(filter).populate("restaurant");
    res.json(tables);
};

export const updateTable = async (req, res) => {
    try {
        const table = await Table.findOneAndUpdate(
            {
                _id: req.params.tableId || req.params.id,
                isDeleted: { $ne: true }
            },
            req.body,
            { new: true, runValidators: true }
        );

        if (!table) {
            return res.status(404).json({ message: "Mesa no encontrada" });
        }

        res.json(table);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

export const deleteTable = async (req, res) => {
    try {
        const table = await Table.findOneAndUpdate(
            {
                _id: req.params.tableId || req.params.id,
                isDeleted: { $ne: true }
            },
            {
                isDeleted: true,
                status: "no disponible"
            },
            { new: true }
        );

        if (!table) {
            return res.status(404).json({ message: "Mesa no encontrada" });
        }

        res.json({ message: "Mesa desactivada correctamente", table });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
