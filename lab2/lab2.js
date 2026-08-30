const width = 900;
const height = 650;

const margin = {
    top: 50,
    right: 180,
    bottom: 80,
    left: 120
};

const tooltip = d3.select("#tooltip");

d3.csv("../data/cities_multivariate.csv", d => ({
    city: d.city,
    population: +d.population,
    temp_c: +d.temp_c,
    development_level: d.development_level,
    region: d.region
}))
.then(data => {

    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    // --------------------------------------------------
    // Scales
    // --------------------------------------------------

    // Population → bar length
    const xPopulation = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.population)])
        .nice()
        .range([
            margin.left,
            width - margin.right
        ]);

    // Temperature → circle position
    const xTemperature = d3.scaleLinear()
        .domain(d3.extent(data, d => d.temp_c))
        .nice()
        .range([
            margin.left,
            width - margin.right
        ]);

    // One row for each city
    const yScale = d3.scaleBand()
        .domain(data.map(d => d.city))
        .range([
            margin.top,
            height - margin.bottom
        ])
        .padding(0.25);

    // Development level → circle size
    // The differences are intentionally more pronounced
    // so that the ordinal levels are easier to distinguish.
    const sizeScale = d3.scaleOrdinal()
        .domain([
            "Low",
            "Medium",
            "High"
        ])
        .range([
            5,
            11,
            19
        ]);

    // Region → color
    const regions = Array.from(
        new Set(data.map(d => d.region))
    );

    const colorScale = d3.scaleOrdinal()
        .domain(regions)
        .range(d3.schemeTableau10);

    // --------------------------------------------------
    // Axes
    // --------------------------------------------------

    // Population axis
    svg.append("g")
        .attr(
            "transform",
            `translate(0, ${height - margin.bottom})`
        )
        .call(
            d3.axisBottom(xPopulation)
        );

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height - 25)
        .attr("text-anchor", "middle")
        .text("Population (millions)");

    // Temperature axis
    svg.append("g")
        .attr(
            "transform",
            `translate(0, ${margin.top - 15})`
        )
        .call(
            d3.axisTop(xTemperature)
        );

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", margin.top - 35)
        .attr("text-anchor", "middle")
        .text("Temperature (°C)");

    // --------------------------------------------------
    // Subtle row guide lines
    // --------------------------------------------------

    svg.selectAll(".row-guide")
        .data(data)
        .join("line")
        .attr("class", "row-guide")
        .attr("x1", margin.left)
        .attr("x2", width - margin.right)
        .attr(
            "y1",
            d => yScale(d.city) + yScale.bandwidth() / 2
        )
        .attr(
            "y2",
            d => yScale(d.city) + yScale.bandwidth() / 2
        )
        .attr("stroke", "#ddd")
        .attr("stroke-width", 1)
        .attr("opacity", 0.5);

    // --------------------------------------------------
    // City labels
    // --------------------------------------------------

    svg.append("g")
        .selectAll("text")
        .data(data)
        .join("text")
        .attr("x", margin.left - 15)
        .attr(
            "y",
            d => yScale(d.city) + yScale.bandwidth() / 2
        )
        .attr("text-anchor", "end")
        .attr("dominant-baseline", "middle")
        .text(d => d.city);

    // --------------------------------------------------
    // Population bars
    // --------------------------------------------------

    svg.selectAll(".population-bar")
        .data(data)
        .join("rect")
        .attr("class", "population-bar")
        .attr("x", xPopulation(0))
        .attr(
            "y",
            d => yScale(d.city)
                + yScale.bandwidth() * 0.25
        )
        .attr(
            "width",
            d => xPopulation(d.population)
                - xPopulation(0)
        )
        .attr(
            "height",
            yScale.bandwidth() * 0.5
        )
        .attr("opacity", 0.25);

    // --------------------------------------------------
    // Temperature markers
    // --------------------------------------------------

    svg.selectAll(".temperature-point")
        .data(data)
        .join("circle")
        .attr("class", "temperature-point")
        .attr(
            "cx",
            d => xTemperature(d.temp_c)
        )
        .attr(
            "cy",
            d => yScale(d.city)
                + yScale.bandwidth() / 2
        )
        .attr(
            "r",
            d => sizeScale(d.development_level)
        )
        .attr(
            "fill",
            d => colorScale(d.region)
        )
        .attr("stroke", "black")
        .attr("stroke-width", 1)
        .attr("opacity", 0.9)

        // Highlight the point when hovered
        .on("mouseover", function(event, d) {

            d3.select(this)
                .attr("stroke-width", 2.5)
                .attr("opacity", 1);

            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>${d.city}</strong><br>
                    Population: ${d.population} million<br>
                    Temperature: ${d.temp_c} °C<br>
                    Development: ${d.development_level}<br>
                    Region: ${d.region}
                `);
        })

        .on("mousemove", function(event) {

            tooltip
                .style(
                    "left",
                    `${event.pageX + 10}px`
                )
                .style(
                    "top",
                    `${event.pageY + 10}px`
                );
        })

        .on("mouseout", function() {

            d3.select(this)
                .attr("stroke-width", 1)
                .attr("opacity", 0.9);

            tooltip
                .style("opacity", 0);
        });

    // --------------------------------------------------
    // Region legend
    // --------------------------------------------------

    const regionLegend = svg.append("g")
        .attr(
            "transform",
            `translate(${width - margin.right + 25}, 120)`
        );

    regionLegend.append("text")
        .attr("y", -15)
        .attr("font-weight", "bold")
        .text("Region");

    const regionItems = regionLegend
        .selectAll(".region-item")
        .data(regions)
        .join("g")
        .attr("class", "region-item")
        .attr(
            "transform",
            (d, i) => `translate(0, ${i * 28})`
        );

    regionItems.append("circle")
        .attr("r", 7)
        .attr(
            "fill",
            d => colorScale(d)
        );

    regionItems.append("text")
        .attr("x", 15)
        .attr("y", 4)
        .text(d => d);

    // --------------------------------------------------
    // Development level legend
    // --------------------------------------------------

    const developmentLegend = svg.append("g")
        .attr(
            "transform",
            `translate(${width - margin.right + 25}, 270)`
        );

    developmentLegend.append("text")
        .attr("y", -20)
        .attr("font-weight", "bold")
        .text("Development Level");

    const levels = [
        "Low",
        "Medium",
        "High"
    ];

    const developmentItems = developmentLegend
        .selectAll(".development-item")
        .data(levels)
        .join("g")
        .attr("class", "development-item")
        .attr(
            "transform",
            (d, i) => `translate(0, ${i * 50})`
        );

    developmentItems.append("circle")
        .attr(
            "r",
            d => sizeScale(d)
        )
        .attr("fill", "none")
        .attr("stroke", "black");

    developmentItems.append("text")
        .attr("x", 30)
        .attr("y", 4)
        .text(d => d);

})
.catch(error => {

    console.error("Unable to load the CSV:", error);

    d3.select("#chart")
        .append("p")
        .text(
            "Unable to load the CSV. Please run the project using a local web server."
        );
});