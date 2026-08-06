const Order = require("../models/Order");

exports.getReport = async (req, res) => {
    const orders = await Order.find();

    const totalSales = orders.reduce((acc, o) => acc + o.total, 0);

    res.json({
        totalOrders: orders.length,
        totalSales
    });
};