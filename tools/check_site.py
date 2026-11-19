#!/usr/bin/env python3
"""Checks EasyRecipes for broken local links/images and recipe data that is out of sync.

Run from the repository root:  python3 tools/check_site.py
"""
import json
import os
import re
import sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {".git", "templates", "node_modules"}


class Refs(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs, self.recipe_id = [], None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for key in ("href", "src"):
            if a.get(key):
                self.refs.append(a[key])
        if a.get("data-recipe-id"):
            self.recipe_id = a["data-recipe-id"]


def is_local(url):
    return not re.match(r"^(https?:|mailto:|tel:|data:|#|javascript:)", url) and not url.startswith("//")


def main():
    errors = []
    pages = sorted(f for f in os.listdir(ROOT) if f.endswith(".html"))
    recipe_pages = {}
    for page in pages:
        parser = Refs()
        parser.feed(open(os.path.join(ROOT, page), encoding="utf-8").read())
        if parser.recipe_id:
            recipe_pages[parser.recipe_id] = page
        for ref in parser.refs:
            if not is_local(ref) or page == "404.html":
                continue
            path = ref.split("#")[0].split("?")[0]
            if path and not os.path.exists(os.path.join(ROOT, path)):
                errors.append(f"{page}: broken link -> {ref}")

    src = open(os.path.join(ROOT, "assets/js/recipes.js"), encoding="utf-8").read()
    data = json.loads(src[src.index("{"):src.rindex("}") + 1])
    cat_ids = {c["id"] for c in data["categories"]}
    for c in data["categories"]:
        if not os.path.exists(os.path.join(ROOT, c["page"])):
            errors.append(f"category '{c['id']}': page {c['page']} is missing")
        if c["parent"] and c["parent"] not in cat_ids:
            errors.append(f"category '{c['id']}': unknown parent '{c['parent']}'")
    seen = set()
    for r in data["recipes"]:
        rid = r["id"]
        if rid in seen:
            errors.append(f"recipe '{rid}': listed twice in recipes.js")
        seen.add(rid)
        if not os.path.exists(os.path.join(ROOT, f"{rid}.html")):
            errors.append(f"recipe '{rid}': {rid}.html is missing")
        elif recipe_pages.get(rid) != f"{rid}.html":
            errors.append(f"recipe '{rid}': {rid}.html needs data-recipe-id=\"{rid}\" on its <article>")
        for img in (f"images/{rid}.webp", f"images/thumbs/{rid}.webp"):
            if not os.path.exists(os.path.join(ROOT, img)):
                errors.append(f"recipe '{rid}': {img} is missing")
        for c in r["categories"]:
            if c not in cat_ids:
                errors.append(f"recipe '{rid}': unknown category '{c}'")
    for rid, page in recipe_pages.items():
        if rid not in seen:
            errors.append(f"{page}: recipe '{rid}' is not listed in assets/js/recipes.js")

    if errors:
        print("\n".join(errors))
        print(f"\n{len(errors)} problem(s) found.")
        return 1
    print(f"OK: {len(pages)} pages, {len(data['recipes'])} recipes, {len(data['categories'])} categories.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
