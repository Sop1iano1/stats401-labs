const GDP_FILE = "../data/lab9_gdp_2025_top50.csv";
const GEO_FILE = "../data/ne_110m_admin_0_countries.geojson";

let gdpData = [];
let gdpByIso = new Map();

let choroplethSvg = null;
let choroplethMapGroup = null;
let choroplethZoom = null;

let cartogramSvg = null;
let cartogramBubbleGroup = null;
let cartogramZoom = null;

let selectedIso3 = null;

const tooltip = d3.select("#tooltip");

const colorScale = d3.scaleSequentialLog(d3.interpolateBlues);

const formatGDP = d3.format(",.1f");
const formatRank = d3.format("d");


Promise.all([
    d3.csv(GDP_FILE, d3.autoType),
    d3.json(GEO_FILE)
]).then(([gdp, geojson]) => {

    gdpData = gdp;

    gdpByIso = new Map(
        gdpData.map(d => [
            d.iso3,
            d
        ])
    );

    const values = gdpData
        .map(d => d.gdp_2025_billion_usd)
        .filter(Number.isFinite);

    colorScale.domain([
        d3.min(values),
        d3.max(values)
    ]);

    updateLegend(values);

    createChoropleth(geojson);
    createCartogram(geojson);

}).catch(error => {

    console.error(error);

    d3.select("#choropleth-status")
        .text("Unable to load geographic or GDP data.");

    d3.select("#cartogram-status")
        .text("Unable to load geographic or GDP data.");

});


function getIso3(feature) {

    const p = feature.properties || {};

    const directValues = [
        p.ISO_A3,
        p.ISO_A3_EH,
        p.ADM0_A3,
        p.GU_A3,
        p.SOV_A3,
        p.WB_A3,
        p.iso_a3,
        p.ISO3,
        p.iso3
    ];

    for (const value of directValues) {

        if (
            typeof value === "string" &&
            /^[A-Z]{3}$/.test(value) &&
            value !== "-99"
        ) {
            return value;
        }

    }

    const nameValues = [
        p.NAME,
        p.NAME_EN,
        p.ADMIN,
        p.NAME_LONG,
        p.SOVEREIGNT,
        p.BRK_NAME,
        p.formal_en
    ];

    const nameToIso = {

        "united states of america": "USA",
        "united states": "USA",

        "china": "CHN",
        "people's republic of china": "CHN",

        "germany": "DEU",

        "japan": "JPN",

        "india": "IND",

        "united kingdom": "GBR",
        "uk": "GBR",

        "france": "FRA",

        "italy": "ITA",

        "russia": "RUS",
        "russian federation": "RUS",

        "canada": "CAN",

        "brazil": "BRA",

        "spain": "ESP",

        "mexico": "MEX",

        "south korea": "KOR",
        "republic of korea": "KOR",
        "korea, republic of": "KOR",
        "korea": "KOR",

        "australia": "AUS",

        "turkey": "TUR",
        "türkiye": "TUR",

        "indonesia": "IDN",

        "netherlands": "NLD",

        "saudi arabia": "SAU",

        "poland": "POL",

        "switzerland": "CHE",

        "taiwan": "TWN",

        "belgium": "BEL",

        "ireland": "IRL",

        "argentina": "ARG",

        "sweden": "SWE",

        "israel": "ISR",

        "singapore": "SGP",

        "united arab emirates": "ARE",

        "austria": "AUT",

        "thailand": "THA",

        "norway": "NOR",

        "philippines": "PHL",

        "vietnam": "VNM",

        "bangladesh": "BGD",

        "malaysia": "MYS",

        "denmark": "DNK",

        "colombia": "COL",

        "hong kong": "HKG",
        "hong kong sar": "HKG",
        "hong kong sar, china": "HKG",

        "south africa": "ZAF",

        "romania": "ROU",

        "pakistan": "PAK",

        "czechia": "CZE",
        "czech republic": "CZE",

        "iran": "IRN",
        "iran (islamic republic of)": "IRN",

        "egypt": "EGY",

        "chile": "CHL",

        "portugal": "PRT",

        "peru": "PER",

        "finland": "FIN",

        "kazakhstan": "KAZ"
    };

    for (const value of nameValues) {

        if (typeof value !== "string") {
            continue;
        }

        const key = value.trim().toLowerCase();

        if (nameToIso[key]) {
            return nameToIso[key];
        }

    }

    return null;
}


function updateLegend(values) {

    const minValue = d3.min(values);
    const maxValue = d3.max(values);

    d3.select("#legend-min")
        .text(`$${formatGDP(minValue)}B`);

    d3.select("#legend-max")
        .text(`$${formatGDP(maxValue)}B`);
}


function createChoropleth(geojson) {

    const container = d3.select("#choropleth");

    container.selectAll("*").remove();

    const width = Math.max(
        700,
        container.node().getBoundingClientRect().width
    );

    const height = 500;

    choroplethSvg = container
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", "100%")
        .attr("height", height)
        .attr("role", "img")
        .attr(
            "aria-label",
            "2025 nominal GDP choropleth map"
        );

    const projection = d3.geoNaturalEarth1()
        .fitSize(
            [width - 20, height - 20],
            geojson
        );

    const path = d3.geoPath()
        .projection(projection);

    choroplethMapGroup = choroplethSvg
        .append("g")
        .attr("class", "choropleth-map");

    choroplethMapGroup
        .selectAll("path.country")
        .data(geojson.features)
        .join("path")
        .attr("class", "country")
        .attr("d", path)
        .attr("fill", feature => {

            const iso3 = getIso3(feature);
            const row = gdpByIso.get(iso3);

            return row
                ? colorScale(row.gdp_2025_billion_usd)
                : "#e0e0e0";
        })
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 0.6)
        .on("mouseenter", function(event, feature) {

            const iso3 = getIso3(feature);
            const row = gdpByIso.get(iso3);

            d3.select(this)
                .classed("is-hovered", true);

            if (row) {
                showChoroplethTooltip(event, row);
            }

        })
        .on("mousemove", function(event) {

            moveTooltip(event);

        })
        .on("mouseleave", function() {

            d3.select(this)
                .classed("is-hovered", false);

            hideTooltip();

        })
        .on("click", function(event, feature) {

            event.preventDefault();
            event.stopPropagation();

            const iso3 = getIso3(feature);

            if (gdpByIso.has(iso3)) {
                setSelectedCountry(iso3);
            }

        });

    setupChoroplethZoom();

    d3.select("#choropleth-status")
        .text(
            "Hover over a country to see GDP. Click a country to highlight it in both maps."
        );

}


function setupChoroplethZoom() {

    const container = d3.select("#choropleth");

    choroplethZoom = d3.zoom()
        .scaleExtent([1, 8])
        .on("zoom", event => {

            choroplethMapGroup
                .attr("transform", event.transform);

        });

    choroplethSvg.call(choroplethZoom);

    choroplethSvg.on("dblclick.zoom", null);

    d3.select("#reset-maps")
        .on("click", resetMaps);

}


function createCartogram(geojson) {

    const container = d3.select("#cartogram");

    container.selectAll("*").remove();

    const width = Math.max(
        700,
        container.node().getBoundingClientRect().width
    );

    const height = 500;

    cartogramSvg = container
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("width", "100%")
        .attr("height", height)
        .attr("role", "img")
        .attr(
            "aria-label",
            "2025 GDP cartogram"
        );

    const projection = d3.geoNaturalEarth1()
        .fitSize(
            [width - 20, height - 20],
            geojson
        );

    const path = d3.geoPath()
        .projection(projection);

    const backgroundGroup = cartogramSvg
        .append("g")
        .attr("class", "cartogram-background");

    backgroundGroup
        .selectAll("path")
        .data(geojson.features)
        .join("path")
        .attr("d", path)
        .attr("fill", "#f3f3f3")
        .attr("stroke", "#d0d0d0")
        .attr("stroke-width", 0.5)
        .attr("opacity", 0.75);

    cartogramBubbleGroup = cartogramSvg
        .append("g")
        .attr("class", "cartogram-bubbles");

    const points = gdpData.map(d => {

        let coordinates;

        const feature = geojson.features.find(
            feature => getIso3(feature) === d.iso3
        );

        if (feature) {

            coordinates = d3.geoCentroid(feature);

        } else {

            const fallbackCoordinates = {

                SGP: [103.8198, 1.3521],
                HKG: [114.1694, 22.3193]

            };

            coordinates = fallbackCoordinates[d.iso3] || [0, 0];

        }

        const projected = projection(coordinates);

        return {
            ...d,
            x: projected[0],
            y: projected[1],
            targetX: projected[0],
            targetY: projected[1]
        };

    });

    const radiusScale = d3.scaleSqrt()
        .domain([
            d3.min(points, d => d.gdp_2025_billion_usd),
            d3.max(points, d => d.gdp_2025_billion_usd)
        ])
        .range([5, 82]);

    points.forEach(d => {

        d.radius = radiusScale(
            d.gdp_2025_billion_usd
        );

    });

    const simulation = d3.forceSimulation(points)
        .force(
            "x",
            d3.forceX(d => d.targetX)
                .strength(0.45)
        )
        .force(
            "y",
            d3.forceY(d => d.targetY)
                .strength(0.45)
        )
        .force(
            "collision",
            d3.forceCollide(
                d => d.radius + 2
            )
        )
        .stop();

    for (let i = 0; i < 250; i++) {
        simulation.tick();
    }

    const bubbles = cartogramBubbleGroup
        .selectAll("circle.cartogram-country")
        .data(points)
        .join("circle")
        .attr("class", "cartogram-country")
        .attr("cx", d => d.x)
        .attr("cy", d => d.y)
        .attr("r", d => d.radius)
        .attr(
            "fill",
            d => colorScale(
                d.gdp_2025_billion_usd
            )
        )
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 1)
        .on("mouseenter", function(event, d) {

            showCartogramTooltip(event, d);

        })
        .on("mousemove", function(event) {

            moveTooltip(event);

        })
        .on("mouseleave", function() {

            hideTooltip();

        })
        .on("click", function(event, d) {

            event.preventDefault();
            event.stopPropagation();

            setSelectedCountry(d.iso3);

        });

    cartogramBubbleGroup
        .selectAll("text.cartogram-label")
        .data(
            points.filter(
                d => d.gdp_2025_billion_usd >= 2500
            )
        )
        .join("text")
        .attr("class", "cartogram-label")
        .attr("x", d => d.x)
        .attr(
            "y",
            d => d.y + 4
        )
        .attr("text-anchor", "middle")
        .text(d => d.iso3)
        .style("pointer-events", "none");

    cartogramZoom = d3.zoom()
        .scaleExtent([0.8, 8])
        .on("zoom", event => {

            backgroundGroup
                .attr("transform", event.transform);

            cartogramBubbleGroup
                .attr("transform", event.transform);

        });

    cartogramSvg.call(cartogramZoom);

    cartogramSvg.on("click", function(event) {

        if (event.target === cartogramSvg.node()) {
            setSelectedCountry(null);
        }

    });

    d3.select("#cartogram-status")
        .text(
            "Hover over a country to see GDP. Click a country to highlight it in both maps. Circle area represents GDP."
        );

}


function setSelectedCountry(iso3) {

    selectedIso3 = iso3;

    updateChoroplethSelection();
    updateCartogramSelection();

    const selectionStatus = d3.select(
        "#selection-status"
    );

    if (!iso3) {

        selectionStatus
            .text("No country selected.");

        d3.select("#choropleth-status")
            .text(
                "Hover over a country to see GDP. Click a country to highlight it in both maps."
            );

        d3.select("#cartogram-status")
            .text(
                "Hover over a country to see GDP. Click a country to highlight it in both maps. Circle area represents GDP."
            );

        return;
    }

    const row = gdpByIso.get(iso3);

    if (!row) {
        return;
    }

    selectionStatus
        .text(`${row.country} selected.`);

    d3.select("#choropleth-status")
        .text(
            `${row.country}: $${formatGDP(row.gdp_2025_billion_usd)} billion USD. Selected in both maps.`
        );

    d3.select("#cartogram-status")
        .text(
            `${row.country}: $${formatGDP(row.gdp_2025_billion_usd)} billion USD. Area represents GDP.`
        );

}


function updateChoroplethSelection() {

    if (!choroplethMapGroup) {
        return;
    }

    choroplethMapGroup
        .selectAll("path.country")
        .classed(
            "is-selected",
            feature => {

                const iso3 = getIso3(feature);

                return (
                    selectedIso3 !== null &&
                    iso3 === selectedIso3
                );

            }
        )
        .classed(
            "is-muted",
            feature => {

                const iso3 = getIso3(feature);

                return (
                    selectedIso3 !== null &&
                    iso3 !== selectedIso3 &&
                    gdpByIso.has(iso3)
                );

            }
        );

}


function updateCartogramSelection() {

    if (!cartogramBubbleGroup) {
        return;
    }

    cartogramBubbleGroup
        .selectAll("circle.cartogram-country")
        .classed(
            "is-selected",
            d =>
                selectedIso3 !== null &&
                d.iso3 === selectedIso3
        )
        .classed(
            "is-muted",
            d =>
                selectedIso3 !== null &&
                d.iso3 !== selectedIso3
        );

    cartogramBubbleGroup
        .selectAll("text.cartogram-label")
        .classed(
            "is-selected",
            d =>
                selectedIso3 !== null &&
                d.iso3 === selectedIso3
        );

}


function resetMaps() {

    selectedIso3 = null;

    updateChoroplethSelection();
    updateCartogramSelection();

    if (choroplethSvg && choroplethZoom) {

        choroplethSvg
            .transition()
            .duration(400)
            .call(
                choroplethZoom.transform,
                d3.zoomIdentity
            );

    }

    if (cartogramSvg && cartogramZoom) {

        cartogramSvg
            .transition()
            .duration(400)
            .call(
                cartogramZoom.transform,
                d3.zoomIdentity
            );

    }

    d3.select("#selection-status")
        .text("No country selected.");

    d3.select("#choropleth-status")
        .text(
            "Hover over a country to see GDP. Click a country to highlight it in both maps."
        );

    d3.select("#cartogram-status")
        .text(
            "Hover over a country to see GDP. Click a country to highlight it in both maps. Circle area represents GDP."
        );

}


function showChoroplethTooltip(event, row) {

    tooltip
        .html(`
            <strong>${row.country}</strong><br>
            GDP: $${formatGDP(row.gdp_2025_billion_usd)} billion USD<br>
            Rank: ${formatRank(row.rank)}
        `)
        .classed("visible", true);

    moveTooltip(event);

}


function showCartogramTooltip(event, row) {

    tooltip
        .html(`
            <strong>${row.country}</strong><br>
            GDP: $${formatGDP(row.gdp_2025_billion_usd)} billion USD<br>
            Rank: ${formatRank(row.rank)}<br>
            Area represents GDP
        `)
        .classed("visible", true);

    moveTooltip(event);

}


function moveTooltip(event) {

    tooltip
        .style(
            "left",
            `${event.pageX + 14}px`
        )
        .style(
            "top",
            `${event.pageY + 14}px`
        );

}


function hideTooltip() {

    tooltip
        .classed("visible", false);

}