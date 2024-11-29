const router = require("express").Router();
const StockItem = require("../models/stocks/stockItem");
const Stock = require("../models/stocks/stocks");
const MedicalInfo = require("../models/medicalRecords/medicalInfo");
const { encrypt, decrypt } = require("../utils/encryption");

//default route = /charts

// Mapping of stock item names to sickness and insight
const stockInfo = {
  "Alaxan FR 200/325 mg cap": {
    sickness: "Headache, muscle pain",
    insight:
      "Monitor headache cases to identify potential triggers like stress and dehydration. Promote hydration, encourage regular breaks, and provide stress management resources to help reduce occurrences.",
  },
  "Ambroxol HCl RM 30 mg tab": {
    sickness: "Cough, respiratory conditions",
    insight:
      "Encourage students to stay hydrated and use proper coughing techniques. Provide education on managing respiratory symptoms to support recovery.",
  },
  "Amoxicillin Trihydrate RM 500 mg cap": {
    sickness: "Bacterial infections",
    insight:
      "Reinforce hygiene practices and monitor for signs of infection. Encourage timely treatment and communication with parents regarding symptoms.",
  },
  "Antamin 4 mg tab": {
    sickness: "Allergies",
    insight:
      "Identify common allergens in the school environment and provide educational resources on managing allergic reactions effectively.",
  },
  "Asmalin 1 mg/ml Soln for inhalation": {
    sickness: "Asthma",
    insight:
      "Train staff to recognize asthma symptoms and ensure that inhalers are readily available for students. Promote awareness of asthma management.",
  },
  "Biogesic 120 mg/5 ml susp; 250 mg/5 ml susp; 500 mg tab": {
    sickness: "Fever, pain",
    insight:
      "Monitor attendance for symptoms of pain or fever and educate students on appropriate management of these symptoms at home.",
  },
  "Biogesic 250 mg/5 ml susp": {
    sickness: "Fever, pain",
    insight:
      "Monitor attendance for symptoms of pain or fever and educate students on appropriate management of these symptoms at home.",
  },
  "Biogesic 500 mg/5 ml susp": {
    sickness: "Fever, pain",
    insight:
      "Monitor attendance for symptoms of pain or fever and educate students on appropriate management of these symptoms at home.",
  },
  "Buscopan 10 mg tab; Buscopan Venus 10/500 mg tab": {
    sickness: "Abdominal pain, cramps",
    insight:
      "Assess dietary habits and promote healthy eating to reduce instances of abdominal discomfort among students.",
  },
  "Calcisaph 500 mg tab": {
    sickness: "Calcium deficiency",
    insight:
      "Promote awareness of calcium-rich foods and ensure they are available in the cafeteria to support students' nutritional needs.",
  },
  "Cinnarizine RM 25 mg tab": {
    sickness: "Motion sickness, vertigo",
    insight:
      "Educate students on recognizing motion sickness symptoms and provide strategies for managing them during travel.",
  },
  "Cloxacillin Na RM 500 mg cap": {
    sickness: "Bacterial infections",
    insight:
      "Monitor for signs of infection and emphasize the importance of hand hygiene to prevent outbreaks in the school.",
  },
  "Daktarin Oral Gel 20 mg": {
    sickness: "Oral fungal infections",
    insight:
      "Educate students on proper oral hygiene practices to prevent fungal infections and monitor for signs in communal areas.",
  },
  "Decolgen ND 25/500 mg cap": {
    sickness: "Cold, flu symptoms",
    insight:
      "Reinforce sick policies and encourage symptomatic students to stay home to prevent spreading illness.",
  },
  "Diatabs 2 mg cap": {
    sickness: "Diarrhea",
    insight:
      "Promote proper handwashing and hygiene practices among students to prevent the spread of gastrointestinal illnesses.",
  },
  "Dolfenal 500 mg tab": {
    sickness: "Pain, fever",
    insight:
      "Monitor attendance for pain-related issues and provide guidance on managing symptoms effectively.",
  },
  "Domperidone RM 10 mg tab": {
    sickness: "Nausea, vomiting",
    insight:
      "Provide education on recognizing symptoms of nausea and ensure students stay hydrated during illness.",
  },
  "Gastrifar 10 mg tab": {
    sickness: "Gastrointestinal discomfort",
    insight:
      "Promote healthy dietary habits and encourage students to report ongoing gastrointestinal issues.",
  },
  "Hivent 1 mg/ml neb": {
    sickness: "Respiratory conditions",
    insight:
      "Train staff to recognize respiratory distress and ensure nebulizers are available for students who need them.",
  },
  "Kathrex 960 mg tab": {
    sickness: "Pain",
    insight:
      "Monitor attendance for pain-related absences and provide resources for managing chronic pain among students.",
  },
  "Kremil-S 178/233/30 mg tab; Kremil-S Advance 10/800/165 mg tab": {
    sickness: "Heartburn, indigestion",
    insight:
      "Educate students about dietary choices and encourage them to report symptoms for timely intervention.",
  },
  "Medicol Advance 200 mg cap": {
    sickness: "Pain, fever",
    insight:
      "Monitor symptoms of fever and pain, providing guidance on symptom management at home.",
  },
  "Mefenamic Acid RM 500 mg tab": {
    sickness: "Pain, inflammation",
    insight:
      "Monitor attendance patterns related to pain and provide resources for managing menstrual pain and discomfort.",
  },
  "Omepron 20 mg cap": {
    sickness: "Acid reflux, gastrointestinal issues",
    insight:
      "Educate students on recognizing acid reflux symptoms and promote dietary changes for prevention.",
  },
  "Salinase Nasal Drops": {
    sickness: "Nasal congestion",
    insight:
      "Educate students on proper nasal hygiene and encourage hydration to alleviate congestion symptoms.",
  },
  "Solmux 500 mg cap": {
    sickness: "Cough, mucus clearance",
    insight:
      "Emphasize proper coughing techniques and hydration to support respiratory recovery.",
  },
  "Tempra 120 mg/5 ml syrup; 325 mg tab; Tempra Forte 250 mg/5 ml syrup": {
    sickness: "Pain, fever",
    insight:
      "Monitor symptoms of fever and pain, providing guidance on effective management strategies.",
  },
  "Tuseran Forte 15/25/325 mg cap": {
    sickness: "Cough, cold symptoms",
    insight:
      "Promote preventive measures to mitigate the spread of colds and flu among students.",
  },
  "Ventomax 2 mg tab": {
    sickness: "Respiratory issues",
    insight:
      "Train staff to recognize respiratory distress and ensure access to necessary medications for affected students.",
  },
};

router.get("/", async (req, res) => {
  try {
    // Fetch only stock items in the "Medicine" category
    const stockItems = await StockItem.find({ category: "Medicine" });

    const normalizedStockInfo = {};
    for (const [key, value] of Object.entries(stockInfo)) {
      normalizedStockInfo[key.toLowerCase().replace(/\s+/g, "")] = value;
    }

    const results = await Promise.all(
      stockItems.map(async (stockItem) => {
        // Fetch stocks for each stock item
        const stocks = await Stock.find({ stockItemId: stockItem._id });

        // Calculate total consumed quantity
        const totalConsumed = stocks.reduce((sum, stock) => {
          // Check if initialQuantity and currentQuantity are defined
          if (
            stock.initialQuantity !== undefined &&
            stock.currentQuantity !== undefined
          ) {
            return sum + (stock.initialQuantity - stock.currentQuantity);
          }
          return sum;
        }, 0);

        const normalizedName = stockItem.name.toLowerCase().replace(/\s+/g, "");
        const { sickness, insight } = normalizedStockInfo[normalizedName] || {};

        // Return stock item name and total consumed quantity
        return {
          stockItemId: stockItem._id,
          stockItemName: stockItem.name,
          totalConsumed,
          category: stockItem.category,
          sickness,
          insight,
        };
      })
    );

    // Sort by totalConsumed in descending order and get the top 5
    const topConsumedItems = results
      .sort((a, b) => b.totalConsumed - a.totalConsumed)
      .slice(0, 5);

    console.log("r: ", topConsumedItems);

    return res.status(200).json(topConsumedItems);
  } catch (err) {
    console.log("error: ", err);
    return res.status(500).json({ err: "Error fetching stocks" });
  }
});

// Route to get filtered medical data
router.get("/health", async (req, res) => {
  try {
    // Fetching specific fields from MedicalInfo collection
    const medicalInfo = await MedicalInfo.find().select(
      "circulatory heart respiratory allergy specificAllergy lungs psychological specificPsychological"
    );

    // Decrypt and filter the medical data
    const filteredMedicalData = medicalInfo
      .map((record) => {
        // Decrypt the relevant fields, handling undefined values
        return {
          circulatory:
            record.circulatory !== "N/A" && record.circulatory
              ? decrypt(record.circulatory)
              : null,
          heart:
            record.heart !== "N/A" && record.heart
              ? decrypt(record.heart)
              : null,
          respiratory:
            record.respiratory !== "N/A" && record.respiratory
              ? decrypt(record.respiratory)
              : null,
          allergy:
            record.allergy !== "N/A" && record.allergy
              ? decrypt(record.allergy)
              : null,
          specificAllergy:
            record.specificAllergy !== "N/A" && record.specificAllergy
              ? decrypt(record.specificAllergy)
              : null,
          lungs:
            record.lungs !== "N/A" && record.lungs
              ? decrypt(record.lungs)
              : null,
          psychological:
            record.psychological !== "N/A" && record.psychological
              ? decrypt(record.psychological)
              : null,
          specificPsychological:
            record.specificPsychological !== "N/A" &&
            record.specificPsychological
              ? decrypt(record.specificPsychological)
              : null,
        };
      })
      .reduce((acc, record) => {
        // Count occurrences of non-N/A values across all records
        if (
          (record.circulatory !== "N/A" &&
            record.circulatory !== null &&
            record.circulatory !== undefined) ||
          (record.heart !== "N/A" &&
            record.heart !== null &&
            record.heart !== undefined)
        ) {
          if (!acc["Heart disease"]) {
            acc["Heart disease"] = 0;
          }
          acc["Heart disease"]++;
        }
        if (
          record.respiratory !== "N/A" &&
          record.respiratory !== null &&
          record.respiratory !== undefined
        ) {
          if (!acc["Asthma"]) {
            acc["Asthma"] = 0;
          }
          acc["Asthma"]++;
        }
        if (
          (record.allergy !== "N/A" &&
            record.allergy !== null &&
            record.allergy !== undefined) ||
          (record.specificAllergy !== "N/A" &&
            record.specificAllergy !== null &&
            record.specificAllergy !== undefined)
        ) {
          if (!acc["Allrgey"]) {
            acc["Allrgey"] = 0;
          }
          acc["Allrgey"]++;
        }
        if (
          record.lungs !== "N/A" &&
          record.lungs !== null &&
          record.lungs !== undefined
        ) {
          if (!acc["Ptb"]) {
            acc["Ptb"] = 0;
          }
          acc["Ptb"]++;
        }
        if (
          (record.psychological !== "N/A" &&
            record.psychological !== null &&
            record.psychological !== undefined) ||
          (record.specificPsychological !== "N/A" &&
            record.specificPsychological !== null &&
            record.specificPsychological !== undefined)
        ) {
          if (!acc["Mental"]) {
            acc["Mental"] = 0;
          }
          acc["Mental"]++;
        }
        return acc;
      }, {});

    // Define all possible health concerns
    const allHealthConcerns = [
      "Heart disease",
      "Asthma",
      "Allergy",
      "Ptb",
      "Mental",
    ];

    // Ensure all health concerns are represented in the output
    const healthConcerns = allHealthConcerns.map((concern) => ({
      name: concern,
      counts: filteredMedicalData[concern] || 0, // Default to 0 if not found
    }));

    return res.status(200).json(healthConcerns);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
