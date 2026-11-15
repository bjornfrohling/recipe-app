const recipesElement = document.getElementById("recipes");
const recipesEmptyElement = document.getElementById("recipes-empty");
const selectedRecipeElement = document.getElementById("selected-recipe");
const recipeDetailsElement = document.getElementById("recipe-details");
const detailTitleElement = document.getElementById("detail-title");
const detailDescriptionElement = document.getElementById("detail-description");
const detailIngredientsElement = document.getElementById("detail-ingredients");
const detailInstructionsElement = document.getElementById("detail-instructions");
const reviewSummaryElement = document.getElementById("review-summary");
const reviewsElement = document.getElementById("reviews");
const reviewsEmptyElement = document.getElementById("reviews-empty");
const reviewRecipeIdElement = document.getElementById("review-recipe-id");
const statusElement = document.getElementById("status");

let selectedRecipeId = null;

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.className = isError ? "error" : "success";
}

function clearStatus() {
  statusElement.textContent = "";
  statusElement.className = "";
}

function renderRecipes(recipes) {
  recipesElement.innerHTML = "";
  recipesEmptyElement.style.display = recipes.length ? "none" : "block";

  for (const recipe of recipes) {
    const card = document.createElement("article");
    card.className = "recipe-card";

    const title = document.createElement("h3");
    title.textContent = recipe.title;

    const description = document.createElement("p");
    description.textContent = recipe.description;

    const button = document.createElement("button");
    button.textContent = "View details";
    button.addEventListener("click", () => loadRecipeDetails(recipe.id));

    card.append(title, description, button);
    recipesElement.append(card);
  }
}

function renderRecipeDetails(recipe, reviews) {
  selectedRecipeId = recipe.id;
  selectedRecipeElement.classList.add("hidden");
  recipeDetailsElement.classList.remove("hidden");

  detailTitleElement.textContent = recipe.title;
  detailDescriptionElement.textContent = recipe.description;
  detailInstructionsElement.textContent = recipe.instructions;
  reviewRecipeIdElement.value = recipe.id;

  detailIngredientsElement.innerHTML = "";
  for (const ingredient of recipe.ingredients) {
    const item = document.createElement("li");
    item.textContent = ingredient;
    detailIngredientsElement.append(item);
  }

  reviewsElement.innerHTML = "";
  reviewsEmptyElement.style.display = reviews.length ? "none" : "block";

  const average =
    reviews.length === 0
      ? "No ratings yet"
      : `Average rating: ${(
          reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
        ).toFixed(1)} / 5`;
  reviewSummaryElement.textContent = `${average} • ${reviews.length} review(s)`;

  for (const review of reviews) {
    const card = document.createElement("article");
    card.className = "review-card";

    const heading = document.createElement("h5");
    heading.textContent = `${review.reviewerName} rated this ${review.rating}/5`;

    const comment = document.createElement("p");
    comment.textContent = review.comment;

    card.append(heading, comment);
    reviewsElement.append(card);
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload;
}

async function loadRecipes() {
  try {
    const payload = await fetchJson("/api/recipes");
    renderRecipes(payload.recipes);
  } catch (error) {
    setStatus(error.message, true);
  }
}

async function loadRecipeDetails(recipeId) {
  clearStatus();
  try {
    const [recipePayload, reviewPayload] = await Promise.all([
      fetchJson(`/api/recipes/${recipeId}`),
      fetchJson(`/api/recipes/${recipeId}/reviews`)
    ]);

    renderRecipeDetails(recipePayload.recipe, reviewPayload.reviews);
  } catch (error) {
    setStatus(error.message, true);
  }
}

document.getElementById("recipe-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearStatus();

  const payload = {
    title: document.getElementById("title").value.trim(),
    description: document.getElementById("description").value.trim(),
    ingredients: document
      .getElementById("ingredients")
      .value.split("\n")
      .map((value) => value.trim())
      .filter(Boolean),
    instructions: document.getElementById("instructions").value.trim()
  };

  try {
    const response = await fetchJson("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    event.target.reset();
    setStatus(`Recipe "${response.recipe.title}" created.`);
    await loadRecipes();
    await loadRecipeDetails(response.recipe.id);
  } catch (error) {
    setStatus(error.message, true);
  }
});

document.getElementById("review-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearStatus();

  const recipeId = reviewRecipeIdElement.value;
  if (!recipeId) {
    setStatus("Select a recipe before adding a review.", true);
    return;
  }

  const payload = {
    reviewerName: document.getElementById("reviewerName").value.trim(),
    rating: Number(document.getElementById("rating").value),
    comment: document.getElementById("comment").value.trim()
  };

  try {
    await fetchJson(`/api/recipes/${recipeId}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    event.target.reset();
    setStatus("Review saved.");
    await loadRecipeDetails(recipeId);
  } catch (error) {
    setStatus(error.message, true);
  }
});

loadRecipes();

