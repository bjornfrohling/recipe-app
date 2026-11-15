const express = require("express");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const RECIPE_SERVICE_URL =
  process.env.RECIPE_SERVICE_URL || "http://localhost:3001";
const REVIEW_SERVICE_URL =
  process.env.REVIEW_SERVICE_URL || "http://localhost:3002";

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function wrap(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

async function forwardJson({ url, method = "GET", body }) {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  return { ok: response.ok, status: response.status, json };
}

app.get("/api/health", wrap(async (_req, res) => {
  sendJson(res, 200, {
    service: "web",
    status: "ok",
    recipeServiceUrl: RECIPE_SERVICE_URL,
    reviewServiceUrl: REVIEW_SERVICE_URL
  });
}));

app.get("/api/recipes", wrap(async (_req, res) => {
  try {
    const result = await forwardJson({ url: `${RECIPE_SERVICE_URL}/recipes` });
    sendJson(res, result.status, result.json);
  } catch (error) {
    sendJson(res, 502, { error: "Recipe service unavailable" });
  }
}));

app.post("/api/recipes", wrap(async (req, res) => {
  try {
    const result = await forwardJson({
      url: `${RECIPE_SERVICE_URL}/recipes`,
      method: "POST",
      body: req.body
    });
    sendJson(res, result.status, result.json);
  } catch (error) {
    sendJson(res, 502, { error: "Recipe service unavailable" });
  }
}));

app.get("/api/recipes/:id", wrap(async (req, res) => {
  try {
    const result = await forwardJson({
      url: `${RECIPE_SERVICE_URL}/recipes/${req.params.id}`
    });
    sendJson(res, result.status, result.json);
  } catch (error) {
    sendJson(res, 502, { error: "Recipe service unavailable" });
  }
}));

app.get("/api/recipes/:id/reviews", wrap(async (req, res) => {
  try {
    const result = await forwardJson({
      url: `${REVIEW_SERVICE_URL}/reviews?recipeId=${encodeURIComponent(
        req.params.id
      )}`
    });
    sendJson(res, result.status, result.json);
  } catch (error) {
    sendJson(res, 502, { error: "Review service unavailable" });
  }
}));

app.post("/api/recipes/:id/reviews", wrap(async (req, res) => {
  try {
    const result = await forwardJson({
      url: `${REVIEW_SERVICE_URL}/reviews`,
      method: "POST",
      body: {
        recipeId: req.params.id,
        reviewerName: req.body.reviewerName,
        rating: req.body.rating,
        comment: req.body.comment
      }
    });
    sendJson(res, result.status, result.json);
  } catch (error) {
    sendJson(res, 502, { error: "Review service unavailable" });
  }
}));

app.use((error, _req, res, _next) => {
  console.error(error);
  sendJson(res, 500, { error: "Unexpected web service error" });
});

app.listen(PORT, () => {
  console.log(`web service listening on port ${PORT}`);
});
