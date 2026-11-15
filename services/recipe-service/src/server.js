const express = require("express");
const { Pool } = require("pg");

const PORT = Number(process.env.PORT || 3001);

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "recipeapp",
  user: process.env.DB_USER || "recipeapp",
  password: process.env.DB_PASSWORD || "recipeapp"
});

const app = express();
app.use(express.json());

function wrap(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

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

function validateRecipe(body) {
  if (!body.title || !body.description || !body.instructions) {
    return "Title, description, and instructions are required.";
  }

  if (!Array.isArray(body.ingredients) || body.ingredients.length === 0) {
    return "At least one ingredient is required.";
  }

  return null;
}

app.get("/health", wrap(async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ service: "recipe-service", status: "ok" });
  } catch (error) {
    res.status(500).json({ service: "recipe-service", status: "error" });
  }
}));

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

  const ingredients = req.body.ingredients.map((value) => value.trim()).filter(Boolean);
  if (ingredients.length === 0) {
    return res.status(400).json({ error: "At least one ingredient is required." });
  }

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

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Unexpected recipe-service error." });
});

app.listen(PORT, () => {
  console.log(`recipe-service listening on port ${PORT}`);
});
