const express = require("express");
const { Pool } = require("pg");

const PORT = Number(process.env.PORT || 3002);
const RECIPE_SERVICE_URL =
  process.env.RECIPE_SERVICE_URL || "http://localhost:3001";

// Reuse database connection
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "recipeapp",
  user: process.env.DB_USER || "recipeapp",
  password: process.env.DB_PASSWORD || "recipeapp"
});

const app = express();
app.use(express.json());

// Pass rejected async handlers to Express error middleware
function wrap(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

// Convert database column names into JSON
function reviewFromRow(row) {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    reviewerName: row.reviewer_name,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at
  };
}

// Validate the normalized payload
function validateReview(body) {
  if (!body.recipeId || !body.reviewerName || !body.comment) {
    return "recipeId, reviewerName, and comment are required.";
  }

  if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
    return "rating must be an integer from 1 to 5.";
  }

  return null;
}

// 2xx recipe responses are treated as an existing recipe
// Non-2xx responses return false
async function recipeExists(recipeId) {
  const response = await fetch(`${RECIPE_SERVICE_URL}/recipes/${recipeId}`);
  return response.ok;
}

// Check the database connection
app.get("/health", wrap(async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ service: "review-service", status: "ok" });
  } catch (error) {
    res.status(500).json({ service: "review-service", status: "error" });
  }
}));

app.get("/reviews", wrap(async (req, res) => {
  const { recipeId } = req.query;

  // Filter by recipe when requested; else return reviews for all recipes.
  if (recipeId) {
    const numericRecipeId = Number(recipeId);
    if (!Number.isInteger(numericRecipeId) || numericRecipeId < 1) {
      return res.status(400).json({ error: "recipeId must be a positive integer." });
    }

    const { rows } = await pool.query(
      `SELECT id, recipe_id, reviewer_name, rating, comment, created_at
       FROM reviews
       WHERE recipe_id = $1
       ORDER BY id DESC`,
      [numericRecipeId]
    );

    return res.json({ reviews: rows.map(reviewFromRow) });
  }

  // Pass the ID as a query parameter
  const { rows } = await pool.query(
    `SELECT id, recipe_id, reviewer_name, rating, comment, created_at
     FROM reviews
     ORDER BY id DESC`
  );

  return res.json({ reviews: rows.map(reviewFromRow) });
}));

// Normalize input before validating and storing the review
app.post("/reviews", wrap(async (req, res) => {
  const payload = {
    recipeId: Number(req.body.recipeId),
    reviewerName: req.body.reviewerName ? req.body.reviewerName.trim() : "",
    rating: Number(req.body.rating),
    comment: req.body.comment ? req.body.comment.trim() : ""
  };

  const error = validateReview(payload);
  if (error) {
    return res.status(400).json({ error });
  }

  // Validate the recipe exists before writing to the db
  const exists = await recipeExists(payload.recipeId);
  if (!exists) {
    return res.status(400).json({ error: "Recipe does not exist." });
  }

  // RETURNING provides the stored row and its generated ID
  const { rows } = await pool.query(
    `INSERT INTO reviews (recipe_id, reviewer_name, rating, comment)
     VALUES ($1, $2, $3, $4)
     RETURNING id, recipe_id, reviewer_name, rating, comment, created_at`,
    [payload.recipeId, payload.reviewerName, payload.rating, payload.comment]
  );

  return res.status(201).json({ review: reviewFromRow(rows[0]) });
}));

// Log unexpected errors on the server and return a generic response
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Unexpected review-service error." });
});

app.listen(PORT, () => {
  console.log(`review-service listening on port ${PORT}`);
});
