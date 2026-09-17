const DATA_PATH = "../data/lab6_assignment_gdp.json";

const WIDTH = 1000;
const HEIGHT = 620;

const colors = {
    Increase: "#4caf50",
    Unchanged: "#9e9e9e",
    Decrease: "#e53935"
};

const tooltip = d3.select("#tooltip");

function showTooltip(event, d) {
    if (!d.data.gdp) {
        tooltip.style("opacity", 0);
        return;
    }

    tooltip
        .style("opacity", 1)
        .html(`
            <strong>${d.data.name}</strong><br>
            GDP: $${d.data.gdp.toLocaleString()} billion<br>
            Status: ${d.data.status}
        `)
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY - 28}px`);
}

function moveTooltip(event) {
    tooltip
        .style("left", `${event.pageX + 12}px`)
        .style("top", `${event.pageY - 28}px`);
}

function hideTooltip() {
    tooltip.style("opacity", 0);
}

function drawTreemap(containerId, data, tileMethod, enableZoom = false) {

    const container = d3.select(`#${containerId}`);

    container.selectAll("*").remove();

    const svg = container
        .append("svg")
        .attr("width", WIDTH)
        .attr("height", HEIGHT)
        .attr("viewBox", `0 0 ${WIDTH} ${HEIGHT}`)
        .attr("role", "img");

    const zoomLayer = svg.append("g");

    const root = d3.hierarchy(data)
        .sum(d => d.gdp || 0)
        .sort((a, b) => b.value - a.value);

    const treemap = d3.treemap()
        .size([WIDTH, HEIGHT])
        .paddingOuter(5)
        .paddingInner(2)
        .round(true)
        .tile(tileMethod);

    treemap(root);

    const countries = root.leaves();
    const parentNodes = root.descendants().filter(d => d.children);

    // Parent hierarchy borders
    zoomLayer
        .append("g")
        .attr("class", "hierarchy-borders")
        .attr("pointer-events", "none")
        .selectAll("rect")
        .data(parentNodes)
        .join("rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("width", d => d.x1 - d.x0)
        .attr("height", d => d.y1 - d.y0)
        .attr("fill", "none")
        .attr("stroke", "#777")
        .attr("stroke-width", 1);

    // Country rectangles
    const countryRects = zoomLayer
        .append("g")
        .attr("class", "country-rectangles")
        .selectAll("rect")
        .data(countries)
        .join("rect")
        .attr("x", d => d.x0)
        .attr("y", d => d.y0)
        .attr("width", d => Math.max(0, d.x1 - d.x0))
        .attr("height", d => Math.max(0, d.y1 - d.y0))
        .attr("fill", d => colors[d.data.status] || "#ccc")
        .attr("stroke", d => {
            const width = d.x1 - d.x0;
            const height = d.y1 - d.y0;

            return width < 8 || height < 8
                ? "none"
                : "#fff";
        })
        .attr("stroke-width", 1)
        .style("cursor", "pointer")
        .on("mouseenter", showTooltip)
        .on("mousemove", moveTooltip)
        .on("mouseleave", hideTooltip);

    // Country labels
    const countryLabels = zoomLayer
        .append("g")
        .attr("class", "country-labels")
        .attr("pointer-events", "none")
        .selectAll("text")
        .data(countries)
        .join("text")
        .attr("class", "name-label")
        .attr("x", d => (d.x0 + d.x1) / 2)
        .attr("y", d => (d.y0 + d.y1) / 2)
        .attr("dy", "0.35em")
        .text(d => d.data.name)
        .style("display", d => {

            const width = d.x1 - d.x0;
            const height = d.y1 - d.y0;

            return width > 55 && height > 22
                ? null
                : "none";
        });

    // Zoom and pan for Slice & Dice
    if (enableZoom) {

        const zoomBehavior = d3.zoom()
            .scaleExtent([1, 8])
            .translateExtent([
                [-WIDTH * 7, -HEIGHT * 7],
                [WIDTH * 7, HEIGHT * 7]
            ])
            .on("zoom", event => {

                zoomLayer.attr("transform", event.transform);

                const scale = event.transform.k;

                countryLabels
                    .style("display", d => {

                        const width = (d.x1 - d.x0) * scale;
                        const height = (d.y1 - d.y0) * scale;

                        return width > 55 && height > 22
                            ? null
                            : "none";
                    });

                countryRects
                    .attr("stroke", d => {

                        const width = (d.x1 - d.x0) * scale;
                        const height = (d.y1 - d.y0) * scale;

                        return width < 8 || height < 8
                            ? "none"
                            : "#fff";
                    });
            });

        svg.call(zoomBehavior);

        const controls = container
            .append("div")
            .attr("class", "treemap-controls");

        controls
            .append("button")
            .attr("type", "button")
            .attr("class", "treemap-reset")
            .text("Reset Zoom")
            .on("click", function () {

                svg
                    .transition()
                    .duration(350)
                    .call(
                        zoomBehavior.transform,
                        d3.zoomIdentity
                    );
            });
    }
}

d3.json(DATA_PATH)
    .then(data => {

        drawTreemap(
            "treemap-squarify",
            data,
            d3.treemapSquarify,
            false
        );

        drawTreemap(
            "treemap-slicedice",
            data,
            d3.treemapSliceDice,
            true
        );

    })
    .catch(error => {

        console.error(
            "Failed to load Lab 6 JSON data:",
            error
        );

        d3.select("#treemap-squarify")
            .append("p")
            .text("Unable to load the GDP data.");

        d3.select("#treemap-slicedice")
            .append("p")
            .text("Unable to load the GDP data.");
    });