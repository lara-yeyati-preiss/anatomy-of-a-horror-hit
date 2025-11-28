// ================================
// World Horror Choropleth
// ================================

mapboxgl.accessToken =
  "pk.eyJ1IjoieWV5YWw5NDciLCJhIjoiY21oeHFvNm1kMDRqbjJxcHQ1d2FwYjR6aSJ9.YuBSqR795plFdjL6zIBVLg";


// ------------------------------------------------------
// 1) LOAD DATA
// ------------------------------------------------------
Promise.all([
  d3.json("world.geo.json"),
  d3.csv("horror_movies_by_country_and_fear_category.csv"),
]).then(([worldGeo, rowsRaw]) => {

  function cleanCountryName(s) {
    return (s || "").trim();
  }

  const COUNTRY_ALIASES = new Map([
    ["Czech Republic", "Czechia"],
    ["Cape Verde", "Cabo Verde"],
    ["Democratic Republic of Congo", "Congo, The Democratic Republic of the"],
    ["Republic of Congo", "Congo"],
    ["USA", "United States of America"],
    ["West Germany", "Germany"],
    ["United States", "United States of America"],
  ]);

  function aliasCountryName(name) {
    const cleaned = cleanCountryName(name);
    return COUNTRY_ALIASES.get(cleaned) || cleaned;
  }

  const rows = rowsRaw
    .filter((d) => d.Country && d.Country !== "nan")
    .map((d) => ({
      Country: aliasCountryName(d.Country),
      Fear_Category: (d.Fear_Category || "").trim(),
      Movie_Count: +d.Movie_Count || 0,
    }));

  const fearCategories = Array.from(
    new Set(rows.map((d) => d.Fear_Category).filter(Boolean))
  ).sort();

  const countsByCountry = d3.rollup(
    rows,
    (countryRows) => {
      const perFear = {};
      let total = 0;
      countryRows.forEach((r) => {
        const label = r.Fear_Category;
        const n = r.Movie_Count;
        total += n;
        if (!perFear[label]) perFear[label] = 0;
        perFear[label] += n;
      });
      return { total, perFear };
    },
    (d) => d.Country
  );

  // ------------------------------------------------------
  // 2) MAPBOX + D3 OVERLAY
  // ------------------------------------------------------
  const isMobile = window.innerWidth <= 900;

  // desktop vs mobile camera
  const initialCenter = isMobile ? [0, 20] : [0, 35];   // move down a bit on mobile
  const initialZoom   = isMobile ? 0.10    : 0.6;      // much more zoomed out on mobile
  const initialMinZoom = isMobile ? 0.25   : 0.7;

  const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/light-v11",
    center: initialCenter,
    zoom:   initialZoom,
    minZoom: initialMinZoom,
    projection: "mercator",
    renderWorldCopies: false
  });

  window.horrorMap = map;

  const container = map.getCanvasContainer();
  const svg = d3.select(container).append("svg");

  let svgWidth = 0;
  let svgHeight = 0;

  function resizeSVG() {
    const canvas = map.getCanvas();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    svg.attr("width", w).attr("height", h);

    svgWidth = w;
    svgHeight = h;
  }

  function projectPoint(lon, lat) {
    const point = map.project([lon, lat]);
    this.stream.point(point.x, point.y);
  }

  const transform = d3.geoTransform({ point: projectPoint });
  const path = d3.geoPath().projection(transform);

  function getCountryKey(feature) {
    return cleanCountryName(
      feature.properties.ADMIN || feature.properties.name || ""
    );
  }


  // ------------------------------------------------------
  // 3) COLOR SCALE + MODE (DISCRETE PALETTE)
  // ------------------------------------------------------
  let currentMode = "total"; 
  let currentFear = fearCategories[0] || null;

const palette = [
  "#ebeae8ff",
  "#d6cfc8",
  "#8a6d70",
  "#70434b",
  "#5b3942",
  "#2e1218"
];

  const thresholds = [5, 20, 50, 100, 200];
  
  let colorScale = d3.scaleThreshold()
    .domain(thresholds)
    .range(palette);
  
  function getValueForFeature(feature) {
    const key = getCountryKey(feature);
    const rec = countsByCountry.get(key);
    if (!rec) return 0;
    if (currentMode === "total" || !currentFear) return rec.total;
    return rec.perFear[currentFear] || 0;
  }

  // ------------------------------------------------------
  // 4) TOOLTIP
  // ------------------------------------------------------
  const TOOLTIP_PAD = 8;
  let lastTooltipBBox = { width: 0, height: 0 };

  const tooltip = svg
    .append("g")
    .attr("id", "tooltip")
    .style("pointer-events", "none")
    .attr("opacity", 0);

  const tooltipBg = tooltip
    .append("rect")
    .attr("rx", 4)
    .attr("ry", 4)
    .attr("fill", "rgba(20,20,20,0.9)")
    .attr("stroke", "rgba(255,255,255,0.12)")
    .attr("stroke-width", 0.5);

  const tooltipText = tooltip
    .append("text")
    .attr("fill", "#ffffff")
    .attr("font-size", 12)
    .attr("letter-spacing", "-0.01em")
    .attr("font-family", "'IBM Plex Mono', monospace");

  function placeTooltip(x, y) {
    if (!svgWidth || !svgHeight) return;

    const w = lastTooltipBBox.width + TOOLTIP_PAD * 2;
    const h = lastTooltipBBox.height + TOOLTIP_PAD * 2;

    let tx = x + 18;
    let ty = y - 12;

    const margin = 4;

    if (tx + w > svgWidth - margin) tx = svgWidth - w - margin;
    if (tx < margin) tx = margin;

    if (ty + h > svgHeight - margin) ty = svgHeight - h - margin;
    if (ty < margin) ty = margin;

    tooltip
      .attr("transform", `translate(${tx}, ${ty})`)
      .attr("opacity", 1)
      .raise();
  }

  function showTooltip(lines, x, y) {
    tooltipText.selectAll("tspan").remove();
    lines.forEach((line, i) => {
      tooltipText
        .append("tspan")
        .attr("x", 0)
        .attr("dy", i === 0 ? "0em" : "1.3em")
        .text(line);
    });

    const bb = tooltipText.node().getBBox();
    lastTooltipBBox = { width: bb.width, height: bb.height };

    tooltipBg
      .attr("x", bb.x - TOOLTIP_PAD)
      .attr("y", bb.y - TOOLTIP_PAD)
      .attr("width", bb.width + TOOLTIP_PAD * 2)
      .attr("height", bb.height + TOOLTIP_PAD * 2);

    placeTooltip(x, y);
  }

  function hideTooltip() {
    tooltip.attr("opacity", 0);
  }

  // ------------------------------------------------------
  // 5) COUNTRIES LAYER
  // ------------------------------------------------------
  const featureCountries = svg
    .selectAll(".country")
    .data(worldGeo.features)
    .join("path")
    .attr("class", "country")
    .attr("fill", "#f0f0f0")
    .on("mousemove", function (event, d) {
      const key = getCountryKey(d);
      const rec = countsByCountry.get(key);
      const total = rec ? rec.total : 0;

      const lines = [];
      lines.push(key || "Unknown country");
      lines.push(`Total movies: ${total}`);

      if (currentMode === "fear" && currentFear) {
        const thisFearCount = rec ? rec.perFear[currentFear] || 0 : 0;
        lines.push(`${currentFear}: ${thisFearCount}`);
      }

      const [x, y] = d3.pointer(event);
      showTooltip(lines, x, y);
    })
    .on("mouseleave", hideTooltip);

  function updateChoropleth() {
    featureCountries
      .attr("d", path)
      .attr("fill", (d) => {
        const value = getValueForFeature(d);
        if (!value || value <= 0) return "#D9D9D9";
        return colorScale(value);
      });
    
    updateLegend();
  }

  // ------------------------------------------------------
  // 6) CONTROLS
  // ------------------------------------------------------
  const controls = d3
    .select("#map")
    .append("div")
    .attr("class", "map-controls")
    .style("position", "absolute")
    .style("top", "20px")
    .style("right", "20px")
    .style("background", "rgba(255, 255, 255, 0.95)")
    .style("padding", "12px 16px")
    .style("border-radius", "6px")
    .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)")
    .style("font-family", "'IBM Plex Mono', monospace")
    .style("font-size", "12px")
    .style("z-index", "1000")
    .style("display", "none") // hidden by default
    .style("flex-direction", "column")
    .style("gap", "8px");

  controls.append("label")
    .style("font-weight", "600")
    .style("color", "#333")
    .text("Filter by Fear Category");

  const select = controls.append("select")
    .style("padding", "6px 10px")
    .style("border", "1px solid #ccc")
    .style("border-radius", "4px")
    .style("font-family", "'IBM Plex Mono', monospace")
    .style("font-size", "11px")
    .style("background", "white")
    .style("cursor", "pointer");

  const optionsData = [
    { value: "__total__", label: "All fears (total count)" },
    ...fearCategories.map((f) => ({ value: f, label: f })),
  ];

  select
    .selectAll("option")
    .data(optionsData)
    .join("option")
    .attr("value", (d) => d.value)
    .text((d) => d.label);

  select.on("change", (event) => {
    const val = event.target.value;
    if (val === "__total__") {
      currentMode = "total";
      currentFear = null;
    } else {
      currentMode = "fear";
      currentFear = val;
    }
    updateChoropleth();
  });

  // ------------------------------------------------------
  // 7) COLOR LEGEND
  // ------------------------------------------------------

  const legend = d3
    .select("#map")
    .append("div")
    .attr("class", "color-legend")
    .style("position", "absolute")
    .style("bottom", "10px")
    .style("right", "10px")
    .style("background", "rgba(255, 255, 255, 0.95)")
    .style("padding", "12px 16px")
    .style("border-radius", "6px")
    .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)")
    .style("font-family", "'IBM Plex Mono', monospace")
    .style("font-size", "11px")
    .style("z-index", "1000");

  legend.append("div")
    .style("font-weight", "600")
    .style("margin-bottom", "8px")
    .style("color", "#333")
    .text("Movie Count");

  const legendContainer = legend.append("div")
    .style("display", "flex")
    .style("gap", "8px")
    .style("align-items", "center");

  function updateLegend() {
    legendContainer.selectAll("*").remove();

    const zeroItem = [{ color: "#D9D9D9", min: 0, max: 0 }];

    const legendData = palette.map((color, i) => {
      let min, max;
      if (i === 0) {
        min = 1;
        max = thresholds[0];
      } else if (i === palette.length - 1) {
        min = thresholds[i - 1] + 1;
        max = null; // "201+"
      } else {
        min = thresholds[i - 1] + 1;
        max = thresholds[i];
      }
      return { color, min, max };
    });

    const allLegendData = [...zeroItem, ...legendData];

    legendContainer
      .selectAll("div.legend-item")
      .data(allLegendData)
      .join("div")
      .attr("class", "legend-item")
      .style("display", "flex")
      .style("flex-direction", "column")
      .style("align-items", "center")
      .each(function(d) {
        const item = d3.select(this);
        
        item.append("div")
          .style("width", "30px")
          .style("height", "14px")
          .style("background-color", d.color)
          .style("border", "1px solid rgba(0,0,0,0.1)")
          .style("border-radius", "2px")
          .style("margin-bottom", "4px");
        
        let label;
        if (d.min === 0 && d.max === 0) {
          label = "0";
        } else if (d.max === null) {
          label = `${d.min}+`;
        } else if (d.min === d.max) {
          label = `${d.min}`;
        } else {
          label = `${d.min}-${d.max}`;
        }
        
        item.append("span")
          .style("color", "#555")
          .style("font-size", "10px")
          .text(label);
      });
  }

  map.on("load", () => {
    resizeSVG();
    updateChoropleth();
  });

  map.on("move", updateChoropleth);
  map.on("zoom", updateChoropleth);
  map.on("resize", () => {
    resizeSVG();
    updateChoropleth();
  });

  // ------------------------------------------------------
  // 8) PUBLIC API FOR SCROLL STEPS
  // ------------------------------------------------------

  function zoomToWorldInstant() {
    map.jumpTo({
      center: [0, 35],
      zoom: 0.6
    });
  }

  function zoomToWorld() {
      map.easeTo({
        center: [0, 35],
        zoom: 0.6,
        duration: 800
      });
    }

  function zoomToAtlanticUS_UK() {
    map.easeTo({
      center: [-40, 45],   
      zoom: 1.55,        
      duration: 1000
    });
  }

  function zoomToIndonesia() {
    map.easeTo({
      center: [120, -2], 
      zoom: 3.0,
      duration: 1000
    });
  }

  function setFilterVisible(show) {
    controls.style("display", show ? "flex" : "none");
  }

  function setFearFilter(fearLabelOrNull) {
    if (!fearLabelOrNull) {
      currentMode = "total";
      currentFear = null;
      select.property("value", "__total__");
    } else {
      currentMode = "fear";
      currentFear = fearLabelOrNull;
      select.property("value", fearLabelOrNull);
    }
    updateChoropleth();
  }

  window.horrorMapAPI = {
    zoomToWorldInstant,
    zoomToWorld,
    zoomToAtlanticUS_UK,
    zoomToIndonesia,
    setFilterVisible,
    setFearFilter
  };
});

