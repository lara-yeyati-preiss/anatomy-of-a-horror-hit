async function main() {
  // Core SVG layers
  const svg     = d3.select("#viz");
  const gRoot   = svg.append("g").attr("class", "chart-root");
  const gChart  = gRoot.append("g").attr("class", "chart-layer");
  const gAxis   = gRoot.append("g").attr("class", "axes-layer");
  const gLegend = gRoot.append("g").attr("class", "legend-layer");

  const titleEl    = d3.select("#chart-title");
  const subtitleEl = d3.select("#chart-subtitle");
  const tooltip    = d3.select(".tooltip");

  const posterWall     = d3.select("#poster-wall");
  const posterWallGrid = posterWall.select(".poster-wall-grid");
  const mapWrapper     = d3.select("#map-wrapper");

  const width  = 1000;
  const height = 720;
  const margin = { top: 60, right: 220, bottom: 120, left: 80 };

  // ===============================
  // Poster wall helpers
  // ===============================

  const POSTER_URLS = window.POSTER_URLS || [];

  function setTitleForPosters() {
    titleEl.text("What Are We Afraid of?");
    subtitleEl.style("opacity", 0.9);
  }

  function positionPosterWallToSVG() {
    const svgNode = svg.node();
    const graphicNode = d3.select(".graphic").node();
    if (!svgNode || !graphicNode) return;

    const svgBox = svgNode.getBoundingClientRect();
    const cardBox = graphicNode.getBoundingClientRect();

    const top  = svgBox.top  - cardBox.top;
    const left = svgBox.left - cardBox.left;

    posterWall
      .style("top",   `${top}px`)
      .style("left",  `${left}px`)
      .style("width",  `${svgBox.width}px`)
      .style("height", `${svgBox.height}px`);
  }

  function positionMapWrapperToSVG(extraHeight = 0) {
    const svgNode = svg.node();
    const graphicNode = d3.select(".graphic").node();
    if (!svgNode || !graphicNode) return;

    const svgBox = svgNode.getBoundingClientRect();
    const cardBox = graphicNode.getBoundingClientRect();

    const top  = svgBox.top  - cardBox.top;
    const left = svgBox.left - cardBox.left;

    mapWrapper
      .style("top",   `${top}px`)
      .style("left",  `${left}px`)
      .style("width",  `${svgBox.width}px`)
      .style("height", `${svgBox.height + extraHeight}px`);
  }

  // Fit as many 2:3 tiles as possible in the SVG area
  function layoutPosterGrid(rows) {
    positionPosterWallToSVG();

    const gap   = 6;
    const wrapW = posterWall.node().clientWidth  || width;
    const wrapH = posterWall.node().clientHeight || height;
    const ar    = 2 / 3; // w/h

    let best = null;
    for (let cols = 4; cols <= 12; cols++) {
      const tileW = (wrapW - (cols - 1) * gap) / cols;
      const tileH = tileW / ar;
      const rowsCount  = Math.floor((wrapH + gap) / (tileH + gap));
      if (rowsCount < 1) continue;

      const count = cols * rowsCount;
      const usedH = rowsCount * (tileH + gap) - gap;
      const leftover = Math.abs(wrapH - usedH);

      if (!best || leftover < best.leftover) {
        best = { cols, rows: rowsCount, tileW, tileH, count, leftover };
      }
    }
    if (!best) return [];

    posterWallGrid
      .style("grid-template-columns", `repeat(${best.cols}, 1fr)`)
      .style("gap", `${gap}px`);

    return rows.slice(0, best.count);
  }

  function renderPosterWall(data) {
    const use = layoutPosterGrid(data);

    const sel = posterWallGrid
      .selectAll("img.poster")
      .data(use, d => d.poster);

    const posters = sel.join(
      enter =>
        enter
          .append("img")
          .attr("class", "poster")
          .attr("alt", d => d.title || "Poster")
          .attr("loading", "lazy")
          .attr("decoding", "async")
          .attr("src", d => d.poster)
          .style("opacity", 0)
          .on("error", function (event, d) {
            d3.select(this).remove();
            posterRows = posterRows.filter(p => p.poster !== d.poster);
            renderPosterWall(posterRows);
          })
          .transition()
          .duration(350)
          .style("opacity", 1),

      update =>
        update
          .attr("alt", d => d.title || "Poster")
          .attr("src", d => d.poster),

      exit => exit.remove()
    );

    posters
      .on("mouseover", (event, d) => {
        const countries = d.country || "Unknown";
        const label =
          countries.includes(",") ? "Production countries:" : "Production country:";

        tooltip
          .style("opacity", 1)
          .html(
            `<strong>${d.title || "Untitled"}</strong><br/>` +
            `<span style="font-size:12px;color:#666;">${label}</span> ` +
            `${countries}`
          );
      })
      .on("mousemove", event => {
        tooltip
          .style("left", event.clientX + 15 + "px")
          .style("top", event.clientY + 15 + "px");
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
      });

    }
  async function showPosterWall() {
    setTitleForPosters();
    positionPosterWallToSVG();

    const data = await ensureFearAndPosters();
    if (!data.length) return;

    renderPosterWall(data);

    const node = posterWall.node();
    if (node && node.parentNode) {
      node.parentNode.appendChild(node);
    }
    node.style.zIndex = "10";
    node.style.position = "absolute";

    posterWall
      .style("display", "block")
      .attr("aria-hidden", "false")
      .transition()
      .duration(300)
      .style("opacity", 1);
  }

  function hidePosterWall() {
    posterWall
      .transition().duration(220)
      .style("opacity", 0)
      .on("end", () => {
        posterWall
          .style("display", "none")
          .attr("aria-hidden", "true");
        posterWallGrid.selectAll("img.poster").remove();
      });
  }

  window.addEventListener("resize", () => {
    if (posterWall.style("display") === "block") {
      positionPosterWallToSVG();
      if (posterRows && posterRows.length) {
        renderPosterWall(posterRows);
      }
    }
  });

  // ===============================
  // Map overlay
  // ===============================

  function showWorldMap() {
    hideFineNote();
    hidePosterWall();

    d3.select(".graphic").classed("map-mode", true);

    positionMapWrapperToSVG(40);

    d3.select("#viz")
      .style("opacity", 0)
      .style("pointer-events", "none");

    d3.select("#chart-title").style("opacity", 1);
    d3.select("#chart-subtitle").style("opacity", 1);

    mapWrapper
      .style("display", "block")
      .attr("aria-hidden", "false")
      .transition()
      .duration(300)
      .style("opacity", 1)
      .on("end", () => {
        if (window.horrorMap && window.horrorMap.resize) {
          window.horrorMap.resize();
        }
      });
  }

  function hideWorldMap() {
    mapWrapper
      .transition().duration(220)
      .style("opacity", 0)
      .on("end", () => {
        mapWrapper
          .style("display", "none")
          .attr("aria-hidden", "true");
      });

    d3.select(".graphic").classed("map-mode", false);

    svg
      .style("opacity", 1)
      .style("pointer-events", "auto");
  }

  // ===============================
  // Color / thresholds
  // ===============================

  const RANGE_COLORS = [
    "#d4d3d3ff", 
    "#b3a59e", 
    "#6e575a", 
    "#57323a", 
    "#43262d", 
    "#1a070c"  
  ];

  const LEGEND_THRESHOLDS = [100, 400, 800, 1500, 2500, Infinity];

  function getBubbleColor(count) {
    for (let i = 0; i < LEGEND_THRESHOLDS.length; i++) {
      if (count <= LEGEND_THRESHOLDS[i]) return RANGE_COLORS[i];
    }
    return RANGE_COLORS[RANGE_COLORS.length - 1];
  }

  // ===============================
  // Fine-note helpers
  // ===============================

  const showFineNote = () =>
    d3.select(".fine-note").classed("note-hidden", false);
  const hideFineNote = () =>
    d3.select(".fine-note").classed("note-hidden", true);

  // ===============================
  // Global state
  // ===============================

  let mode = "none";
  let fearRows = null;
  let posterRows = null;
  let quadrantsAdded = false;
  let isHorrorFocused = false;

  // ===============================
  // Fear categories & groups
  // ===============================

  const FEAR_CATEGORY_NAMES = [
    "Invasion, Impostors & Paranoia",
    "Persecution & Social Breakdown",
    "Institutional & Structural Control",
    "Possession & Loss of Agency",
    "Captivity & Voyeuristic Sadism",
    "Contagion & Mutation",
    "Body Horror / Envelope Violation",
    "Ecological / Natural Menace",
    "Isolation & Psychological Unraveling",
    "Grief & Familial Trauma",
    "Transgression & Moral Punishment"
  ];

  const FEAR_SET = new Set(FEAR_CATEGORY_NAMES);

  const getDisplayName = (categoryName) => {
    if (categoryName === "Body Horror / Envelope Violation") {
      return "Body Horror";
    }
    return categoryName;
  };

  const FEAR_CATEGORY_DESCRIPTIONS = {
    "Invasion, Impostors & Paranoia":
      "Fear of being replaced, infiltrated, or observed by hidden others — doubles, aliens, or unseen conspirators disrupting normal life.",
    "Persecution & Social Breakdown":
      "Fear of mob violence, cult domination, or the collapse of moral order — when collective madness replaces reason and safety.",
    "Institutional & Structural Control":
      "Fear of domination by organized systems — governments, corporations, cults, or algorithms that erase autonomy and identity.",
    "Possession & Loss of Agency":
      "Fear of losing control of one's mind or body to supernatural or psychological forces — demonic, psychic, or manipulative influence.",
    "Captivity & Voyeuristic Sadism":
      "Fear of imprisonment, coercion, and deliberate human cruelty — torture or sadistic games that turn pain into spectacle.",
    "Contagion & Mutation":
      "Fear of infection or involuntary biological transformation — viruses, parasites, or spreading contamination altering the body.",
    "Body Horror":
      "Fear of bodily invasion, forced metamorphosis, or dismemberment — the body manipulated or remade beyond recognition.",
    "Ecological / Natural Menace":
      "Fear of nature turning hostile — animals, weather, or landscapes striking back against human control and exploitation.",
    "Isolation & Psychological Unraveling":
      "Fear that solitude itself becomes the menace — prolonged isolation leading to paranoia, madness, and collapse of meaning.",
    "Grief & Familial Trauma":
      "Fear rooted in loss, inheritance, or haunted familial bonds — when family, grief, or lineage becomes the source of horror.",
    "Transgression & Moral Punishment":
      "Fear of violating sacred or moral boundaries and suffering retribution — curses, pacts, or divine punishment for human sin."
  };

  const FEAR_GROUP_MAP = new Map([
    ["Invasion, Impostors & Paranoia", "Societal & Structural Horrors"],
    ["Persecution & Social Breakdown", "Societal & Structural Horrors"],
    ["Institutional & Structural Control", "Societal & Structural Horrors"],
    ["Captivity & Voyeuristic Sadism", "The Body as Battleground"],
    ["Contagion & Mutation", "The Body as Battleground"],
    ["Body Horror / Envelope Violation", "The Body as Battleground"],
    ["Possession & Loss of Agency", "Psychological & Domestic Horrors"],
    ["Isolation & Psychological Unraveling", "Psychological & Domestic Horrors"],
    ["Grief & Familial Trauma", "Psychological & Domestic Horrors"],
    ["Ecological / Natural Menace", "Cosmic & Moral Reckonings"],
    ["Transgression & Moral Punishment", "Cosmic & Moral Reckonings"]
  ]);

  // ===============================
  // Data load & prep
  // ===============================

  const movies = await d3.csv("./netflix_omdb_master.csv");

  const exploded = [];
  movies.forEach(m => {
    if (!m.OMDb_Genre || !m.Views || !m.OMDb_imdbRating) return;

    m.OMDb_Genre.split(", ").forEach(g => {
      exploded.push({
        genre  : g.trim(),
        views  : +String(m.Views).replace(/,/g, ""),
        rating : +m.OMDb_imdbRating
      });
    });
  });

  const rolled = d3.rollup(
    exploded,
    v => ({
      count       : v.length,
      avg_imdb    : d3.mean(v, d => d.rating),
      total_views : d3.sum(v,  d => d.views),
    }),
    d => d.genre
  );

  const genreData = Array.from(rolled, ([genre, values]) => ({ genre, ...values }))
                         .filter(d => d.count >= 5);

  // ===============================
  // Scales
  // ===============================

  const x = d3.scaleLinear()
    .domain(d3.extent(genreData, d => d.avg_imdb)).nice()
    .range([margin.left, width - margin.right]);

  const y = d3.scaleLinear()
    .domain([0, d3.max(genreData, d => d.total_views) * 1.1]).nice()
    .range([height - margin.bottom, margin.top]);

  const r = d3.scaleSqrt()
    .domain([0, d3.max(genreData, d => d.count)])
    .range([5, 50]);

  // ===============================
  // Crossfade utilities
  // ===============================

  function crossfadeOut(groups, ms = 220, easing = d3.easeCubicOut, afterOnce) {
    const t = d3.transition().duration(ms).ease(easing);
    let called = false;
    groups.forEach(g => g.transition(t).style("opacity", 0));
    if (afterOnce) t.on("end", () => { if (!called) { called = true; afterOnce(); } });
  }
  
  function crossfadeIn(groups, ms = 260, easing = d3.easeCubicIn) {
    groups.forEach(g => g.style("opacity", 0));
    const t = d3.transition().duration(ms).ease(easing);
    groups.forEach(g => g.transition(t).style("opacity", 1));
  }

  // ===============================
  // Scatter
  // ===============================

  function drawScatter() {
    showFineNote();
    mode = "scatter";
    tooltip.style("opacity", 0);

    gChart.selectAll("*").remove();
    gAxis.selectAll("*").remove();
    gLegend.selectAll("*").remove();

    gChart.selectAll(".genre-bubble")
      .data(genreData, d => d.genre)
      .join("circle")
      .attr("class", "genre-bubble")
      .attr("cx", d => x(d.avg_imdb))
      .attr("cy", d => y(d.total_views))
      .attr("r", 0)
      .style("fill", d => getBubbleColor(d.count))
      .transition().duration(400)
      .attr("r", d => r(d.count));

    gAxis.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(10).tickFormat(d => d.toFixed(1)));

    gAxis.append("g")
      .attr("class", "y-axis")
      .attr("transform", `translate(${margin.left}, 0)`)
      .call(d3.axisLeft(y).ticks(10).tickFormat(d => d3.format(".2s")(d).replace('G','B')));

    gAxis.append("text")
      .attr("class", "x-label")
      .attr("x", margin.left + (width - margin.left - margin.right) / 2)
      .attr("y", height - margin.bottom + 50)
      .attr("text-anchor", "middle")
      .text("Average IMDB Rating");

    gAxis.append("text")
      .attr("class", "y-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -(margin.top + (height - margin.top - margin.bottom) / 2))
      .attr("y", margin.left - 60)
      .attr("text-anchor", "middle")
      .text("Total Views");

    quadrantsAdded = false;

    const top10 = [...genreData].sort((a,b) => b.total_views - a.total_views).slice(0, 10);
    gChart.selectAll(".genre-label")
      .data(top10, d => d.genre)
      .join("text")
      .attr("class", "genre-label")
      .attr("x", d => x(d.avg_imdb))
      .attr("y", d => y(d.total_views) - r(d.count) - 12)
      .text(d => d.genre);

    svg.selectAll(".genre-bubble")
      .on("mouseover", (_, d) => {
        if (mode !== "scatter") return;
        tooltip.style("opacity", 1).html(
          `<strong>Genre:</strong> ${d.genre}<br/>
           <strong>Number of Movies:</strong> ${d3.format(",")(d.count)}<br/>
           <strong>Average IMDB Rating:</strong> ${d.avg_imdb.toFixed(2)}<br/>
           <strong>Total Views:</strong> ${d3.format(",")(d.total_views)}`
        );
      })
      .on("mousemove", (event) => {
        if (mode !== "scatter") return;
        tooltip.style("left", (event.clientX + 15) + "px")
               .style("top",  (event.clientY + 15) + "px");
      })
      .on("mouseout", () => { if (mode === "scatter") tooltip.style("opacity", 0); });

    const legendCategories = [
      { label: "2,501+",       value: 2600 },
      { label: "1,501–2,500",  value: 1800 },
      { label: "801–1,500",    value: 1100 },
      { label: "401–800",      value: 600 },
      { label: "101–400",      value: 250 },
      { label: "≤ 100",        value: 80 }
    ];
        
    const legend = gLegend.append("g")
      .attr("class", "legend")
      .attr("transform", `translate(${width - margin.right + 40}, ${margin.top})`);

    legend.append("text")
      .attr("class", "legend-title")
      .attr("x", 0).attr("y", 0)
      .text("Number of Movies");

    const legendItems = legend.selectAll(".legend-item")
      .data(legendCategories).join("g")
      .attr("class", "legend-item")
      .attr("transform", (_, i) => `translate(0, ${(i * 25) + 20})`);

    legendItems.append("circle")
      .attr("r", 8)
      .style("fill", d => getBubbleColor(d.value));

    legendItems.append("text")
      .attr("x", 15)
      .attr("y", 4)
      .text(d => d.label);
  }

  // ===============================
  // Quadrant overlays
  // ===============================

  function addQuadrantsIfNeeded() {
    if (quadrantsAdded) return;

    quadrantsAdded = true;
    
    const meanRating = d3.mean(genreData, d => d.avg_imdb);
    const meanViews  = d3.mean(genreData, d => d.total_views);
    
    const pad = 30, bottomPad = 30, labelOffset = 10;

    gAxis.append("line").attr("class", "quadrant-line")
      .attr("x1", x(meanRating)).attr("y1", margin.top)
      .attr("x2", x(meanRating)).attr("y2", height - margin.bottom);

    gAxis.append("line").attr("class", "quadrant-line")
      .attr("x1", margin.left).attr("y1", y(meanViews))
      .attr("x2", width - margin.right).attr("y2", y(meanViews));

    gAxis.append("text").attr("class","quadrant-label")
      .attr("x", width - margin.right).attr("y", margin.top + pad)
      .attr("text-anchor", "end").text("Prestige Powerhouses");

    gAxis.append("text").attr("class","quadrant-label")
      .attr("x", margin.left + pad).attr("y", margin.top + pad)
      .attr("text-anchor", "start").text("Crowd Magnets");

    gAxis.append("text").attr("class","quadrant-label")
      .attr("x", width - margin.right).attr("y", height - margin.bottom - bottomPad)
      .attr("text-anchor", "end").text("Critical Darlings");

    gAxis.append("text").attr("class","quadrant-label")
      .attr("x", margin.left + pad).attr("y", height - margin.bottom - bottomPad)
      .attr("text-anchor", "start").text("Cult Gems");

    gAxis.append("text").attr("class", "quadrant-axis-label")
      .attr("x", x(meanRating)).attr("y", margin.top - labelOffset)
      .text(`Avg. Rating: ${meanRating.toFixed(2)}`);

    gAxis.append("text").attr("class", "quadrant-axis-label horizontal")
      .attr("x", width - margin.right + labelOffset + 35)
      .attr("y", y(meanViews))
      .text(`Avg. Views: ${d3.format(".2s")(meanViews).replace('G','B')}`);
  }

  // ===============================
  // Horror focus / quadrant focus
  // ===============================

  function focusHorror(on) {
    isHorrorFocused = on;
    titleEl.text(on ? "Horror in the Hit Matrix" : "The Hit Matrix");

    const notHorror = d => d.genre?.toLowerCase() !== "horror";

    svg.selectAll(".genre-bubble")
      .classed("dimmed", d => on && notHorror(d))
      .style("pointer-events", d => (on && notHorror(d)) ? "none" : "all");

    svg.selectAll(".genre-label")
      .classed("dimmed", d => on && notHorror(d))
      .style("pointer-events", d => (on && notHorror(d)) ? "none" : "all");
  }

  function focusQuadrant(quadrant) {
    const meanRating = d3.mean(genreData, d => d.avg_imdb);
    const meanViews  = d3.mean(genreData, d => d.total_views);
    
    let shouldDim;
    if (quadrant === "high-views") {
      shouldDim = d => {
        const genre = (d.genre || "").toLowerCase();
        return !(genre === "comedy" || genre === "action" || genre === "drama");
      };
    } else if (quadrant === "critical-darlings") {
      shouldDim = d => (d.avg_imdb <= meanRating || d.total_views >= meanViews);
    } else if (quadrant === "cult-corner") {
      shouldDim = d => (d.genre || "").toLowerCase() !== "horror";
    } else {
      shouldDim = () => false;
    }
    
    svg.selectAll(".genre-bubble")
      .classed("dimmed", shouldDim)
      .style("pointer-events", d => shouldDim(d) ? "none" : "all");
    
    svg.selectAll(".genre-label")
      .classed("dimmed", shouldDim)
      .style("pointer-events", d => shouldDim(d) ? "none" : "all");
  }

  // ===============================
  // Horror zoom
  // ===============================

  function zoomToHorror() {
    const horrorData = genreData.find(d => d.genre?.toLowerCase() === "horror");
    if (!horrorData) return;
    
    svg.selectAll(".genre-bubble")
      .filter(d => d.genre?.toLowerCase() !== "horror")
      .transition().duration(800)
      .style("opacity", 0)
      .on("end", function() { d3.select(this).style("display", "none"); });
    
    svg.selectAll(".genre-label")
      .transition().duration(800)
      .style("opacity", 0)
      .on("end", function() { d3.select(this).style("display", "none"); });
    
    const horrorRating = horrorData.avg_imdb;
    const horrorViews = horrorData.total_views;
    
    const xPadding = 1.5;
    const yPadding = horrorViews * 0.8;
    
    const xZoom = d3.scaleLinear()
      .domain([horrorRating - xPadding, horrorRating + xPadding])
      .range([margin.left, width - margin.right]);
    
    const yZoom = d3.scaleLinear()
      .domain([horrorViews - yPadding, horrorViews + yPadding])
      .range([height - margin.bottom, margin.top]);
    
    gAxis.select(".x-axis")
      .transition().duration(800)
      .call(d3.axisBottom(xZoom).ticks(5).tickFormat(d => d.toFixed(1)));
    
    gAxis.select(".y-axis")
      .transition().duration(800)
      .call(d3.axisLeft(yZoom).ticks(6).tickFormat(d => d3.format(".2s")(d).replace('G','B')));
    
    gAxis.selectAll(".x-label, .y-label")
      .transition().duration(800)
      .style("opacity", 0);
    
    svg.selectAll(".genre-bubble")
      .filter(d => d.genre?.toLowerCase() === "horror")
      .transition().duration(800)
      .attr("cx", xZoom(horrorRating))
      .attr("cy", yZoom(horrorViews))
      .attr("r", 200)
      .style("fill", "#1D1C1C")
      .style("opacity", 1)
      .style("display", "block");
    
    svg.selectAll(".horror-center-label").remove();
    
    svg.append("text")
      .attr("class", "horror-center-label")
      .attr("x", xZoom(horrorRating))
      .attr("y", yZoom(horrorViews))
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("font-family", "Libre Baskerville, serif")
      .style("font-size", "60px")
      .style("font-weight", "bold")
      .style("fill", "white")
      .style("opacity", 0)
      .text("Horror")
      .transition().duration(800)
      .style("opacity", 1);
    
    gLegend.transition().duration(800)
      .style("opacity", 0);
    
    gAxis.selectAll(".quadrant-line, .quadrant-label, .quadrant-axis-label")
      .transition().duration(800)
      .style("opacity", 0);
  }

  function restoreFromHorrorZoom() {
    svg.selectAll(".genre-bubble")
      .style("display", "block")
      .transition().duration(600)
      .style("opacity", 0.8)
      .attr("cx", d => x(d.avg_imdb))
      .attr("cy", d => y(d.total_views))
      .attr("r", d => r(d.count))
      .style("fill", d => getBubbleColor(d.count));
    
    svg.selectAll(".genre-label")
      .style("display", "block")
      .transition().duration(600)
      .style("opacity", 1)
      .style("font-size", null)
      .attr("font-size", null)
      .style("font-weight", null)
      .attr("x", d => x(d.avg_imdb))
      .attr("y", d => y(d.total_views) - r(d.count) - 12);
    
    svg.selectAll(".horror-center-label")
      .transition().duration(600)
      .style("opacity", 0)
      .remove();
    
    gAxis.select(".x-axis")
      .transition().duration(600)
      .call(d3.axisBottom(x).ticks(10).tickFormat(d => d.toFixed(1)));
    
    gAxis.select(".y-axis")
      .transition().duration(600)
      .call(d3.axisLeft(y).ticks(10).tickFormat(d => d3.format(".2s")(d).replace('G','B')));
    
    gAxis.selectAll(".x-label, .y-label")
      .transition().duration(600)
      .style("opacity", 1);
    
    gLegend.transition().duration(600)
      .style("opacity", 1);
    
    if (quadrantsAdded) {
      gAxis.selectAll(".quadrant-line, .quadrant-label, .quadrant-axis-label")
        .transition().duration(600)
        .style("opacity", 1);
    }
  }

  // ===============================
  // Horror CSV / poster subset
  // ===============================

  async function ensureFearAndPosters() {
    if (!fearRows) {
      fearRows = await d3.csv("./horror_categorized_clean_manualfix.csv");
    }

    if (!posterRows) {
      posterRows = fearRows
        .filter(d => d.OMDb_Poster && d.OMDb_Poster !== "N/A")
        .map(d => ({
          poster:  d.OMDb_Poster,
          title:   d.Title,
          country: d.OMDb_Country || "Unknown"
        }));
    }

    return posterRows;
  }

  // ===============================
  // Bars (11 categories)
  // ===============================

  async function drawFearBars() {
    hideFineNote();
    await ensureFearAndPosters();
    mode = "bars";
    tooltip.style("opacity", 0);

    gChart.selectAll("*").remove();
    gAxis.selectAll("*").remove();
    gLegend.selectAll("*").remove();
    
    svg.selectAll(".horror-center-label").remove();

    const filtered = fearRows.filter(d => FEAR_SET.has((d.Fear_Category || "").trim()));
    const counts = d3.rollups(
      filtered,
      v => v.length,
      d => (d.Fear_Category || "").trim()
    )
      .map(([fear, count]) => ({ fear, count }))
      .sort((a, b) => d3.descending(a.count, b.count));

    const leftForBars = 280;

    const yBar = d3.scaleBand()
      .domain(counts.map(d => d.fear))
      .range([margin.top, height - margin.bottom])
      .padding(0.18);

    const xBar = d3.scaleLinear()
      .domain([0, d3.max(counts, d => d.count)]).nice()
      .range([leftForBars, width - margin.right]);

    const yAxis = gAxis.append("g")
      .attr("class", "y-axis")
      .attr("transform", `translate(${leftForBars}, 0)`)
      .call(d3.axisLeft(yBar).tickSizeOuter(0).tickFormat(d => getDisplayName(d)));

    yAxis.selectAll("text")
      .attr("text-anchor", "end")
      .attr("dx", "-0.4em")
      .style("font-family", "Libre Baskerville, serif")
      .style("font-size", "15px")
      .style("font-style", "italic")
      .style("font-weight", "500")
      .style("fill", "#333");

    gAxis.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(xBar).ticks(6));

    gAxis.append("text")
      .attr("class", "x-label")
      .attr("x", leftForBars + (width - leftForBars - margin.right) / 2)
      .attr("y", height - margin.bottom + 50)
      .attr("text-anchor", "middle")
      .text("Total movies");

    gChart.selectAll("rect")
      .data(counts, d => d.fear)
      .join("rect")
      .attr("x", leftForBars)
      .attr("y", d => yBar(d.fear))
      .attr("width", 0)
      .attr("height", yBar.bandwidth())
      .attr("fill", "#5b3942")
      .transition().duration(600)
      .attr("width", d => xBar(d.count) - leftForBars);

    gChart.selectAll("rect")
      .on("mouseover", (_, d) => {
        const key = (d.fear || "").trim();
        const displayName = getDisplayName(key);
        const description = FEAR_CATEGORY_DESCRIPTIONS[key] || FEAR_CATEGORY_DESCRIPTIONS[displayName] || "";
        tooltip.style("opacity", 1).html(
          `<strong>${displayName}</strong><br/>
           Total movies: ${d.count}
           <div style="font-size: 13px; line-height: 1.5; margin: 8px 0; color: #666;">${description}</div>`
        );
      })
      .on("mousemove", (event) => {
        tooltip.style("left", (event.clientX + 15) + "px")
               .style("top",  (event.clientY + 15) + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0));
  }

  // ===============================
  // Bars focus helpers
  // ===============================

  function focusBars(focusCount = null) {
    if (mode !== "bars") return;
    
    if (focusCount === null || focusCount === "none") {
      gChart.selectAll("rect")
        .classed("dimmed", false)
        .style("pointer-events", "all");
      return;
    }
    
    gChart.selectAll("rect")
      .classed("dimmed", (d, i) => i >= focusCount)
      .style("pointer-events", (d, i) => i >= focusCount ? "none" : "all");
  }

  function focusBarsBySupergroup(supergroupName = null) {
    if (mode !== "bars") return;
    
    if (supergroupName === null || supergroupName === "none") {
      gChart.selectAll("rect")
        .classed("dimmed", false)
        .style("pointer-events", "all");
      return;
    }
    
    gChart.selectAll("rect")
      .classed("dimmed", d => {
        const group = FEAR_GROUP_MAP.get(d.fear);
        return group !== supergroupName;
      })
      .style("pointer-events", d => {
        const group = FEAR_GROUP_MAP.get(d.fear);
        return group !== supergroupName ? "none" : "all";
      });
  }

  // ===============================
  // Bars (supergroups)
  // ===============================

  async function drawFearBarsGrouped() {
    hideFineNote();
    if (!fearRows) fearRows = await d3.csv("./horror_categorized_clean.csv");

    mode = "bars";
    tooltip.style("opacity", 0);

    gChart.selectAll("*").remove();
    gAxis.selectAll("*").remove();
    gLegend.selectAll("*").remove();
    
    svg.selectAll(".horror-center-label").remove();

    const filtered = fearRows.filter(d => FEAR_SET.has((d.Fear_Category || "").trim()));
    const groupedCounts = d3.rollups(
      filtered,
      v => v.length,
      d => FEAR_GROUP_MAP.get((d.Fear_Category || "").trim()) || "Unmapped"
    )
      .filter(([k]) => k !== "Unmapped")
      .map(([group, count]) => ({ group, count }))
      .sort((a, b) => d3.descending(a.count, b.count));

    const leftForBars = 280;

    const yBar = d3.scaleBand()
      .domain(groupedCounts.map(d => d.group))
      .range([margin.top, height - margin.bottom])
      .padding(0.28);

    const xBar = d3.scaleLinear()
      .domain([0, d3.max(groupedCounts, d => d.count)]).nice()
      .range([leftForBars, width - margin.right]);

    const yAxis = gAxis.append("g")
      .attr("class", "y-axis")
      .attr("transform", `translate(${leftForBars}, 0)`)
      .call(d3.axisLeft(yBar).tickSizeOuter(0));

    yAxis.selectAll("text")
      .style("font-family", "Libre Baskerville, serif")
      .style("font-size", "15px")
      .style("font-style", "italic")
      .style("font-weight", "500")
      .style("fill", "#333");

    gAxis.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${height - margin.bottom})`)
      .call(d3.axisBottom(xBar).ticks(6));

    gAxis.append("text")
      .attr("class", "x-label")
      .attr("x", leftForBars + (width - leftForBars - margin.right) / 2)
      .attr("y", height - margin.bottom + 50)
      .attr("text-anchor", "middle")
      .text("Total movies");

    gChart.selectAll("rect")
      .data(groupedCounts, d => d.group)
      .join("rect")
      .attr("x", leftForBars)
      .attr("y", d => yBar(d.group))
      .attr("width", 0)
      .attr("height", yBar.bandwidth())
      .attr("fill", "#5b3942")
      .transition().duration(600)
      .attr("width", d => xBar(d.count) - leftForBars);

    gChart.selectAll("rect")
      .on("mouseover", (_, d) => {
        tooltip.style("opacity", 1).html(
          `<strong>${d.group}</strong><br/>Total movies: ${d.count}`
        );
      })
      .on("mousemove", (event) => {
        tooltip.style("left", (event.clientX + 15) + "px")
               .style("top",  (event.clientY + 15) + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0));
  }

  // ===============================
  // Title / subtitle utilities
  // ===============================

  function applyStepTitle(stepEl) {
    const t = stepEl?.getAttribute("data-title");
    if (!t) return;
    titleEl.text(t);
  }

  function applyStepSubtitle(stepEl) {
    const s = stepEl?.getAttribute("data-subtitle");
    if (s) subtitleEl.text(s);
  }

function applyStepFX(stepEl) {
  const scene = stepEl?.getAttribute("data-scene");
  
  // special behavior for the 4 map cards
  if (scene === "map" && window.horrorMapAPI) {
    const api = window.horrorMapAPI;

    const mapSteps = Array.from(
      document.querySelectorAll('.step[data-scene="map"]')
    );
    const idx = mapSteps.indexOf(stepEl);

    // if not found, bail
    if (idx === -1) return;

    if (idx === 0) {
      // "But horror isn’t the same everywhere..."
      api.zoomToWorld();
      api.setFilterVisible(false);
      api.setFearFilter(null); // all fears
    } else if (idx === 1) {
      // "Global patterns emerge. The United States stands alone..."
      api.zoomToAtlanticUS_UK();
      api.setFilterVisible(false);
      api.setFearFilter(null);
    } else if (idx === 2) {
      // "Indonesia ranks third overall — a surprising outlier..."
      api.zoomToIndonesia();
      api.setFilterVisible(false);
      api.setFearFilter(null);
    } else if (idx === 3) {
      // "Ultimately, fear is universal..."
      api.zoomToWorld();
      api.setFilterVisible(true);
      api.setFearFilter("Institutional & Structural Control");
    }
  }
}


  // ===============================
  // Methodology button visibility
  // ===============================

  const methodologyBtn = document.getElementById("methodology-btn");
  
  function showMethodologyBtn() {
    if (methodologyBtn) methodologyBtn.style.display = "block";
  }
  
  function hideMethodologyBtn() {
    if (methodologyBtn) methodologyBtn.style.display = "none";
  }

  // ===============================
  // Scene router
  // ===============================

  function go(scene) {
    if (scene === "baseline") {
      hideWorldMap();
      hidePosterWall();
      hideMethodologyBtn();
      restoreFromHorrorZoom();

      [gChart, gAxis, gLegend].forEach(g => {
        if (!g) return;
        g.style("opacity", 1);
      });

      if (mode !== "scatter") {
        titleEl.text("The Hit Matrix");
        drawScatter();
      } else {
        showFineNote();
      }

      addQuadrantsIfNeeded();

      if (isHorrorFocused) focusHorror(false);
      focusQuadrant("none");
    }

    else if (scene === "quadrants") {
      hideWorldMap();
      hidePosterWall();
      hideMethodologyBtn();
      restoreFromHorrorZoom();

      if (mode !== "scatter") drawScatter();
      showFineNote();
      addQuadrantsIfNeeded();

      if (isHorrorFocused) focusHorror(false);
      focusQuadrant("none");
    }

    else if (scene === "high-views") {
      hideWorldMap();
      hidePosterWall();
      hideMethodologyBtn();
      restoreFromHorrorZoom();

      if (mode !== "scatter") drawScatter();
      showFineNote();
      addQuadrantsIfNeeded();

      if (isHorrorFocused) focusHorror(false);
      focusQuadrant("high-views");
    }

    else if (scene === "critical-darlings") {
      hideWorldMap();
      hidePosterWall();
      hideMethodologyBtn();
      restoreFromHorrorZoom();

      if (mode !== "scatter") drawScatter();
      showFineNote();
      addQuadrantsIfNeeded();

      focusQuadrant("critical-darlings");
    }

    else if (scene === "horror") {
      hideWorldMap();
      hidePosterWall();
      hideMethodologyBtn();

      [gChart, gAxis, gLegend].forEach(g => {
        if (!g) return;
        g.interrupt().style("opacity", 1);
      });

      restoreFromHorrorZoom();

      if (mode !== "scatter") drawScatter();
      showFineNote();
      addQuadrantsIfNeeded();

      focusQuadrant("none");
      focusHorror(true);
    }

    else if (scene === "horror-zoom") {
      hideWorldMap();
      hidePosterWall();
      hideMethodologyBtn();

      [gChart, gAxis, gLegend].forEach(g => {
        if (!g) return;
        g.interrupt().style("opacity", 1);
      });

      if (mode !== "scatter") {
        drawScatter();
        addQuadrantsIfNeeded();
      }

      hideFineNote();
      zoomToHorror();
    }

    else if (scene === "posters") {
      hideWorldMap();
      hideMethodologyBtn();
      hideFineNote();

      if (mode !== "scatter") {
        drawScatter();
        addQuadrantsIfNeeded();
      }

      crossfadeOut([gChart, gAxis, gLegend], 220, d3.easeCubicOut);

      mode = "posters";
      showPosterWall();
    }

    else if (scene === "map") {
      hidePosterWall();
      hideMethodologyBtn();
      hideFineNote();
      showWorldMap();
    }

    else if (scene === "bars") {
      hideWorldMap();
      hidePosterWall();
      showMethodologyBtn();

      if (mode === "bars") {
        focusBars(null);
      } else {
        crossfadeOut([gChart, gAxis, gLegend], 220, d3.easeCubicOut, () => {
          drawFearBars();
          crossfadeIn([gChart, gAxis], 260, d3.easeCubicIn);
        });
      }
    }

    else if (scene === "bars_psychological") {
      hideWorldMap();
      hidePosterWall();
      showMethodologyBtn();

      if (mode === "bars") {
        focusBarsBySupergroup("Psychological & Domestic Horrors");
      } else {
        crossfadeOut([gChart, gAxis, gLegend], 220, d3.easeCubicOut, () => {
          drawFearBars();
          crossfadeIn([gChart, gAxis], 260, d3.easeCubicIn);
          setTimeout(
            () => focusBarsBySupergroup("Psychological & Domestic Horrors"),
            300
          );
        });
      }
    }

    else if (scene === "bars_body") {
      hideWorldMap();
      hidePosterWall();
      showMethodologyBtn();

      if (mode === "bars") {
        focusBarsBySupergroup("The Body as Battleground");
      } else {
        crossfadeOut([gChart, gAxis, gLegend], 220, d3.easeCubicOut, () => {
          drawFearBars();
          crossfadeIn([gChart, gAxis], 260, d3.easeCubicIn);
          setTimeout(
            () => focusBarsBySupergroup("The Body as Battleground"),
            300
          );
        });
      }
    }

    else if (scene === "bars_societal") {
      hideWorldMap();
      hidePosterWall();
      showMethodologyBtn();

      if (mode === "bars") {
        focusBarsBySupergroup("Societal & Structural Horrors");
      } else {
        crossfadeOut([gChart, gAxis, gLegend], 220, d3.easeCubicOut, () => {
          drawFearBars();
          crossfadeIn([gChart, gAxis], 260, d3.easeCubicIn);
          setTimeout(
            () => focusBarsBySupergroup("Societal & Structural Horrors"),
            300
          );
        });
      }
    }

    else if (scene === "bars_cosmic") {
      hideWorldMap();
      hidePosterWall();
      showMethodologyBtn();

      if (mode === "bars") {
        focusBarsBySupergroup("Cosmic & Moral Reckonings");
      } else {
        crossfadeOut([gChart, gAxis, gLegend], 220, d3.easeCubicOut, () => {
          drawFearBars();
          crossfadeIn([gChart, gAxis], 260, d3.easeCubicIn);
          setTimeout(
            () => focusBarsBySupergroup("Cosmic & Moral Reckonings"),
            300
          );
        });
      }
    }

    else if (scene === "bars_grouped" || scene === "grouped") {
      hideWorldMap();
      hidePosterWall();
      showMethodologyBtn();

      if (mode === "bars") {
        crossfadeOut([gChart, gAxis], 220, d3.easeCubicOut, () => {
          drawFearBarsGrouped();
          crossfadeIn([gChart, gAxis], 260, d3.easeCubicIn);
        });
      } else {
        crossfadeOut([gChart, gAxis, gLegend], 220, d3.easeCubicOut, () => {
          drawFearBarsGrouped();
          crossfadeIn([gChart, gAxis], 260, d3.easeCubicIn);
        });
      }
    }

    else {
      // noop
    }
  }

  // ===============================
  // Scrollytelling engine
  // ===============================

  const steps = Array.from(document.querySelectorAll(".step"));
  let armed = false;
  let active = null;

  const graphicEl = document.querySelector(".viz-wrap");
  let baselineRendered = false;

  new IntersectionObserver((entries) => {
    const e = entries[0];
    
    if (!baselineRendered && e.isIntersecting) {
      baselineRendered = true;
      titleEl.text("The Hit Matrix");
      drawScatter();
      addQuadrantsIfNeeded();
    }
    
    armed = e.isIntersecting && e.intersectionRatio >= 0.30;
    
    if (armed) setActiveByCenter();
  }, { threshold: [0, 0.3, 1] }).observe(graphicEl);

  function setActiveByCenter() {
    if (!armed) return;

    const mid = window.innerHeight / 2;
    
    let best = null, bestDist = Infinity;

    steps.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= window.innerHeight) return;
      const center = r.top + r.height / 2;
      const dist   = Math.abs(center - mid);
      if (dist < bestDist) { bestDist = dist; best = el; }
    });

    if (best && best !== active) {
      if (active) active.classList.remove("is-active");
      active = best;
      active.classList.add("is-active");

      applyStepTitle(active);
      applyStepSubtitle(active);
      applyStepFX(active);
      
      go(active.getAttribute("data-scene") || "noop");
    }
  }

  window.addEventListener("scroll", setActiveByCenter, { passive: true });
  window.addEventListener("resize", setActiveByCenter);
  setActiveByCenter();

  // ===============================
  // Hero down-arrow
  // ===============================

  document.getElementById("to-graph")?.addEventListener("click", () => {
    const el = document.getElementById("graph");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  // ===============================
  // Methodology modal
  // ===============================

  const modal    = document.getElementById("methodology-modal");
  const btn      = document.getElementById("methodology-btn");
  const closeBtn = modal?.querySelector(".methodology-modal-close");
  const backdrop = modal?.querySelector(".methodology-modal-backdrop");

  btn?.addEventListener("click", () => modal?.classList.add("is-open"));
  closeBtn?.addEventListener("click", () => modal?.classList.remove("is-open"));
  backdrop?.addEventListener("click", () => modal?.classList.remove("is-open"));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal?.classList.contains("is-open")) {
      modal.classList.remove("is-open");
    }
  });
}

main();
