const express = require("express");
const { Pool } = require("pg");

const PORT = Number(process.env.PORT || 3001);

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

// Convert database column names into JSON returned by the API
function recipeFromRow(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    ingredients: Array.isArray(row.ingredients) ? row.ingredients : [],
    instructions: row.instructions,
    createdAt: row.created_at
  };
}

// Check required fields before attempting to insert a recipe
function validateRecipe(body) {
  if (!body.title || !body.description || !body.instructions) {
    return "Title, description, and instructions are required.";
  }

  if (!Array.isArray(body.ingredients) || body.ingredients.length === 0) {
    return "At least one ingredient is required.";
  }

  return null;
}

// Check database connectivity
app.get("/health", wrap(async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ service: "recipe-service", status: "ok" });
  } catch (error) {
    res.status(500).json({ service: "recipe-service", status: "error" });
  }
}));

// Return the most recently inserted recipes first
app.get("/recipes", wrap(async (_req, res) => {
  const { rows } = await pool.query(
    `SELECT id, title, description, ingredients, instructions, created_at
     FROM recipes
     ORDER BY id DESC`
  );

  res.json({ recipes: rows.map(recipeFromRow) });
}));

app.get("/recipes/:id", wrap(async (req, res) => {
  const recipeId = Number(req.params.id);
  if (!Number.isInteger(recipeId) || recipeId < 1) {
    return res.status(400).json({ error: "Recipe id must be a positive integer." });
  }

  // Pass the ID separately to treat as a value
  const { rows } = await pool.query(
    `SELECT id, title, description, ingredients, instructions, created_at
     FROM recipes
     WHERE id = $1`,
    [recipeId]
  );

  if (rows.length === 0) {
    return res.status(404).json({ error: "Recipe not found." });
  }

  return res.json({ recipe: recipeFromRow(rows[0]) });
}));

app.post("/recipes", wrap(async (req, res) => {
  const error = validateRecipe(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  // Remove whitespace-only ingredient entries before storing the array
  const ingredients = req.body.ingredients.map((value) => value.trim()).filter(Boolean);
  if (ingredients.length === 0) {
    return res.status(400).json({ error: "At least one ingredient is required." });
  }

  // Store ingredients as JSONB and return the db-generated row
  const { rows } = await pool.query(
    `INSERT INTO recipes (title, description, ingredients, instructions)
     VALUES ($1, $2, $3::jsonb, $4)
     RETURNING id, title, description, ingredients, instructions, created_at`,
    [
      req.body.title.trim(),
      req.body.description.trim(),
      JSON.stringify(ingredients),
      req.body.instructions.trim()
    ]
  );

  return res.status(201).json({ recipe: recipeFromRow(rows[0]) });
}));

// Log unexpected errors on the server and return a generic response
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Unexpected recipe-service error." });
});

app.listen(PORT, () => {
  console.log(`recipe-service listening on port ${PORT}`);
});
