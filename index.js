const express = require("express");
const path = require("path");
const cors = require('cors');

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();

app.use(cors());

const dbPath = path.join(__dirname, "products.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(5000, () => {
      console.log("Server Running at http://localhost:5000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
  }
};

initializeDBAndServer();

// API to list all transactions with search and pagination
app.get('/transactions', async (req, res) => {
    const {
        page = 1,
        perPage = 10,
        searchText = "",
    } = req.query;
    const offset = (page - 1) * perPage;
    
    const countQuery = `
        SELECT COUNT(*) as totalCount FROM transactions
        WHERE title LIKE ? OR description LIKE ? OR price LIKE ?
    `;
    const countResult = await db.get(countQuery, [`%${searchText}%`, `%${searchText}%`, `%${searchText}%`]);

    const totalRecords = countResult.totalCount;
    const totalPages = Math.ceil(totalRecords / perPage);

    const query = `
        SELECT * FROM transactions
        WHERE title LIKE ? OR description LIKE ? OR price LIKE ?
        ORDER BY dateOfSale
        LIMIT ? OFFSET ?
    `;

    const allTransactions = await db.all(query, [ `%${searchText}%`, `%${searchText}%`, `%${searchText}%`, perPage, offset]);

    res.send({
        totalPages,
        currentPage: page,
        data: allTransactions
    });
});


//API to colect the statistics of a month
app.get('/statistics', async (req, res) => {
    let { month } = req.query;

    month = month.padStart(2, '0');

    const totalSaleAmount = await db.get(
        'SELECT SUM(price) AS total FROM transactions WHERE strftime("%m", dateOfSale) = ? AND sold = 1',
        [month])

    const totalSoldItems = await db.get(
        'SELECT COUNT(*) AS total FROM transactions WHERE strftime("%m", dateOfSale) = ? AND sold = 1',
        [month])


    const totalNotSoldItems = await db.get(
        'SELECT COUNT(*) AS total FROM transactions WHERE strftime("%m", dateOfSale) = ? AND sold = 0',
        [month])

    const statistics = {
        totalSaleAmount: totalSaleAmount["total"].toFixed(2),
        totalSoldItems: totalSoldItems["total"],
        totalNotSoldItems: totalNotSoldItems["total"],
    };

    res.json(statistics);
});



// API for bar chart
app.get('/bar-chart', async (req, res) => {
    
    let { month } = req.query;
    month = month.padStart(2, '0');

    const priceRanges = [
        { min: 0, max: 100 },
        { min: 101, max: 200 },
        { min: 201, max: 300 },
        { min: 301, max: 400 },
        { min: 401, max: 500 },
        { min: 501, max: 600 },
        { min: 601, max: 700 },
        { min: 701, max: 800 },
        { min: 801, max: 900 },
        { min: 901, max: Infinity },
    ]

    const barChartData = [];

    for (const range of priceRanges) {
        const { min, max } = range;

        const count = await db.get(
            'SELECT COUNT(*) AS count FROM transactions WHERE strftime("%m", dateOfSale) = ? AND price >= ? AND price <= ?',
            [month, min, max])

        const newObj = {
            range : `${min}-${max === Infinity  ? 'above' : max}`,
            itemCount: count["count"]
        }

        barChartData.push(newObj)
    }


    res.json(barChartData);
});



// API for pie chart
app.get('/pie-chart', async (req, res) => {
    let { month } = req.query;
    
    month = month.padStart(2, '0');

    const categoriesData = await  db.all(
        'SELECT category, COUNT(*) AS itemCount FROM transactions WHERE strftime("%m", dateOfSale) = ? GROUP BY category',
        [month])

    const pieChartData = categoriesData.map((categoryData) => ({
        category: categoryData.category,
        itemCount: categoryData.itemCount,
    }));

    res.json(pieChartData);
});



//API for get combined data
app.get('/combined', async (req, res) => {
    
    
    let { month } = req.query;

    month = month.padStart(2, '0');


    const totalSaleAmount = await db.get(
        'SELECT SUM(price) AS total FROM transactions WHERE strftime("%m", dateOfSale) = ? AND sold = 1',
        [month])

    const totalSoldItems = await db.get(
        'SELECT COUNT(*) AS total FROM transactions WHERE strftime("%m", dateOfSale) = ? AND sold = 1',
        [month])


    const totalNotSoldItems = await db.get(
        'SELECT COUNT(*) AS total FROM transactions WHERE strftime("%m", dateOfSale) = ? AND sold = 0',
        [month])

    const statistics = {
        totalSaleAmount: totalSaleAmount["total"].toFixed(2),
        totalSoldItems: totalSoldItems["total"],
        totalNotSoldItems: totalNotSoldItems["total"],
    };
    


    const priceRanges = [
        { min: 0, max: 100 },
        { min: 101, max: 200 },
        { min: 201, max: 300 },
        { min: 301, max: 400 },
        { min: 401, max: 500 },
        { min: 501, max: 600 },
        { min: 601, max: 700 },
        { min: 701, max: 800 },
        { min: 801, max: 900 },
        { min: 901, max: Infinity },
    ]

    const countsByRange = {};

    for (const range of priceRanges) {
        const { min, max } = range;

        const count = await db.get(
            'SELECT COUNT(*) AS count FROM transactions WHERE strftime("%m", dateOfSale) = ? AND price >= ? AND price <= ?',
            [month, min, max])
        countsByRange[`${min}-${max === Infinity  ? 'above' : max}`] = count["count"];
    }


    const barChartData = {
        countsByRange,
    };
    

    const categoriesData = await  db.all(
        'SELECT category, COUNT(*) AS itemCount FROM transactions WHERE strftime("%m", dateOfSale) = ? GROUP BY category',
        [month])

    const pieChartData = categoriesData.map((categoryData) => ({
        category: categoryData.category,
        itemCount: categoryData.itemCount,
    }));

    const combinedData = {
        statistics,
        barChartData,
        pieChartData
    }


    res.send(combinedData)

});
