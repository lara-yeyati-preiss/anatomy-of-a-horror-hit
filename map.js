// ================================
// World Horror Choropleth
// ================================

mapboxgl.accessToken =
  "pk.eyJ1IjoieWV5YWw5NDciLCJhIjoiY21oeHFvNm1kMDRqbjJxcHQ1d2FwYjR6aSJ9.YuBSqR795plFdjL6zIBVLg";


// ------------------------------------------------------
// LOAD DATA
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
  // MAPBOX + D3 OVERLAY
  // ------------------------------------------------------
  const isMobile = window.innerWidth <= 900;

  // desktop vs mobile camera
  const initialCenter = isMobile ? [0, 20] : [0, 35];  
  const initialZoom   = isMobile ? 0.10    : 0.6; 
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
  if (isMobile) {
    map.scrollZoom.disable();  
    map.dragPan.enable();
    map.touchZoomRotate.enable();
  } else {
    map.scrollZoom.disable();
    map.dragPan.disable();
    map.touchZoomRotate.disable();
  }

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
  // COLOR SCALE + MODE (DISCRETE PALETTE)
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
  // TOOLTIP
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
  // COUNTRIES LAYER
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
// CONTROLS
// ------------------------------------------------------
const controls = d3
  .select("#map")
  .append("div")
  .attr("class", "map-controls")
  .style("display", "none");

controls.append("label")
  .attr("class", "map-controls-label")
  .text("Filter by Fear Category");

const select = controls.append("select")
  .attr("class", "map-controls-select");

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
// COLOR LEGEND
// ------------------------------------------------------

const legend = d3
  .select("#map")
  .append("div")
  .attr("class", "color-legend");

legend.append("div")
  .attr("class", "color-legend-title")
  .text("Movie Count");

const legendContainer = legend.append("div")
  .attr("class", "color-legend-rows");


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
      max = null; // "and above"
    } else {
      min = thresholds[i - 1] + 1;
      max = thresholds[i];
    }
    return { color, min, max };
  });

  // Zero row
  const zeroRow = legendContainer
    .append("div")
    .attr("class", "legend-row legend-row-zero");

  zeroRow.append("span")
    .attr("class", "legend-swatch legend-swatch-zero");

  zeroRow.append("span")
    .attr("class", "legend-label")
    .text("0");

  // Palette rows
  const rows = legendContainer
    .selectAll(".legend-row-range")
    .data(legendData)
    .join("div")
    .attr("class", "legend-row legend-row-range");

  rows.append("span")
    .attr("class", "legend-swatch")
    .style("background-color", (d) => d.color)
    .style("border", "1px solid #ccc");

  rows.append("span")
    .attr("class", "legend-label")
    .text((d) => {
      if (d.max === null) return `${d.min}+`;
      return `${d.min}–${d.max}`;
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
  // PUBLIC API FOR SCROLL STEPS
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

