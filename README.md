# EasyRecipes

A collection of home-cooked recipes, published with GitHub Pages:
**https://tylerishim-coder.github.io/RecipeWebsite/**

It's a plain static site (HTML, CSS and JavaScript). There's no build step and nothing to install.

## Features

- **Search as you type**: matches recipe names, nicknames, categories and ingredients, tolerates typos ("chiken", "salmn"), and understands phrases like "under 30 min".
- **Browse and filter**: every category page can be filtered by subcategory and cooking time, and sorted A–Z, by quickest or by newest.
- **Recipe pages**:
  - a servings scaler that recalculates ingredient amounts
  - ingredient and step checklists that remember your progress
  - tap-to-start timers on any time in the directions
  - cook mode, which keeps the screen awake
  - print and share buttons
  - related recipes
- **Favorites and recently viewed**: stored in the browser, so no account is needed.
- **Responsive, dark mode, accessible**, with SEO recipe markup (schema.org `Recipe`), so recipes can show up as rich results in Google.

## Run it locally

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Project layout

| Path | What it is |
| --- | --- |
| `index.html` | Homepage |
| `recipes.html` | All recipes plus search results (`recipes.html?q=garlic`) |
| `favorites.html` | Saved recipes |
| `all*.html`, `main.html`, `appetizer.html`, `asian.html`, `chinese.html`, `groundbeef.html`, `tyler.html` | Category pages, filled in automatically from the recipe data |
| `<recipe>.html` | One page per recipe |
| `assets/js/recipes.js` | **The recipe list**: titles, categories, times, search nicknames |
| `assets/js/site.js` | Header, search, recipe cards, favorites and category pages |
| `assets/js/recipe.js` | Recipe page features (scaler, timers, checklists, cook mode) |
| `assets/css/site.css` | All styles |
| `images/` | Recipe photos (`images/<id>.webp`) and thumbnails (`images/thumbs/<id>.webp`) |
| `templates/recipe-template.html` | Starting point for a new recipe |
| `tools/check_site.py` | Finds broken links, missing photos and recipes missing from the data file |

## Adding a recipe

1. Copy `templates/recipe-template.html` to the repo root and name it after the recipe, e.g. `lemonbars.html`.
2. Fill in the title, ingredients, directions and credit. Start each ingredient line with its amount so the servings scaler can scale it.
3. Add photos:
   - `images/lemonbars.webp`, about 1200px wide
   - `images/thumbs/lemonbars.webp`, about 600px wide

   Any image editor or [squoosh.app](https://squoosh.app) can export WebP.
4. Add one line to the `recipes` list in `assets/js/recipes.js`:

   ```js
   {"id": "lemonbars", "title": "Lemon Bars", "categories": ["desserts"], "time": "1 hr", "minutes": 60, "servings": "16", "featured": false, "added": "2025-03-01", "aliases": ["lemon squares"], "ingredients": "lemon butter flour sugar eggs"},
   ```

   - `categories` uses the ids from the `categories` list at the top of the file (e.g. `pasta`, `chicken`, `fish`). A recipe in a subcategory such as `salmon` also appears on its parent pages (`fish`, `seafood`).
   - `aliases` are extra search terms and nicknames. `ingredients` is a list of keywords for ingredient search.
   - `featured: true` puts the recipe in Chef's favorites on the homepage.
5. Check for mistakes:

   ```sh
   python3 tools/check_site.py
   ```

   This check also runs on every pull request.

## Adding a category

Add an entry to `categories` in `assets/js/recipes.js`: `id`, display `name`, `page`, optional `parent` and a short `blurb`. Then copy an existing category page (such as `allsalmon.html`) to the new `page` file and update its title, heading and `data-category` attribute.
