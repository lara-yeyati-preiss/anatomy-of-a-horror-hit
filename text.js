// Keyword analysis module
// - Loads horror movie data
// - Normalizes / filters TMDb keywords
// - Aggregates counts by category and supergroup
// - Exposes results on window and populates keyword tags in the DOM

// Global storage for downstream consumers (e.g., app.js)
window.keywordData = null;

// Immediately invoked async pipeline
;(async () => {
  // Source: manually categorized horror dataset (one row per movie)
  const data = await d3.csv("horror_categorized_clean_manualfix.csv");

  // Keyword normalization: lowercase, trim, collapse whitespace, strip quotes
  const normalize = k =>
    k.toLowerCase().trim()
      .replace(/\s+/g, " ")
      .replace(/^["'\s]+|["'\s]+$/g, "");

  // Exclusions: generic or non-thematic keywords to drop from the analysis
  const excludeKeywords = new Set([
    "sequel",
    "based on novel or book",
    "based on true story",
    "remake",
    "duringcreditsstinger",
    "california",
    "new york city",
    "south korea",
    "japan",
    "halloween"
  ]);

  // Consolidation: map variants to a single canonical keyword
  const keywordMapping = {
    survival: ["survival", "survival horror"],
    haunted: ["haunted", "haunted house", "haunting"],
    supernatural: ["supernatural", "supernatural horror"],
    possession: ["possession", "demonic possession"]
  };

  // Variant → canonical lookup
  const keywordLookup = new Map();
  for (const [canonical, variants] of Object.entries(keywordMapping)) {
    for (const variant of variants) {
      keywordLookup.set(variant, canonical);
    }
  }

  const mapKeyword = k => keywordLookup.get(k) || k;

  // Flatten to (category, keyword) pairs
  const catKwPairs = data.flatMap(d => {
    const cat = d.Fear_Category?.trim();
    const raw = d.TMDb_Keywords;
    if (!cat || !raw) return [];

    const kws = raw
      .split(",")
      .map(normalize)
      .filter(k => k && k !== "n/a" && k !== "na");

    const filtered = kws.filter(k => !excludeKeywords.has(k));

    return filtered.map(k => ({ category: cat, keyword: mapKeyword(k) }));
  });

  // Category × keyword → count
  const counts = d3.rollup(
    catKwPairs,
    v => v.length,
    d => d.category,
    d => d.keyword
  );

  // Top 10 keywords per fear category
  const topPerCategory = Array.from(counts, ([category, kwMap]) => {
    const top = Array.from(kwMap)
      .sort((a, b) => d3.descending(a[1], b[1]))
      .slice(0, 10);
    return { category, top_keywords: top };
  });

  // Supergroup definitions
  const supergroups = {
    "Societal & Structural Horrors": [
      "Invasion, Impostors & Paranoia",
      "Persecution & Social Breakdown",
      "Institutional & Structural Control"
    ],
    "Psychological & Domestic Horrors": [
      "Possession & Loss of Agency",
      "Isolation & Psychological Unraveling",
      "Grief & Familial Trauma"
    ],
    "The Body as Battleground": [
      "Captivity & Voyeuristic Sadism",
      "Contagion & Mutation",
      "Body Horror / Envelope Violation"
    ]
  };

  // Aggregate keywords by supergroup
  const supergroupKeywords = {};
  for (const [supergroupName, categories] of Object.entries(supergroups)) {
    const supergroupPairs = catKwPairs.filter(d =>
      categories.includes(d.category)
    );

    const supergroupCounts = d3.rollup(
      supergroupPairs,
      v => v.length,
      d => d.keyword
    );

    const topKeywords = Array.from(supergroupCounts)
      .sort((a, b) => d3.descending(a[1], b[1]))
      .slice(0, 10);

    supergroupKeywords[supergroupName] = topKeywords;
  }

  // Global top 10 keywords (across all categories)
  const allKeywordCounts = d3.rollup(
    catKwPairs,
    v => v.length,
    d => d.keyword
  );

  const top10Overall = Array.from(allKeywordCounts)
    .sort((a, b) => d3.descending(a[1], b[1]))
    .slice(0, 10);

  // Public API on window
  window.keywordData = topPerCategory;
  window.supergroupKeywords = supergroupKeywords;
  window.top10Keywords = top10Overall;

  // Notify listeners that keyword data is available
  window.dispatchEvent(
    new CustomEvent("keywordsLoaded", { detail: topPerCategory })
  );

  // Initial DOM render
  populateKeywords();
})();

// Convenience helper: top N keywords for a given fear category
window.getTopKeywords = (categoryName, limit = 10) => {
  if (!window.keywordData) return [];
  const categoryData = window.keywordData.find(
    d => d.category === categoryName
  );
  return categoryData ? categoryData.top_keywords.slice(0, limit) : [];
};

// Render keyword tags into mapped containers
function populateKeywords() {
  const containerMapping = [
    { id: "overall-keywords", type: "overall" },
    {
      id: "societal-keywords",
      type: "supergroup",
      name: "Societal & Structural Horrors"
    },
    {
      id: "psychological-keywords",
      type: "supergroup",
      name: "Psychological & Domestic Horrors"
    },
    {
      id: "body-keywords",
      type: "supergroup",
      name: "The Body as Battleground"
    }
  ];

  containerMapping.forEach(({ id, type, name }) => {
    const container = document.getElementById(id);
    if (!container) {
      console.warn(`Keyword container not found: ${id}`);
      return;
    }

    let keywords = [];

    if (type === "overall") {
      if (window.top10Keywords) {
        keywords = window.top10Keywords.filter(([, count]) => count >= 3);
      }
    } else if (type === "supergroup") {
      if (window.supergroupKeywords && window.supergroupKeywords[name]) {
        keywords = window.supergroupKeywords[name].filter(
          ([, count]) => count >= 3
        );
      }
    }

    if (keywords.length > 0) {
      container.innerHTML = keywords
        .map(
          ([keyword, count]) => `
          <div class="keyword-tag">
            <span class="keyword-name">${keyword}</span>
            <span class="keyword-count">${count}</span>
          </div>
        `
        )
        .join("");
    } else {
      container.innerHTML =
        '<span class="keyword-loading">No keywords found</span>';
    }
  });
}
