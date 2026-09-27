// ============================================================
// STATS 401 — Lab 8: DKU Bulletin semantic explorer
// ============================================================

const MAP_W = 780;
const MAP_H = 620;

const tooltip = d3.select("#tooltip");

let data = [];
let byId = new Map();
let topics = [];
let topicColor;

// interaction state
let selected = null;        // selected passage
let selectedCell = null;    // {row, topic}
let query = "";
let sectionFilter = "";
let topicFilter = "";
let rowMode = "section";
let valueMode = "count";

let mapSvg, pointG, linkG, zoomBehavior, xScale, yScale, rScale;

// ------------------------------------------------------------ load
Promise.all([
    d3.csv("../data/lab8_embedding_map.csv", d => ({
        ...d,
        page: +d.page,
        word_count: +d.word_count,
        cluster: +d.cluster,
        x: +d.x,
        y: +d.y,
        outlier_score: +d.outlier_score,
        neighbors: [1, 2, 3, 4, 5].map(k => ({
            id: d["nn" + k],
            sim: +d["nn" + k + "_sim"]
        }))
    })),
    d3.csv("../data/lab8_corpus_terms.csv", d => ({
        ...d,
        n_passages: +d.n_passages,
        avg_words: +d.avg_words
    }))
]).then(([passages, terms]) => {

    data = passages;
    byId = new Map(data.map(d => [d.passage_id, d]));

    topics = Array.from(
        d3.rollup(data, v => v.length, d => d.cluster_name)
    ).sort((a, b) => b[1] - a[1]).map(d => d[0]);

    topicColor = d3.scaleOrdinal()
        .domain(topics)
        .range(["#4e79a7", "#f28e2b", "#59a14f", "#e15759",
                "#b07aa1", "#76b7b2", "#edc949", "#9c755f"]);

    drawChapterChart();
    drawTermsTable(terms);
    initMap();
    initLegend();
    initControls();
    drawMatrix();
    updateMap();
});

// =================================================== corpus overview
function drawChapterChart() {

    const w = 460, h = 300;
    const margin = { top: 8, right: 60, bottom: 34, left: 52 };

    const rows = Array.from(
        d3.rollup(data, v => ({
            n: v.length,
            words: d3.mean(v, d => d.word_count)
        }), d => d.chapter),
        ([chapter, v]) => ({ chapter, ...v })
    ).sort((a, b) => partNumber(a.chapter) - partNumber(b.chapter));

    const y = d3.scaleBand()
        .domain(rows.map(d => d.chapter))
        .range([margin.top, h - margin.bottom])
        .padding(0.2);

    const x = d3.scaleLinear()
        .domain([0, d3.max(rows, d => d.n)])
        .range([margin.left, w - margin.right]);

    const svg = d3.select("#chapter-chart").append("svg")
        .attr("viewBox", [0, 0, w, h])
        .attr("class", "plain-svg");

    svg.append("g")
        .attr("transform", `translate(0,${h - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(5))
        .call(g => g.append("text")
            .attr("x", (w + margin.left) / 2).attr("y", 30)
            .attr("fill", "#444").attr("text-anchor", "middle")
            .text("Passages"));

    svg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).tickFormat(d => "Part " + partNumber(d)));

    svg.append("g").selectAll("rect")
        .data(rows)
        .join("rect")
        .attr("class", "chapter-bar")
        .attr("x", x(0))
        .attr("y", d => y(d.chapter))
        .attr("width", d => x(d.n) - x(0))
        .attr("height", y.bandwidth())
        .on("mouseover", (event, d) => {
            showTip(event, `<strong>${d.chapter}</strong><br>
                ${d.n} passages<br>
                ${d.words.toFixed(0)} words on average`);
        })
        .on("mousemove", moveTip)
        .on("mouseout", hideTip);

    svg.append("g").selectAll("text")
        .data(rows)
        .join("text")
        .attr("class", "bar-value")
        .attr("x", d => x(d.n) + 5)
        .attr("y", d => y(d.chapter) + y.bandwidth() / 2 + 4)
        .text(d => d.n);
}

function partNumber(chapter) {
    const m = chapter.match(/Part (\d+)/);
    return m ? +m[1] : 99;
}

function drawTermsTable(terms) {
    const rows = terms.slice(0, 12);
    const table = d3.select("#terms-table").append("table");

    table.append("thead").append("tr").selectAll("th")
        .data(["Section", "Passages", "Avg words", "Top terms"])
        .join("th").text(d => d);

    const tr = table.append("tbody").selectAll("tr")
        .data(rows).join("tr");

    tr.append("td").attr("class", "sec-name").text(d => d.section);
    tr.append("td").text(d => d.n_passages);
    tr.append("td").text(d => d.avg_words);
    tr.append("td").attr("class", "terms").text(d => d.top_terms);
}

// ====================================================== semantic map
function initMap() {

    const pad = 24;
    xScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.x)).range([pad, MAP_W - pad]);
    yScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.y)).range([MAP_H - pad, pad]);
    rScale = d3.scaleSqrt()
        .domain(d3.extent(data, d => d.word_count)).range([2.5, 8]);

    mapSvg = d3.select("#map").append("svg")
        .attr("viewBox", [0, 0, MAP_W, MAP_H])
        .attr("class", "map-svg");

    const root = mapSvg.append("g").attr("class", "zoom-root");
    linkG = root.append("g").attr("class", "nn-links");
    pointG = root.append("g").attr("class", "points");

    pointG.selectAll("circle")
        .data(data, d => d.passage_id)
        .join("circle")
        .attr("class", "passage")
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y))
        .attr("r", d => rScale(d.word_count))
        .attr("fill", d => topicColor(d.cluster_name))
        .on("mouseover", (event, d) => showTip(event, `
            <strong>${d.section}</strong>${d.subsection ? "<br>" + d.subsection : ""}
            <br>Page ${d.page} · ${d.cluster_name}
            <br><span class="tip-text">${d.text.slice(0, 150)}…</span>`))
        .on("mousemove", moveTip)
        .on("mouseout", hideTip)
        .on("click", (event, d) => {
            selected = (selected && selected.passage_id === d.passage_id) ? null : d;
            selectedCell = null;
            showDetail();
            updateMap();
            updateMatrixSelection();
        });

    zoomBehavior = d3.zoom()
        .scaleExtent([0.6, 12])
        .on("zoom", event => {
            root.attr("transform", event.transform);
            root.selectAll("circle")
                .attr("r", d => rScale(d.word_count) / Math.sqrt(event.transform.k))
                .attr("stroke-width", 1.4 / event.transform.k);
            linkG.selectAll("line").attr("stroke-width", 1.6 / event.transform.k);
        });

    mapSvg.call(zoomBehavior);
}

function visible(d) {
    if (sectionFilter && d.section !== sectionFilter) return false;
    if (topicFilter && d.cluster_name !== topicFilter) return false;
    if (selectedCell) {
        const key = rowMode === "chapter" ? d.chapter : d.section;
        if (key !== selectedCell.row || d.cluster_name !== selectedCell.topic) return false;
    }
    if (query && !d.text.toLowerCase().includes(query)) return false;
    return true;
}

function updateMap() {

    const nnIds = selected ? new Set(selected.neighbors.map(n => n.id)) : new Set();
    const showOutliers = d3.select("#outlier-toggle").property("checked");

    pointG.selectAll("circle")
        .attr("opacity", d => {
            if (selected && d.passage_id === selected.passage_id) return 1;
            if (nnIds.has(d.passage_id)) return 1;
            return visible(d) ? 0.85 : 0.06;
        })
        .attr("stroke", d => {
            if (selected && d.passage_id === selected.passage_id) return "#111";
            if (nnIds.has(d.passage_id)) return "#e8590c";
            if (showOutliers && d.outlier_score > 0.72 && visible(d)) return "#333";
            return "none";
        })
        .attr("stroke-width", d =>
            (selected && d.passage_id === selected.passage_id) ? 2.4 : 1.4);

    // links to nearest neighbours
    const links = selected
        ? selected.neighbors.filter(n => byId.has(n.id))
            .map(n => ({ source: selected, target: byId.get(n.id), sim: n.sim }))
        : [];

    linkG.selectAll("line")
        .data(links, d => d.target.passage_id)
        .join("line")
        .attr("x1", d => xScale(d.source.x))
        .attr("y1", d => yScale(d.source.y))
        .attr("x2", d => xScale(d.target.x))
        .attr("y2", d => yScale(d.target.y))
        .attr("stroke", "#e8590c")
        .attr("stroke-width", 1.6)
        .attr("opacity", 0.75);

    const shown = data.filter(visible).length;
    let msg = `${shown} of ${data.length} passages shown`;
    if (query) msg += ` · matching “${query}”`;
    if (selectedCell) msg += ` · cell: ${selectedCell.topic}`;
    d3.select("#map-status").text(msg);
}

function showDetail() {
    const panel = d3.select("#detail-panel");

    if (!selected) {
        panel.html(`<p class="placeholder">Click a passage in the map to see its
            text, its place in the bulletin, and its nearest semantic
            neighbours.</p>`);
        return;
    }

    const d = selected;
    const neighbours = d.neighbors
        .filter(n => byId.has(n.id))
        .map(n => {
            const nb = byId.get(n.id);
            return `<li>
                <button class="nn-link" data-id="${nb.passage_id}">${nb.section}</button>
                <span class="nn-meta">p.${nb.page} · sim ${n.sim.toFixed(3)}
                ${nb.section === d.section ? "" : " · other section"}</span>
                <span class="nn-text">${nb.text.slice(0, 120)}…</span>
            </li>`;
        }).join("");

    panel.html(`
        <div class="detail-head" style="border-color:${topicColor(d.cluster_name)}">
            <h3>${d.section}</h3>
            <p class="detail-meta">
                ${d.chapter}${d.subsection ? " · " + d.subsection : ""}<br>
                Page ${d.page} · ${d.word_count} words · ${d.passage_id}
            </p>
            <p class="detail-topic">
                <span class="dot" style="background:${topicColor(d.cluster_name)}"></span>
                ${d.cluster_name}
                <span class="nn-meta">· atypicality ${d.outlier_score.toFixed(2)}</span>
            </p>
        </div>
        <p class="detail-text">${d.text}</p>
        <h4>Nearest semantic neighbours</h4>
        <ul class="nn-list">${neighbours}</ul>
    `);

    panel.selectAll(".nn-link").on("click", function () {
        selected = byId.get(this.dataset.id);
        selectedCell = null;
        showDetail();
        updateMap();
        updateMatrixSelection();
    });
}

function initLegend() {
    d3.select("#legend-topic").selectAll("div")
        .data(topics)
        .join("div")
        .attr("class", "legend-item")
        .html(d => `<i class="legend-swatch" style="background:${topicColor(d)}"></i>${d}`)
        .on("click", (event, d) => {
            topicFilter = topicFilter === d ? "" : d;
            d3.select("#topic-filter").property("value", topicFilter);
            updateMap();
        });
}

// ========================================================== controls
function initControls() {

    const sections = Array.from(new Set(data.map(d => d.section))).sort();
    d3.select("#section-filter").selectAll("option.sec")
        .data(sections).join("option").attr("class", "sec")
        .attr("value", d => d).text(d => d.length > 48 ? d.slice(0, 48) + "…" : d);

    d3.select("#topic-filter").selectAll("option.top")
        .data(topics).join("option").attr("class", "top")
        .attr("value", d => d).text(d => d);

    d3.select("#search").on("input", function () {
        query = this.value.toLowerCase().trim();
        updateMap();
    });

    d3.select("#section-filter").on("change", function () {
        sectionFilter = this.value;
        updateMap();
    });

    d3.select("#topic-filter").on("change", function () {
        topicFilter = this.value;
        updateMap();
    });

    d3.select("#outlier-toggle").on("change", updateMap);

    d3.select("#reset-view").on("click", () => {
        query = "";
        sectionFilter = "";
        topicFilter = "";
        selected = null;
        selectedCell = null;
        d3.select("#search").property("value", "");
        d3.select("#section-filter").property("value", "");
        d3.select("#topic-filter").property("value", "");
        mapSvg.transition().duration(500)
            .call(zoomBehavior.transform, d3.zoomIdentity);
        showDetail();
        updateMap();
        updateMatrixSelection();
    });

    d3.select("#row-mode").on("change", function () {
        rowMode = this.value;
        selectedCell = null;
        drawMatrix();
        updateMap();
    });

    d3.select("#value-mode").on("change", function () {
        valueMode = this.value;
        drawMatrix();
    });

    d3.select("#clear-cell").on("click", () => {
        selectedCell = null;
        updateMap();
        updateMatrixSelection();
    });
}

// ============================================ topic x section matrix
function drawMatrix() {

    d3.select("#matrix").html("");

    const keyOf = d => (rowMode === "chapter" ? d.chapter : d.section);

    let rows = Array.from(d3.rollup(data, v => v.length, keyOf))
        .filter(([, n]) => rowMode === "chapter" || n >= 4)
        .sort((a, b) => rowMode === "chapter"
            ? partNumber(a[0]) - partNumber(b[0])
            : b[1] - a[1])
        .map(d => d[0]);

    const counts = d3.rollup(data, v => v.length, keyOf, d => d.cluster_name);
    const rowTotal = new Map(rows.map(r => [r, d3.sum(topics, t =>
        (counts.get(r) && counts.get(r).get(t)) || 0)]));

    const cell = 30;
    const margin = { top: 228, right: 178, bottom: 16, left: 330 };
    const w = margin.left + topics.length * cell + margin.right;
    const h = margin.top + rows.length * cell + margin.bottom;

    const value = (r, t) => {
        const c = (counts.get(r) && counts.get(r).get(t)) || 0;
        return valueMode === "count" ? c : (rowTotal.get(r) ? c / rowTotal.get(r) : 0);
    };

    const maxValue = d3.max(rows, r => d3.max(topics, t => value(r, t)));
    const color = d3.scaleSequential()
        .domain([0, Math.sqrt(maxValue)])
        .interpolator(d3.interpolateBlues);

    const svg = d3.select("#matrix").append("svg")
        .attr("viewBox", [0, 0, w, h])
        .attr("width", w)
        .attr("class", "matrix-svg");

    // column headers
    svg.append("g").selectAll("text")
        .data(topics)
        .join("text")
        .attr("class", "matrix-col")
        .attr("transform", (d, i) =>
            `translate(${margin.left + i * cell + cell / 2},${margin.top - 10}) rotate(-52)`)
        .text(d => d);

    svg.append("g").selectAll("rect")
        .data(topics)
        .join("rect")
        .attr("x", (d, i) => margin.left + i * cell + 4)
        .attr("y", margin.top - 7)
        .attr("width", cell - 8)
        .attr("height", 4)
        .attr("fill", d => topicColor(d));

    // row labels
    svg.append("g").selectAll("text")
        .data(rows)
        .join("text")
        .attr("class", "matrix-row")
        .attr("x", margin.left - 10)
        .attr("y", (d, i) => margin.top + i * cell + cell / 2 + 4)
        .text(d => d.length > 46 ? d.slice(0, 46) + "…" : d)
        .append("title").text(d => d);

    // cells
    const cells = [];
    rows.forEach((r, i) => topics.forEach((t, j) => {
        cells.push({ row: r, topic: t, i, j, v: value(r, t),
                     n: (counts.get(r) && counts.get(r).get(t)) || 0 });
    }));

    svg.append("g").selectAll("rect.cell")
        .data(cells)
        .join("rect")
        .attr("class", "cell")
        .attr("x", d => margin.left + d.j * cell)
        .attr("y", d => margin.top + d.i * cell)
        .attr("width", cell - 2)
        .attr("height", cell - 2)
        .attr("fill", d => d.n === 0 ? "#f5f5f5" : color(Math.sqrt(d.v)))
        .on("mouseover", (event, d) => showTip(event, `
            <strong>${d.row}</strong><br>${d.topic}<br>
            ${d.n} passages · ${(100 * d.n / (rowTotal.get(d.row) || 1)).toFixed(0)}% of this row`))
        .on("mousemove", moveTip)
        .on("mouseout", hideTip)
        .on("click", (event, d) => {
            if (d.n === 0) return;
            selectedCell = (selectedCell && selectedCell.row === d.row
                && selectedCell.topic === d.topic) ? null : { row: d.row, topic: d.topic };
            selected = null;
            showDetail();
            updateMap();
            updateMatrixSelection();
        });

    svg.append("g").selectAll("text.cell-value")
        .data(cells.filter(d => d.n > 0))
        .join("text")
        .attr("class", "cell-value")
        .attr("x", d => margin.left + d.j * cell + (cell - 2) / 2)
        .attr("y", d => margin.top + d.i * cell + (cell - 2) / 2 + 4)
        .attr("fill", d => Math.sqrt(d.v) > 0.6 * Math.sqrt(maxValue) ? "white" : "#333")
        .text(d => valueMode === "count" ? d.n : Math.round(100 * d.v) + "%");

    updateMatrixSelection();
}

function updateMatrixSelection() {
    const target = selected
        ? { row: rowMode === "chapter" ? selected.chapter : selected.section,
            topic: selected.cluster_name }
        : selectedCell;

    d3.selectAll("#matrix .cell")
        .classed("selected", d =>
            target && d.row === target.row && d.topic === target.topic);
}

// =========================================================== tooltip
function showTip(event, html) {
    tooltip.style("opacity", 1).html(html);
    moveTip(event);
}

function moveTip(event) {
    tooltip
        .style("left", `${event.pageX + 14}px`)
        .style("top", `${event.pageY - 10}px`);
}

function hideTip() {
    tooltip.style("opacity", 0);
}
