const router = require("express").Router();
const StockItem = require("../models/stocks/stockItem");
const Stock = require("../models/stocks/stocks");

//default route = /stocks
router.get("/:category", async (req, res) => {
  try {
    const { category } = req.params;

    // Find stock items by category
    const stockItems = await StockItem.find({ category }); // Filter by category

    // Check if any stock items were found
    if (stockItems.length === 0) {
      return res.status(404).json({ message: "No stock items found for this category." });
    }

    const results = await Promise.all(
      stockItems.map(async (stockItem) => {
        // Fetch stocks for each stock item
        const stocks = await Stock.find({ stockItemId: stockItem._id });

        // Calculate total current quantity for the stock item
        const totalCurrentQuantity = stocks.reduce(
          (sum, stock) => sum + stock.currentQuantity,
          0
        );

        // Calculate total initial quantity for the stock item
        const totalInitialQuantity = stocks.reduce(
          (sum, stock) => sum + stock.initialQuantity,
          0
        );

        const stockDetails = stocks.map((stock) => ({
          initialQuantity: stock.initialQuantity,
          currentQuantity: stock.currentQuantity,
          expirationDate: stock.expirationDate, // include if needed
        }));

        let status;
        if (totalCurrentQuantity === 0) {
          status = "Out of Stock";
        } else if (totalCurrentQuantity < totalInitialQuantity * 0.1) {
          status = "Out of Stock";
        } else if (totalCurrentQuantity < totalInitialQuantity / 2) {
          status = "Need Restock";
        } else {
          status = "In Stock";
        }

        // Return stock item name and total current quantity
        return {
          stockItemId: stockItem._id,
          stockItemName: stockItem.name,
          totalCurrentQuantity,
          category: stockItem.category,
          stockDetails,
          status,
        };
      })
    );

    return res.status(200).json(results);
  } catch (err) {
    console.log("error: ", err);
    return res.status(500).json({ err: "Error fetching stocks" });
  }
});

router.get("/", async (req, res) => {
  try {
    const stockItems = await StockItem.find();

    const results = await Promise.all(
      stockItems.map(async (stockItem) => {
        // Fetch stocks for each stock item
        const stocks = await Stock.find({ stockItemId: stockItem._id });
        // Calculate total current quantity for the stock item
        const totalCurrentQuantity = stocks.reduce(
          (sum, stock) => sum + stock.currentQuantity,
          0
        );

        // Calculate total initial quantity for the stock item
        const totalInitialQuantity = stocks.reduce(
          (sum, stock) => sum + stock.initialQuantity,
          0
        );

        const stockDetails = stocks.map((stock) => ({
          initialQuantity: stock.initialQuantity,
          currentQuantity: stock.currentQuantity,
          expirationDate: stock.expirationDate, // include if needed
        }));

        let status;
        if (totalCurrentQuantity === 0) {
          status = "Out of Stock";
        } else if (totalCurrentQuantity < totalInitialQuantity * 0.1) {
          status = "Out of Stock";
        } else if (totalCurrentQuantity < totalInitialQuantity / 2) {
          status = "Need Restock";
        } else {
          status = "In Stock";
        }

        // Return stock item name and total current quantity
        return {
          stockItemId: stockItem._id,
          stockItemName: stockItem.name,
          totalCurrentQuantity,
          category: stockItem.category,
          stockDetails,
          status,
        };
      })
    );

    return res.status(200).json(results);
  } catch (err) {
    console.log("error: ", err);
    return res.status(500).json({ err: "Error fetching stocks" });
  }
});


//add stock item
router.post("/item", async (req, res) => {
  const currentUser = req.user;
  const { addItemName, category } = req.body;

  console.log("body: ", addItemName, category);
  try {
    // if (currentUser.role !== "admin") {
    //     return res.status(404).json({ error: "Not authorized" });
    // }

    const addStockItem = await StockItem.create({
      userId: currentUser._id,
      name: addItemName,
      category,
    });

    return res.status(200).json(addStockItem);
  } catch (err) {
    console.log("error: ", err);
    return res.status(500).json({ err: "Error adding stocks item" });
  }
});

//deduction [single]
router.post("/deduct", async (req, res) => {
  const currentUser = req.user;
  const { stockItemId, deduction } = req.body;

  try {
    // if (currentUser.role !== "admin" || currentUser.role !== "staff") {
    //     return res.status(404).json({ error: "Not authorized" });
    // }

    // Sort by expirationDate (nearest date first)
    let stocks = await Stock.find({ stockItemId }).sort({
      expirationDate: 1,
    });

    console.log("stocks: ", stocks);

    if (!stocks || stocks.length === 0) {
      return res.status(404).json({ error: "No stocks found for this item" });
    }

    // Calculate the total available quantity
    const totalAvailableQuantity = stocks.reduce(
      (total, stock) => total + stock.currentQuantity,
      0
    );

    // If deduction is greater than total available quantity, return an error
    if (deduction > totalAvailableQuantity) {
      return res
        .status(400)
        .json({ error: "Not enough stock to fulfill the deduction" });
    }

    let remainingDeduction = deduction;

    for (let stock of stocks) {
      // If there's no deduction left to apply, stop
      if (remainingDeduction <= 0) break;

      let availableQuantity = stock.currentQuantity;

      // Deduct the remaining amount from this stock and stop further deductions
      if (availableQuantity >= remainingDeduction) {
        stock.currentQuantity -= remainingDeduction;
        remainingDeduction = 0;
      } else {
        remainingDeduction -= availableQuantity;
        stock.currentQuantity = 0;
      }
      await stock.save();
    }

    return res
      .status(200)
      .json({ message: "Stock deduction applied successfully" });
  } catch (err) {
    console.log("error: ", err);
    return res.status(500).json({ err: "Error updating stocks" });
  }
});

router.post("/edit", async (req, res) => {
  const currentUser = req.user;
  const { stockUpdate, stockDeletion } = req.body; // Single objects
  console.log(currentUser)
  try {
    // if (currentUser.role !== "admin" || currentUser.role !== "staff") {
    //     return res.status(403).json({ error: "Not authorized" });
    // }

    // Process stock addition/update
    if (stockUpdate) {
      const updates = Array.isArray(stockUpdate) ? stockUpdate : [stockUpdate];

      for (let update of updates) {
        const { stockItemId, quantity, expirationDate } = update;

        // Validate fields
        if (!stockItemId || quantity === undefined || !expirationDate) {
          return res.status(400).json({ error: "Missing required fields." });
        }

        if (new Date(expirationDate) < new Date()) {
          return res.status(400).json({
            error: "Expiration date for item cannot be in the past.",
          });
        }

        // Create a new stock entry for each addition
        if (quantity !== null && quantity !== "") {
          await Stock.create({
            stockItemId,
            initialQuantity: quantity,
            currentQuantity: quantity,
            expirationDate,
          });
        }
      }
    }
    console.log("stockUpdate is running:", stockUpdate); // Log the stock update details

    // Process stock deletion
    if (stockDeletion) {
      const deletions = Array.isArray(stockDeletion) ? stockDeletion : [stockDeletion];

      if (deletions.length === 0) {
        return res.status(400).json({ error: "No stock items to delete." });
      }

      for (let deletion of deletions) {
        const { stockItemId } = deletion; // payload must contain the stock ID
        await Stock.deleteMany({ stockItemId }); // Remove all stocks for this item
        await StockItem.findByIdAndDelete(stockItemId); // Delete the stock item
      }
    }

    console.log("stockDelete is running");

    return res.status(200).json({ message: "Stocks updated successfully", stockUpdate }); // Return the stockUpdate details
  } catch (err) {
    console.log("error: ", err);
    return res.status(500).json({ error: "Error updating stocks" });
  }
});


module.exports = router;
