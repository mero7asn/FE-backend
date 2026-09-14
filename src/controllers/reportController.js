const ExcelJS = require('exceljs');
const SoldProduct = require('../models/SoldProduct');
const Order = require('../models/Order');
const Product = require('../models/Product');

// Helper to normalize phone number (default Egypt +20)
function normalizePhone(phoneStr) {
  if (!phoneStr) return '';
  let cleaned = String(phoneStr).trim().replace(/[^\d+]/g, '');
  if (!cleaned) return '';
  if (!cleaned.startsWith('+')) {
    if (cleaned.startsWith('0')) {
      cleaned = '+20' + cleaned.slice(1);
    } else {
      cleaned = '+20' + cleaned;
    }
  }
  return cleaned;
}

// ─── Generate Sales Excel Report (3 Structured Sheets) ────────────────────────
exports.generateSalesReportExcel = async (req, res) => {
  try {
    const { period = 'monthly', year, month } = req.query;

    let startDate = new Date();
    let endDate = new Date();
    const now = new Date();

    if (period === 'weekly') {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'yearly') {
      const targetYear = year ? parseInt(year, 10) : now.getFullYear();
      startDate = new Date(targetYear, 0, 1, 0, 0, 0);
      endDate = new Date(targetYear, 11, 31, 23, 59, 59);
    } else {
      if (month && year) {
        const targetYear = parseInt(year, 10);
        const targetMonth = parseInt(month, 10) - 1;
        startDate = new Date(targetYear, targetMonth, 1, 0, 0, 0);
        endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);
      } else {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);
      }
    }

    // Fetch SoldProducts in date range
    const soldProducts = await SoldProduct.find({
      soldAt: { $gte: startDate, $lte: endDate }
    })
    .sort({ soldAt: -1 })
    .populate('product', 'price originalPrice productNumber')
    .populate('soldBy', 'name email');

    // Fetch Orders in date range
    const orders = await Order.find({
      createdAt: { $gte: startDate, $lte: endDate }
    })
    .sort({ createdAt: -1 })
    .populate('user', 'name email phone');

    // Fetch all products for size-level inventory analysis
    const allProducts = await Product.find();

    // Direct Sales calculations
    let directRevenue = 0;
    const customerSalesRows = [];

    soldProducts.forEach(sp => {
      const price = sp.product?.price || 0;
      directRevenue += price;

      customerSalesRows.push({
        date: sp.soldAt,
        customerName: sp.customerName || 'Direct Customer',
        customerPhone: sp.customerPhone || '-',
        tshirtName: sp.productName,
        size: sp.size,
        color: sp.color || '-',
        price,
        saleType: 'Direct POS Sale',
        refNumber: sp.uooNumber,
        status: 'Completed',
        city: 'In-Store',
        address: 'Direct Sale'
      });
    });

    // Online Orders calculations
    let onlineRevenue = 0;
    orders.forEach(ord => {
      const total = ord.pricing?.total || 0;
      if (ord.payment?.status === 'paid' || ord.status !== 'canceled') {
        onlineRevenue += total;
      }

      const custName = ord.shippingAddress?.name || ord.user?.name || 'Online Customer';
      const custPhone = normalizePhone(ord.shippingAddress?.phone || ord.user?.phone) || '-';
      const city = ord.shippingAddress?.city || ord.shippingAddress?.state || '-';
      const address = [ord.shippingAddress?.street, ord.shippingAddress?.city, ord.shippingAddress?.state].filter(Boolean).join(', ') || '-';

      if (ord.items && ord.items.length > 0) {
        ord.items.forEach(item => {
          customerSalesRows.push({
            date: ord.createdAt,
            customerName: custName,
            customerPhone: custPhone,
            tshirtName: item.name || item.product?.name || 'T-Shirt',
            size: item.size || '-',
            color: item.color || '-',
            price: (item.price || 0) * (item.quantity || 1),
            saleType: 'Online Order',
            refNumber: ord.orderNumber,
            status: ord.status,
            city,
            address
          });
        });
      } else {
        customerSalesRows.push({
          date: ord.createdAt,
          customerName: custName,
          customerPhone: custPhone,
          tshirtName: 'Online Order Items',
          size: '-',
          color: '-',
          price: total,
          saleType: 'Online Order',
          refNumber: ord.orderNumber,
          status: ord.status,
          city,
          address
        });
      }
    });

    // Sort combined customer sales rows by date descending
    customerSalesRows.sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalRevenue = directRevenue + onlineRevenue;
    const totalTransactions = soldProducts.length + orders.length;
    const avgTransactionValue = totalTransactions > 0 ? (totalRevenue / totalTransactions) : 0;

    // Create Excel Workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'First Edition E-commerce';
    workbook.created = new Date();

    // ──────────────────────────────────────────────────────────────────────────
    // 📄 PAGE 1 (SHEET 1): General Overview / Current Data Summary
    // ──────────────────────────────────────────────────────────────────────────
    const summarySheet = workbook.addWorksheet('General Overview');
    summarySheet.columns = [
      { header: 'Metric Category', key: 'metric', width: 38 },
      { header: 'Value', key: 'value', width: 32 }
    ];

    summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' }, size: 12 };
    summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1A1612' } };

    summarySheet.addRows([
      { metric: 'Report Period', value: period.toUpperCase() },
      { metric: 'Start Date', value: startDate.toISOString().split('T')[0] },
      { metric: 'End Date', value: endDate.toISOString().split('T')[0] },
      { metric: 'Generated Timestamp', value: new Date().toLocaleString('en-EG') },
      { metric: '----------------------------------------', value: '----------------------------------------' },
      { metric: 'Total Combined Sales Revenue', value: totalRevenue },
      { metric: 'Total Sales & Orders Count', value: totalTransactions },
      { metric: 'Average Order Value', value: avgTransactionValue },
      { metric: 'Direct POS Sales Count', value: soldProducts.length },
      { metric: 'Direct POS Revenue', value: directRevenue },
      { metric: 'Online Orders Count', value: orders.length },
      { metric: 'Online Orders Revenue', value: onlineRevenue }
    ]);

    // Format currency rows
    [6, 8, 10, 12].forEach(rowIdx => {
      const cell = summarySheet.getCell(`B${rowIdx}`);
      cell.numFmt = '#,##0.00 "EGP"';
      cell.font = { bold: true };
    });

    // ──────────────────────────────────────────────────────────────────────────
    // 📄 PAGE 2 (SHEET 2): Customer Sales Details
    // ──────────────────────────────────────────────────────────────────────────
    const customerSheet = workbook.addWorksheet('Customer Sales Details');
    customerSheet.columns = [
      { header: 'Date & Time', key: 'date', width: 20 },
      { header: 'Customer Name', key: 'customerName', width: 24 },
      { header: 'Customer Phone', key: 'customerPhone', width: 18 },
      { header: 'T-Shirt / Product Name', key: 'tshirtName', width: 32 },
      { header: 'Size', key: 'size', width: 10 },
      { header: 'Color', key: 'color', width: 14 },
      { header: 'Price / Amount (EGP)', key: 'price', width: 18 },
      { header: 'Sale Type', key: 'saleType', width: 18 },
      { header: 'Reference / Order #', key: 'refNumber', width: 20 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Governorate / City', key: 'city', width: 18 },
      { header: 'Shipping Address', key: 'address', width: 35 }
    ];

    customerSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    customerSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'C8A45D' } };

    customerSalesRows.forEach(r => {
      const row = customerSheet.addRow({
        ...r,
        date: new Date(r.date).toLocaleString('en-GB')
      });
      row.getCell('price').numFmt = '#,##0.00';
    });

    // Total Row
    const custTotalRow = customerSheet.addRow({
      date: 'TOTAL',
      customerName: `${customerSalesRows.length} Transactions`,
      price: totalRevenue
    });
    custTotalRow.font = { bold: true };
    custTotalRow.getCell('price').numFmt = '#,##0.00 "EGP"';

    // ──────────────────────────────────────────────────────────────────────────
    // 📄 PAGE 3 (SHEET 3): T-Shirt Sizes & Sales Breakdown
    // ──────────────────────────────────────────────────────────────────────────
    const sizeSheet = workbook.addWorksheet('T-Shirts & Sizes Breakdown');
    sizeSheet.columns = [
      { header: 'T-Shirt Name', key: 'name', width: 32 },
      { header: 'Product #', key: 'productNumber', width: 14 },
      { header: 'Size', key: 'size', width: 10 },
      { header: 'Price / Unit (EGP)', key: 'price', width: 16 },
      { header: 'Direct POS Sold', key: 'directSold', width: 16 },
      { header: 'Online Sold', key: 'onlineSold', width: 14 },
      { header: 'Total Units Sold', key: 'totalSold', width: 16 },
      { header: 'Total Size Revenue (EGP)', key: 'revenue', width: 22 },
      { header: 'Current Stock Left', key: 'stock', width: 16 }
    ];

    sizeSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    sizeSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1A1612' } };

    // Build size-level sales map across products
    let grandUnitsSold = 0;
    let grandSizeRevenue = 0;

    allProducts.forEach(prod => {
      const pIdStr = prod._id.toString();
      const pName = prod.name;
      const pNum = prod.productNumber || '-';
      const pPrice = prod.price || 0;

      (prod.sizes || []).forEach(sizeObj => {
        const sName = sizeObj.size;
        const currentStock = sizeObj.stock || 0;

        // Calculate direct sales count for this prod & size
        const directSold = soldProducts.filter(sp => 
          sp.product?.toString() === pIdStr || sp.productName === pName
        ).filter(sp => sp.size === sName).length;

        // Calculate online sales count for this prod & size
        let onlineSold = 0;
        orders.forEach(ord => {
          if (ord.items && ord.items.length > 0) {
            ord.items.forEach(item => {
              const matchProd = item.product?.toString() === pIdStr || item.name === pName;
              if (matchProd && item.size === sName) {
                onlineSold += (item.quantity || 1);
              }
            });
          }
        });

        const totalSold = directSold + onlineSold;
        const sizeRev = totalSold * pPrice;

        grandUnitsSold += totalSold;
        grandSizeRevenue += sizeRev;

        const row = sizeSheet.addRow({
          name: pName,
          productNumber: pNum,
          size: sName,
          price: pPrice,
          directSold,
          onlineSold,
          totalSold,
          revenue: sizeRev,
          stock: currentStock
        });

        row.getCell('price').numFmt = '#,##0.00';
        row.getCell('revenue').numFmt = '#,##0.00';
      });
    });

    // Total Row for Size Sheet
    const sizeTotalRow = sizeSheet.addRow({
      name: 'TOTAL',
      totalSold: grandUnitsSold,
      revenue: grandSizeRevenue
    });
    sizeTotalRow.font = { bold: true };
    sizeTotalRow.getCell('revenue').numFmt = '#,##0.00 "EGP"';

    // Stream Excel file back
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=First_Edition_Sales_Report_${period}_${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error generating sales report:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── Generate Single Customer Specific Excel Report ───────────────────────────
exports.generateSingleCustomerExcel = async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ message: 'Customer phone number is required' });
    }

    const normalized = normalizePhone(phone);
    if (!normalized) {
      return res.status(400).json({ message: 'Invalid phone number format' });
    }

    // Fetch all SoldProducts for this customer
    const soldProducts = await SoldProduct.find({
      $or: [
        { customerPhone: normalized },
        { customerPhone: phone.trim() }
      ]
    })
    .sort({ soldAt: -1 })
    .populate('product', 'price name productNumber');

    // Fetch all Orders for this customer
    const orders = await Order.find({
      $or: [
        { 'shippingAddress.phone': { $regex: phone.trim().replace('+', '\\+'), $options: 'i' } },
        { 'shippingAddress.phone': { $regex: normalized.replace('+', '\\+'), $options: 'i' } }
      ]
    })
    .sort({ createdAt: -1 })
    .populate('user', 'name phone email');

    if (soldProducts.length === 0 && orders.length === 0) {
      return res.status(404).json({ message: `No purchase history found for customer phone: ${phone}` });
    }

    // Customer Name resolution
    const customerName = soldProducts[0]?.customerName || orders[0]?.shippingAddress?.name || orders[0]?.user?.name || 'Customer';

    let totalRevenue = 0;
    let totalItems = 0;
    const purchases = [];

    // Process Direct Sales
    soldProducts.forEach(sp => {
      const price = sp.product?.price || 0;
      totalRevenue += price;
      totalItems += 1;
      purchases.push({
        date: sp.soldAt,
        type: 'Direct POS Sale',
        refNumber: sp.uooNumber,
        productName: sp.productName,
        size: sp.size,
        color: sp.color || '-',
        unitPrice: price,
        quantity: 1,
        totalAmount: price,
        address: 'Direct Store Purchase'
      });
    });

    // Process Online Orders
    orders.forEach(ord => {
      const ordTotal = ord.pricing?.total || 0;
      totalRevenue += ordTotal;

      const addressStr = [ord.shippingAddress?.street, ord.shippingAddress?.city, ord.shippingAddress?.state].filter(Boolean).join(', ') || 'Online Order';

      if (ord.items && ord.items.length > 0) {
        ord.items.forEach(item => {
          const qty = item.quantity || 1;
          totalItems += qty;
          purchases.push({
            date: ord.createdAt,
            type: 'Online Order',
            refNumber: ord.orderNumber,
            productName: item.name || item.product?.name || 'T-Shirt',
            size: item.size || '-',
            color: item.color || '-',
            unitPrice: item.price || 0,
            quantity: qty,
            totalAmount: (item.price || 0) * qty,
            address: addressStr
          });
        });
      } else {
        totalItems += 1;
        purchases.push({
          date: ord.createdAt,
          type: 'Online Order',
          refNumber: ord.orderNumber,
          productName: 'Online Order Items',
          size: '-',
          color: '-',
          unitPrice: ordTotal,
          quantity: 1,
          totalAmount: ordTotal,
          address: addressStr
        });
      }
    });

    // Sort chronologically descending
    purchases.sort((a, b) => new Date(b.date) - new Date(a.date));

    const firstPurchaseDate = purchases[purchases.length - 1]?.date;
    const lastPurchaseDate = purchases[0]?.date;

    // Build Excel workbook for this single customer
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'First Edition E-commerce';

    const sheet = workbook.addWorksheet(`${customerName.substring(0, 20)} Sales Log`);

    // Customer Summary Section
    sheet.columns = [
      { header: 'Attribute', key: 'attr', width: 28 },
      { header: 'Customer Details', key: 'detail', width: 35 }
    ];

    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1A1612' } };

    sheet.addRows([
      { attr: 'Customer Name', detail: customerName },
      { attr: 'Phone Number', detail: normalized },
      { attr: 'Total Spent (Revenue)', detail: totalRevenue },
      { attr: 'Total T-Shirts / Items Purchased', detail: totalItems },
      { attr: 'First Purchase Date', detail: firstPurchaseDate ? new Date(firstPurchaseDate).toLocaleDateString('en-GB') : '-' },
      { attr: 'Last Purchase Date', detail: lastPurchaseDate ? new Date(lastPurchaseDate).toLocaleDateString('en-GB') : '-' },
      { attr: 'Report Generated At', detail: new Date().toLocaleString('en-EG') }
    ]);

    sheet.getCell('B3').numFmt = '#,##0.00 "EGP"';
    sheet.getCell('B3').font = { bold: true };

    // Blank row
    sheet.addRow({});

    // Table Header for Purchase History
    const tableHeaderRow = sheet.addRow([
      'Date & Time',
      'Sale Type',
      'Order / UOO #',
      'T-Shirt Name',
      'Size',
      'Color',
      'Unit Price (EGP)',
      'Qty',
      'Total Amount (EGP)',
      'Delivery / Store Location'
    ]);

    tableHeaderRow.font = { bold: true, color: { argb: 'FFFFFF' } };
    tableHeaderRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'C8A45D' } };
    });

    purchases.forEach(p => {
      const row = sheet.addRow([
        new Date(p.date).toLocaleString('en-GB'),
        p.type,
        p.refNumber,
        p.productName,
        p.size,
        p.color,
        p.unitPrice,
        p.quantity,
        p.totalAmount,
        p.address
      ]);
      row.getCell(7).numFmt = '#,##0.00';
      row.getCell(9).numFmt = '#,##0.00';
    });

    // Total Row
    const grandTotalRow = sheet.addRow([
      'TOTAL',
      '',
      '',
      `${purchases.length} Transactions`,
      '',
      '',
      '',
      totalItems,
      totalRevenue,
      ''
    ]);
    grandTotalRow.font = { bold: true };
    grandTotalRow.getCell(9).numFmt = '#,##0.00 "EGP"';

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=First_Edition_Customer_${normalized.replace('+', '')}_${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting single customer report:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── Get Customer Ranking Aggregated by Phone Number ─────────────────────────
exports.getCustomerRanking = async (req, res) => {
  try {
    const { sortBy = 'revenue', order = 'desc', search = '' } = req.query;

    const soldProducts = await SoldProduct.find()
      .populate('product', 'price name')
      .populate('soldBy', 'name');

    const orders = await Order.find()
      .populate('user', 'name phone email')
      .populate('items.product', 'name price');

    const customerMap = {};

    // Helper to get or create map entry for phone number
    const getCustomerEntry = (rawPhone, defaultName) => {
      const phone = normalizePhone(rawPhone);
      if (!phone) return null;

      if (!customerMap[phone]) {
        customerMap[phone] = {
          phone,
          name: defaultName || 'Unknown Customer',
          totalRevenue: 0,
          totalOrders: 0,
          directSalesCount: 0,
          onlineOrdersCount: 0,
          firstPurchase: null,
          lastPurchase: null,
          purchases: []
        };
      }
      if (defaultName && (customerMap[phone].name === 'Unknown Customer' || customerMap[phone].name === 'Online Customer')) {
        customerMap[phone].name = defaultName;
      }
      return customerMap[phone];
    };

    // Aggregate SoldProducts
    soldProducts.forEach(sp => {
      if (!sp.customerPhone) return;
      const entry = getCustomerEntry(sp.customerPhone, sp.customerName);
      if (!entry) return;

      const amount = sp.product?.price || 0;
      const date = new Date(sp.soldAt);

      entry.totalRevenue += amount;
      entry.totalOrders += 1;
      entry.directSalesCount += 1;

      if (!entry.firstPurchase || date < new Date(entry.firstPurchase)) {
        entry.firstPurchase = date;
      }
      if (!entry.lastPurchase || date > new Date(entry.lastPurchase)) {
        entry.lastPurchase = date;
      }

      entry.purchases.push({
        id: sp._id,
        type: 'Direct Sale',
        refNumber: sp.uooNumber,
        productName: sp.productName,
        size: sp.size,
        color: sp.color || '-',
        amount,
        date: sp.soldAt
      });
    });

    // Aggregate Orders
    orders.forEach(ord => {
      const rawPhone = ord.shippingAddress?.phone || ord.user?.phone;
      if (!rawPhone) return;

      const customerName = ord.shippingAddress?.name || ord.user?.name;
      const entry = getCustomerEntry(rawPhone, customerName);
      if (!entry) return;

      const amount = ord.pricing?.total || 0;
      const date = new Date(ord.createdAt);

      entry.totalRevenue += amount;
      entry.totalOrders += 1;
      entry.onlineOrdersCount += 1;

      if (!entry.firstPurchase || date < new Date(entry.firstPurchase)) {
        entry.firstPurchase = date;
      }
      if (!entry.lastPurchase || date > new Date(entry.lastPurchase)) {
        entry.lastPurchase = date;
      }

      const itemSummary = ord.items.map(i => `${i.name || i.product?.name || 'T-Shirt'} (x${i.quantity})`).join(', ');

      entry.purchases.push({
        id: ord._id,
        type: 'Online Order',
        refNumber: ord.orderNumber,
        productName: itemSummary || 'Order Items',
        size: ord.items[0]?.size || '-',
        color: ord.items[0]?.color || '-',
        amount,
        date: ord.createdAt
      });
    });

    let customers = Object.values(customerMap);

    // Search filter
    if (search) {
      const q = search.toLowerCase().trim();
      customers = customers.filter(c => 
        c.phone.toLowerCase().includes(q) || 
        c.name.toLowerCase().includes(q)
      );
    }

    // Sort customers
    customers.sort((a, b) => {
      let result = 0;
      if (sortBy === 'ordersCount') {
        result = b.totalOrders - a.totalOrders;
      } else if (sortBy === 'lastPurchase') {
        result = new Date(b.lastPurchase) - new Date(a.lastPurchase);
      } else {
        // Default: revenue
        result = b.totalRevenue - a.totalRevenue;
      }
      return order === 'asc' ? -result : result;
    });

    // Sort inner purchases chronologically descending
    customers.forEach(c => {
      c.purchases.sort((a, b) => new Date(b.date) - new Date(a.date));
    });

    const totalCustomers = customers.length;
    const overallRevenue = customers.reduce((sum, c) => sum + c.totalRevenue, 0);
    const topSpender = customers[0] ? customers[0].name : null;

    res.json({
      customers,
      totalCustomers,
      overallRevenue,
      topSpender
    });
  } catch (error) {
    console.error('Error fetching customer ranking:', error);
    res.status(500).json({ message: error.message });
  }
};

// ─── Export Customer Ranking to Excel ─────────────────────────────────────────
exports.exportCustomerRankingExcel = async (req, res) => {
  try {
    const soldProducts = await SoldProduct.find().populate('product', 'price');
    const orders = await Order.find();

    const customerMap = {};

    const getCustomerEntry = (rawPhone, defaultName) => {
      const phone = normalizePhone(rawPhone);
      if (!phone) return null;
      if (!customerMap[phone]) {
        customerMap[phone] = {
          phone,
          name: defaultName || 'Unknown Customer',
          totalRevenue: 0,
          totalOrders: 0,
          directSalesCount: 0,
          onlineOrdersCount: 0,
          firstPurchase: null,
          lastPurchase: null,
          purchases: []
        };
      }
      if (defaultName && (customerMap[phone].name === 'Unknown Customer' || customerMap[phone].name === 'Online Customer')) {
        customerMap[phone].name = defaultName;
      }
      return customerMap[phone];
    };

    soldProducts.forEach(sp => {
      if (!sp.customerPhone) return;
      const entry = getCustomerEntry(sp.customerPhone, sp.customerName);
      if (!entry) return;
      const amount = sp.product?.price || 0;
      const date = new Date(sp.soldAt);
      entry.totalRevenue += amount;
      entry.totalOrders += 1;
      entry.directSalesCount += 1;
      if (!entry.firstPurchase || date < new Date(entry.firstPurchase)) entry.firstPurchase = date;
      if (!entry.lastPurchase || date > new Date(entry.lastPurchase)) entry.lastPurchase = date;
      entry.purchases.push({
        type: 'Direct Sale',
        refNumber: sp.uooNumber,
        productName: sp.productName,
        size: sp.size,
        color: sp.color || '-',
        amount,
        date: sp.soldAt
      });
    });

    orders.forEach(ord => {
      const rawPhone = ord.shippingAddress?.phone || ord.user?.phone;
      if (!rawPhone) return;
      const entry = getCustomerEntry(rawPhone, ord.shippingAddress?.name || ord.user?.name);
      if (!entry) return;
      const amount = ord.pricing?.total || 0;
      const date = new Date(ord.createdAt);
      entry.totalRevenue += amount;
      entry.totalOrders += 1;
      entry.onlineOrdersCount += 1;
      if (!entry.firstPurchase || date < new Date(entry.firstPurchase)) entry.firstPurchase = date;
      if (!entry.lastPurchase || date > new Date(entry.lastPurchase)) entry.lastPurchase = date;
      entry.purchases.push({
        type: 'Online Order',
        refNumber: ord.orderNumber,
        productName: ord.items.map(i => `${i.name} (x${i.quantity})`).join(', '),
        size: ord.items[0]?.size || '-',
        color: ord.items[0]?.color || '-',
        amount,
        date: ord.createdAt
      });
    });

    const customers = Object.values(customerMap).sort((a, b) => b.totalRevenue - a.totalRevenue);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'First Edition E-commerce';

    // Sheet 1: Customer Ranking
    const rankSheet = workbook.addWorksheet('Customer Ranking');
    rankSheet.columns = [
      { header: 'Rank #', key: 'rank', width: 10 },
      { header: 'Customer Name', key: 'name', width: 25 },
      { header: 'Phone Number', key: 'phone', width: 20 },
      { header: 'Total Spent (EGP)', key: 'totalRevenue', width: 20 },
      { header: 'Total Purchases', key: 'totalOrders', width: 16 },
      { header: 'Direct Sales', key: 'directSalesCount', width: 14 },
      { header: 'Online Orders', key: 'onlineOrdersCount', width: 14 },
      { header: 'First Purchase', key: 'firstPurchase', width: 18 },
      { header: 'Last Purchase', key: 'lastPurchase', width: 18 }
    ];

    rankSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    rankSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1A1612' } };

    customers.forEach((c, idx) => {
      const row = rankSheet.addRow({
        rank: idx + 1,
        name: c.name,
        phone: c.phone,
        totalRevenue: c.totalRevenue,
        totalOrders: c.totalOrders,
        directSalesCount: c.directSalesCount,
        onlineOrdersCount: c.onlineOrdersCount,
        firstPurchase: c.firstPurchase ? new Date(c.firstPurchase).toLocaleDateString('en-GB') : '-',
        lastPurchase: c.lastPurchase ? new Date(c.lastPurchase).toLocaleDateString('en-GB') : '-'
      });
      row.getCell('totalRevenue').numFmt = '#,##0.00';
    });

    // Sheet 2: All Purchase Details
    const purchasesSheet = workbook.addWorksheet('Detailed Purchase History');
    purchasesSheet.columns = [
      { header: 'Customer Phone', key: 'phone', width: 20 },
      { header: 'Customer Name', key: 'name', width: 24 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Ref / Order #', key: 'refNumber', width: 20 },
      { header: 'Date', key: 'date', width: 20 },
      { header: 'Product Summary', key: 'productName', width: 35 },
      { header: 'Size', key: 'size', width: 10 },
      { header: 'Color', key: 'color', width: 12 },
      { header: 'Amount (EGP)', key: 'amount', width: 16 }
    ];

    purchasesSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    purchasesSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'C8A45D' } };

    customers.forEach(c => {
      c.purchases.forEach(p => {
        const row = purchasesSheet.addRow({
          phone: c.phone,
          name: c.name,
          type: p.type,
          refNumber: p.refNumber,
          date: new Date(p.date).toLocaleString('en-GB'),
          productName: p.productName,
          size: p.size,
          color: p.color,
          amount: p.amount
        });
        row.getCell('amount').numFmt = '#,##0.00';
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Customer_Ranking_Report_${Date.now()}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Error exporting customer ranking:', error);
    res.status(500).json({ message: error.message });
  }
};
