const width = 900;
const height = 560;

const tooltip = d3.select("#tooltip");
const formatMoney = d3.format("$,.0f");
const formatDate = d3.timeFormat("%Y-%m-%d");
const parseDate = d3.timeParse("%Y-%m-%d");



const sectors = [
    "Manufacturing", "Logistics", "Retail", "Food",
    "Technology", "Wholesale", "Materials"
];
const sectorColor = d3.scaleOrdinal()
    .domain(sectors)
    .range(["#4e79a7", "#f28e2b", "#e15759", "#59a14f",
            "#b07aa1", "#9c755f", "#76b7b2"]);

const regions = ["Asia", "Europe", "North America"];
const regionShape = d3.scaleOrdinal()
    .domain(regions)
    .range([d3.symbolCircle, d3.symbolSquare, d3.symbolTriangle]);


const regionAnchor = {
    "Asia":          { x: width * 0.24, y: height * 0.36 },
    "Europe":        { x: width * 0.76, y: height * 0.36 },
    "North America": { x: width * 0.50, y: height * 0.76 }
};

const types = ["goods", "shipping", "components", "materials", "services"];
const typeColor = d3.scaleOrdinal()
    .domain(types)
    .range(["#1b9e77", "#d95f02", "#7570b3", "#a6761d", "#e7298a"]);


let companies, transactions, companyById, dateByDay;
let currentDay = 1;
let windowSize = 1;
let timer = null;
let speed = 900;
let previousKeys = new Set();
let maxLinkAmount = {};
let maxVolume = {};
let hoveredId = null;


Promise.all([
    d3.csv("../data/lab7_assignment_companies.csv"),
    d3.csv("../data/lab7_assignment_transactions_60days.csv", d => ({
        date: parseDate(d.date),
        day: +d.day,
        source: d.source,
        target: d.target,
        amount_usd: +d.amount_usd,
        transaction_type: d.transaction_type,
        transaction_count: +d.transaction_count
    }))
]).then(([companyData, transactionData]) => {

    companies = companyData.map(d => ({ ...d }));
    transactions = transactionData;
    companyById = new Map(companies.map(d => [d.id, d]));

    dateByDay = new Map();
    transactions.forEach(d => dateByDay.set(d.day, d.date));

    precomputeScales();
    initNetwork();
    initOverview();
    initLegend();
    initControls();

    showDay(1);
});


function pairKey(a, b) {
    return a < b ? `${a}-${b}` : `${b}-${a}`;
}

function getWindowLinks(day, size) {
    const startDay = Math.max(1, day - size + 1);
    const inWindow = transactions.filter(
        d => d.day >= startDay && d.day <= day
    );

    // Treat links as undirected: merge A-B and B-A
    const grouped = d3.group(inWindow, d => pairKey(d.source, d.target));

    return Array.from(grouped, ([key, rows]) => {
        const [a, b] = key.split("-");
        const amountByType = d3.rollup(
            rows, v => d3.sum(v, d => d.amount_usd), d => d.transaction_type
        );
        const mainType = d3.greatest(amountByType, d => d[1])[0];

        return {
            key,
            sourceId: a,
            targetId: b,
            amount: d3.sum(rows, d => d.amount_usd),
            count: d3.sum(rows, d => d.transaction_count),
            mainType,
            types: Array.from(amountByType.keys()),
            lastDay: d3.max(rows, d => d.day),
            activeDays: rows.length,
            crossRegional:
                companyById.get(a).region !== companyById.get(b).region
        };
    });
}

function calculateVolume(companyId, currentLinks) {
    return d3.sum(
        currentLinks.filter(
            d => d.sourceId === companyId || d.targetId === companyId
        ),
        d => d.amount
    );
}


function precomputeScales() {
    [1, 7].forEach(size => {
        let maxL = 0;
        let maxV = 0;
        for (let day = 1; day <= 60; day++) {
            const links = getWindowLinks(day, size);
            maxL = Math.max(maxL, d3.max(links, d => d.amount) || 0);
            companies.forEach(c => {
                maxV = Math.max(maxV, calculateVolume(c.id, links));
            });
        }
        maxLinkAmount[size] = maxL;
        maxVolume[size] = maxV;
    });
}

function linkWidthScale() {
    return d3.scaleLinear()
        .domain([0, maxLinkAmount[windowSize]])
        .range([1.5, 11]);
}

function nodeAreaScale() {
    
    return d3.scaleLinear()
        .domain([0, maxVolume[windowSize]])
        .range([160, 2600]);
}

// ---------- Network ----------

let svg, linkGroup, nodeGroup, labelGroup, simulation, linkForce;

function initNetwork() {

    svg = d3.select("#network")
        .append("svg")
        .attr("viewBox", [0, 0, width, height])
        .attr("class", "network-svg");

    // Faint region labels in the background
    svg.append("g")
        .selectAll("text")
        .data(regions)
        .join("text")
        .attr("class", "region-bg-label")
        .attr("x", d => regionAnchor[d].x)
        .attr("y", d => d === "North America"
            ? regionAnchor[d].y + 105
            : regionAnchor[d].y - 95)
        .attr("text-anchor", "middle")
        .text(d => d);

    linkGroup = svg.append("g").attr("class", "links");
    nodeGroup = svg.append("g").attr("class", "nodes");
    labelGroup = svg.append("g").attr("class", "labels");

   
    d3.groups(companies, d => d.region).forEach(([region, group]) => {
        group.forEach((d, i) => {
            const angle = (2 * Math.PI * i) / group.length;
            d.x = regionAnchor[region].x + 70 * Math.cos(angle);
            d.y = regionAnchor[region].y + 70 * Math.sin(angle);
        });
    });

    linkForce = d3.forceLink()
        .id(d => d.id)
        .distance(110)
        .strength(0.15);


    simulation = d3.forceSimulation(companies)
        .force("link", linkForce)
        .force("charge", d3.forceManyBody().strength(-260))
        .force("collide", d3.forceCollide(34))
        .force("x", d3.forceX(d => regionAnchor[d.region].x).strength(0.22))
        .force("y", d3.forceY(d => regionAnchor[d.region].y).strength(0.22))
        .on("tick", ticked);


    nodeGroup.selectAll("path")
        .data(companies, d => d.id)
        .join("path")
        .attr("class", "company-node")
        .attr("fill", d => sectorColor(d.sector))
        .on("mouseover", (event, d) => {
            hoveredId = d.id;
            applyHighlight();
            showNodeTooltip(event, d);
        })
        .on("mousemove", moveTooltip)
        .on("mouseout", () => {
            hoveredId = null;
            applyHighlight();
            hideTooltip();
        })
        .call(drag());

    labelGroup.selectAll("text")
        .data(companies, d => d.id)
        .join("text")
        .attr("class", "company-label")
        .text(d => d.company_name.split(" ")[0]);
}

function ticked() {
    linkGroup.selectAll("line")
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

    nodeGroup.selectAll("path")
        .attr("transform", d => `translate(${d.x},${d.y})`);

    labelGroup.selectAll("text")
        .attr("x", d => d.x)
        .attr("y", d => d.y + (d.r || 12) + 13);
}

function drag() {
    return d3.drag()
        .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.2).restart();
            d.fx = d.x;
            d.fy = d.y;
        })
        .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
        })
        .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        });
}

function linkOpacity(d) {
    if (windowSize === 1) return 0.75;
    // Recency: active today → opaque, 6 days ago → faint
    const age = currentDay - d.lastDay;
    return 0.25 + 0.6 * (1 - age / windowSize);
}

// ---------- Show one day ----------

function showDay(day) {

    currentDay = day;

    const currentLinks = getWindowLinks(day, windowSize);

    // Attach node objects for the force simulation
    currentLinks.forEach(d => {
        d.source = companyById.get(d.sourceId);
        d.target = companyById.get(d.targetId);
    });

    updateNetwork(currentLinks);
    updateSummary(day, currentLinks);
    updateOverview(day);

    d3.select("#time-slider").property("value", day);

    previousKeys = new Set(currentLinks.map(d => d.key));
}

function updateNetwork(currentLinks) {

    const widthScale = linkWidthScale();
    const areaScale = nodeAreaScale();
    const t = svg.transition().duration(400);

    linkGroup.selectAll("line")
        .data(currentLinks, d => d.key)
        .join(
            enter => enter.append("line")
                .attr("class", "company-link")
                .attr("stroke", d => typeColor(d.mainType))
                .attr("stroke-width", d => widthScale(d.amount) + 5)
                .attr("opacity", 0)
                .call(enter => enter.transition(t)
                    .attr("opacity", 1)
                    // new link: flash thicker, then settle
                    .transition()
                    .duration(500)
                    .attr("stroke-width", d => widthScale(d.amount))
                    .attr("opacity", d => linkOpacity(d))),

            update => update
                .call(update => update.transition(t)
                    .attr("stroke", d => typeColor(d.mainType))
                    .attr("stroke-width", d => widthScale(d.amount))
                    .attr("opacity", d => linkOpacity(d))),

            exit => exit
                .call(exit => exit.transition(t)
                    .attr("opacity", 0)
                    .remove())
        )
        .on("mouseover", showLinkTooltip)
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip);

    // Dynamic node properties
    companies.forEach(c => {
        c.volume = calculateVolume(c.id, currentLinks);
        c.partners = currentLinks
            .filter(d => d.sourceId === c.id || d.targetId === c.id)
            .map(d => companyById.get(
                d.sourceId === c.id ? d.targetId : d.sourceId
            ).company_name);
        c.area = areaScale(c.volume);
        c.r = Math.sqrt(c.area / Math.PI);
    });

    nodeGroup.selectAll("path")
        .classed("inactive", d => d.volume === 0)
        .transition(t)
        .attr("d", d =>
            d3.symbol().type(regionShape(d.region)).size(d.area)()
        );

    labelGroup.selectAll("text")
        .classed("inactive", d => d.volume === 0);

    // Gentle restart: same nodes, only links change
    linkForce.links(currentLinks);
    simulation.alpha(0.3).restart();

    applyHighlight();
}

function applyHighlight() {
    if (!hoveredId) {
        linkGroup.selectAll("line").classed("dimmed", false);
        nodeGroup.selectAll("path").classed("dimmed", false);
        return;
    }
    const partners = new Set([hoveredId]);
    linkGroup.selectAll("line").each(d => {
        if (d.sourceId === hoveredId) partners.add(d.targetId);
        if (d.targetId === hoveredId) partners.add(d.sourceId);
    });
    linkGroup.selectAll("line").classed(
        "dimmed", d => d.sourceId !== hoveredId && d.targetId !== hoveredId
    );
    nodeGroup.selectAll("path").classed("dimmed", d => !partners.has(d.id));
}

// ---------- Summary ----------

function updateSummary(day, currentLinks) {

    const startDay = Math.max(1, day - windowSize + 1);

    d3.select("#day-label").text(
        windowSize === 1 ? `Day ${day}` : `Days ${startDay}–${day}`
    );
    d3.select("#date-label").text(
        windowSize === 1
            ? formatDate(dateByDay.get(day))
            : `${formatDate(dateByDay.get(startDay))} to ${formatDate(dateByDay.get(day))}`
    );

    const activeCompanies = new Set(
        currentLinks.flatMap(d => [d.sourceId, d.targetId])
    ).size;
    const totalValue = d3.sum(currentLinks, d => d.amount);
    const crossShare = currentLinks.length
        ? d3.mean(currentLinks, d => d.crossRegional ? 1 : 0)
        : 0;

    d3.select("#stat-companies").text(activeCompanies);
    d3.select("#stat-links").text(currentLinks.length);
    d3.select("#stat-value").text(formatMoney(totalValue));
    d3.select("#stat-cross").text(d3.format(".0%")(crossShare));
}

// ---------- Overview bar chart (static view of all 60 days) ----------

let overviewX, overviewSvg;

function initOverview() {

    const ow = 900;
    const oh = 170;
    const margin = { top: 10, right: 20, bottom: 36, left: 70 };

    const daily = d3.range(1, 61).map(day => ({
        day,
        value: d3.sum(
            transactions.filter(d => d.day === day),
            d => d.amount_usd
        )
    }));

    overviewX = d3.scaleBand()
        .domain(daily.map(d => d.day))
        .range([margin.left, ow - margin.right])
        .padding(0.15);

    const y = d3.scaleLinear()
        .domain([0, d3.max(daily, d => d.value)])
        .nice()
        .range([oh - margin.bottom, margin.top]);

    overviewSvg = d3.select("#overview")
        .append("svg")
        .attr("viewBox", [0, 0, ow, oh])
        .attr("class", "overview-svg");

    overviewSvg.append("g")
        .attr("transform", `translate(0,${oh - margin.bottom})`)
        .call(d3.axisBottom(overviewX)
            .tickValues(d3.range(5, 61, 5)))
        .call(g => g.append("text")
            .attr("x", (ow + margin.left) / 2)
            .attr("y", 30)
            .attr("fill", "#444")
            .attr("text-anchor", "middle")
            .text("Day"));

    overviewSvg.append("g")
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format("$.2s")));

    overviewSvg.append("g")
        .selectAll("rect")
        .data(daily)
        .join("rect")
        .attr("class", "overview-bar")
        .attr("x", d => overviewX(d.day))
        .attr("y", d => y(d.value))
        .attr("width", overviewX.bandwidth())
        .attr("height", d => y(0) - y(d.value))
        .on("click", (event, d) => {
            pause();
            showDay(d.day);
        })
        .on("mouseover", (event, d) => {
            tooltip.style("opacity", 1).html(
                `<strong>Day ${d.day}</strong><br>
                 ${formatDate(dateByDay.get(d.day))}<br>
                 Total value: ${formatMoney(d.value)}`
            );
            moveTooltip(event);
        })
        .on("mousemove", moveTooltip)
        .on("mouseout", hideTooltip);
}

function updateOverview(day) {
    const startDay = Math.max(1, day - windowSize + 1);
    overviewSvg.selectAll(".overview-bar")
        .classed("current", d => d.day >= startDay && d.day <= day);
}

// ---------- Tooltips ----------

function showNodeTooltip(event, d) {
    const partnerText = d.partners.length
        ? d.partners.join(", ")
        : "None in this window";

    tooltip.style("opacity", 1).html(`
        <strong>${d.company_name}</strong> (${d.id})<br>
        Sector: ${d.sector}<br>
        Region: ${d.region}<br>
        Volume in window: ${formatMoney(d.volume)}<br>
        Partners (${d.partners.length}): ${partnerText}
    `);
    moveTooltip(event);
}

function showLinkTooltip(event, d) {
    const a = companyById.get(d.sourceId);
    const b = companyById.get(d.targetId);

    tooltip.style("opacity", 1).html(`
        <strong>${a.company_name} — ${b.company_name}</strong><br>
        ${d.crossRegional ? "Cross-regional" : "Same region"}
        (${a.region} / ${b.region})<br>
        Amount: ${formatMoney(d.amount)}<br>
        Transactions: ${d.count}<br>
        Main type: ${d.mainType}
        ${d.types.length > 1 ? `<br>All types: ${d.types.join(", ")}` : ""}
        ${windowSize > 1 ? `<br>Active days in window: ${d.activeDays}
            <br>Last active: Day ${d.lastDay}` : ""}
    `);
    moveTooltip(event);
}

function moveTooltip(event) {
    tooltip
        .style("left", `${event.pageX + 14}px`)
        .style("top", `${event.pageY - 12}px`);
}

function hideTooltip() {
    tooltip.style("opacity", 0);
}

// ---------- Legend ----------

function initLegend() {

    d3.select("#legend-sector")
        .selectAll("div")
        .data(sectors)
        .join("div")
        .attr("class", "legend-item")
        .html(d =>
            `<i class="legend-swatch" style="background:${sectorColor(d)}"></i>${d}`
        );

    const regionItems = d3.select("#legend-region")
        .selectAll("div")
        .data(regions)
        .join("div")
        .attr("class", "legend-item");

    regionItems.append("svg")
        .attr("width", 20)
        .attr("height", 20)
        .append("path")
        .attr("transform", "translate(10,10)")
        .attr("fill", "#888")
        .attr("d", d => d3.symbol().type(regionShape(d)).size(120)());

    regionItems.append("span").text(d => d);

    d3.select("#legend-type")
        .selectAll("div")
        .data(types)
        .join("div")
        .attr("class", "legend-item")
        .html(d =>
            `<i class="legend-line" style="background:${typeColor(d)}"></i>${d}`
        );
}

// ---------- Animation controls ----------

function play() {
    if (timer) return;
    if (currentDay >= 60) showDay(1);

    timer = d3.interval(() => {
        if (currentDay >= 60) {
            pause();
            return;
        }
        showDay(currentDay + 1);
    }, speed);
}

function pause() {
    if (timer) {
        timer.stop();
        timer = null;
    }
}

function reset() {
    pause();
    showDay(1);
}

function initControls() {

    d3.select("#play").on("click", play);
    d3.select("#pause").on("click", pause);
    d3.select("#reset").on("click", reset);

    d3.select("#time-slider").on("input", function () {
        pause();
        showDay(+this.value);
    });

    d3.select("#window-mode").on("change", function () {
        windowSize = +this.value;
        showDay(currentDay);
    });

    d3.select("#speed").on("change", function () {
        speed = +this.value;
        if (timer) {
            pause();
            play();
        }
    });
}