const width = 900;
const height = 650;

const svg = d3.select("#chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("cursor", "grab");

const tooltip = d3.select("#tooltip");

const graphGroup = svg.append("g")
    .attr("class", "graph-group");

const matrixContainer = d3.select("#matrix");

Promise.all([
    d3.csv(
        "../data/lab5_assignment_stations.csv",
        d => ({
            id: d.id,
            station_name: d.station_name,
            district: d.district,
            daily_passengers: +d.daily_passengers,
            station_type: d.station_type
        })
    ),
    d3.csv(
        "../data/lab5_assignment_routes.csv",
        d => ({
            source: d.source,
            target: d.target,
            travel_time_min: +d.travel_time_min,
            route_type: d.route_type
        })
    )
])
.then(([nodes, links]) => {
    console.log("Stations:", nodes);
    console.log("Routes:", links);

    const passengerScale = d3.scaleSqrt()
        .domain(d3.extent(nodes, d => d.daily_passengers))
        .range([6, 18]);

    const districtColor = d3.scaleOrdinal()
        .domain([
            "Central",
            "North",
            "South",
            "East",
            "West"
        ])
        .range(d3.schemeTableau10);

    const travelTimeScale = d3.scaleLinear()
        .domain(d3.extent(links, d => d.travel_time_min))
        .range([1.5, 6]);

    const routeColor = d3.scaleOrdinal()
        .domain([
            "Metro",
            "Express",
            "Shuttle"
        ])
        .range(d3.schemeSet2);

    const stationShape = {
        Terminal: d3.symbolCircle,
        Transfer: d3.symbolSquare,
        Local: d3.symbolDiamond
    };

    const graph = graphGroup.append("g")
        .attr("class", "network");

    const link = graph.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke", d => routeColor(d.route_type))
        .attr("stroke-opacity", 0.7)
        .attr("stroke-width", d =>
            travelTimeScale(d.travel_time_min)
        );

    const node = graph.append("g")
        .attr("class", "nodes")
        .selectAll("g")
        .data(nodes)
        .join("g")
        .attr("class", "node");

    node.append("path")
        .attr("d", d => {
            const radius = passengerScale(
                d.daily_passengers
            );
            return d3.symbol()
                .type(stationShape[d.station_type])
                .size(
                    Math.PI * radius * radius
                )();
        })
        .attr("fill", d =>
            districtColor(d.district)
        )
        .attr("stroke", "#333")
        .attr("stroke-width", 1);

    node.append("text")
        .attr("class", "node-label")
        .attr("x", 0)
        .attr(
            "y",
            d => passengerScale(
                d.daily_passengers
            ) + 14
        )
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .attr("fill", "#333")
        .text(d => d.station_name);

    const simulation = d3.forceSimulation(nodes)
        .force(
            "link",
            d3.forceLink(links)
                .id(d => d.id)
                .distance(100)
        )
        .force(
            "charge",
            d3.forceManyBody()
                .strength(-250)
        )
        .force(
            "center",
            d3.forceCenter(
                width / 2,
                height / 2
            )
        )
        .force(
            "collision",
            d3.forceCollide()
                .radius(
                    d =>
                        passengerScale(
                            d.daily_passengers
                        ) + 12
                )
        );

    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node
            .attr(
                "transform",
                d => `translate(${d.x},${d.y})`
            );
    });

    function connectedToNode(
        nodeData,
        linkData
    ) {
        return (
            linkData.source.id === nodeData.id ||
            linkData.target.id === nodeData.id
        );
    }

    node
        .on("mouseenter", function(event, d) {
            link
                .attr(
                    "stroke-opacity",
                    l =>
                        connectedToNode(d, l)
                            ? 0.95
                            : 0.08
                );

            node
                .attr(
                    "opacity",
                    n =>
                        n.id === d.id ||
                        links.some(
                            l =>
                                connectedToNode(d, l) &&
                                (
                                    l.source.id === n.id ||
                                    l.target.id === n.id
                                )
                        )
                            ? 1
                            : 0.2
                );

            d3.select(this)
                .raise();

            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>${d.station_name}</strong><br>
                    District: ${d.district}<br>
                    Station type: ${d.station_type}<br>
                    Daily passengers:
                    ${d.daily_passengers.toLocaleString()}
                `)
                .style(
                    "left",
                    `${event.pageX + 12}px`
                )
                .style(
                    "top",
                    `${event.pageY + 12}px`
                );
        })
        .on("mousemove", function(event) {
            tooltip
                .style(
                    "left",
                    `${event.pageX + 12}px`
                )
                .style(
                    "top",
                    `${event.pageY + 12}px`
                );
        })
        .on("mouseleave", function() {
            link
                .attr("stroke-opacity", 0.7);

            node
                .attr("opacity", 1);

            tooltip
                .style("opacity", 0);
        });

    link
        .on("mouseenter", function(event, d) {
            link
                .attr(
                    "stroke-opacity",
                    l =>
                        l === d
                            ? 1
                            : 0.12
                );

            node
                .attr(
                    "opacity",
                    n =>
                        n.id === d.source.id ||
                        n.id === d.target.id
                            ? 1
                            : 0.2
                );

            d3.select(this)
                .attr(
                    "stroke-width",
                    travelTimeScale(
                        d.travel_time_min
                    ) + 2
                );

            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>
                        ${d.source.station_name}
                        ↔
                        ${d.target.station_name}
                    </strong><br>
                    Route type: ${d.route_type}<br>
                    Travel time: ${d.travel_time_min} min
                `)
                .style(
                    "left",
                    `${event.pageX + 12}px`
                )
                .style(
                    "top",
                    `${event.pageY + 12}px`
                );
        })
        .on("mousemove", function(event) {
            tooltip
                .style(
                    "left",
                    `${event.pageX + 12}px`
                )
                .style(
                    "top",
                    `${event.pageY + 12}px`
                );
        })
        .on("mouseleave", function(event, d) {
            link
                .attr("stroke-opacity", 0.7);

            node
                .attr("opacity", 1);

            d3.select(this)
                .attr(
                    "stroke-width",
                    travelTimeScale(
                        d.travel_time_min
                    )
                );

            tooltip
                .style("opacity", 0);
        });

    node.call(
        d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended)
    );

    function dragstarted(event, d) {
        if (!event.active) {
            simulation
                .alphaTarget(0.3)
                .restart();
        }
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) {
            simulation.alphaTarget(0);
        }
        d.fx = null;
        d.fy = null;
    }

    const zoom = d3.zoom()
        .scaleExtent([0.7, 2.5])
        .on("start", () => {
            svg.style("cursor", "grabbing");
        })
        .on("zoom", event => {
            graphGroup.attr(
                "transform",
                event.transform
            );
        })
        .on("end", () => {
            svg.style("cursor", "grab");
        });

    svg.call(zoom);
    svg.on("dblclick.zoom", null);

    createMatrix(
        nodes,
        links,
        districtColor,
        routeColor
    );

    function createMatrix(
        nodes,
        links,
        districtColor,
        routeColor
    ) {
        const districtOrder = {
            Central: 0,
            North: 1,
            South: 2,
            East: 3,
            West: 4
        };

        const stationTypeOrder = {
            Terminal: 0,
            Transfer: 1,
            Local: 2
        };

        const orderedNodes = [...nodes].sort(
            (a, b) => {
                const districtDifference =
                    districtOrder[a.district] -
                    districtOrder[b.district];

                if (districtDifference !== 0) {
                    return districtDifference;
                }

                const typeDifference =
                    stationTypeOrder[a.station_type] -
                    stationTypeOrder[b.station_type];

                if (typeDifference !== 0) {
                    return typeDifference;
                }

                return d3.ascending(
                    a.id,
                    b.id
                );
            }
        );

        const matrixData = [];

        orderedNodes.forEach(rowNode => {
            orderedNodes.forEach(colNode => {
                const foundLink =
                    links.find(
                        l =>
                            (
                                l.source.id === rowNode.id &&
                                l.target.id === colNode.id
                            ) ||
                            (
                                l.source.id === colNode.id &&
                                l.target.id === rowNode.id
                            )
                    );

                matrixData.push({
                    row: rowNode.id,
                    col: colNode.id,
                    connected: !!foundLink,
                    travel_time_min:
                        foundLink
                            ? foundLink.travel_time_min
                            : null,
                    route_type:
                        foundLink
                            ? foundLink.route_type
                            : null
                });
            });
        });

        const matrixSize = 600;

        const margin = {
            top: 140,
            right: 40,
            bottom: 40,
            left: 110
        };

        const matrixSvg =
            matrixContainer
                .append("svg")
                .attr(
                    "width",
                    matrixSize +
                    margin.left +
                    margin.right
                )
                .attr(
                    "height",
                    matrixSize +
                    margin.top +
                    margin.bottom
                );

        const matrixGroup =
            matrixSvg
                .append("g")
                .attr(
                    "transform",
                    `translate(${margin.left},${margin.top})`
                );

        const matrixX =
            d3.scaleBand()
                .domain(
                    orderedNodes.map(
                        d => d.id
                    )
                )
                .range(
                    [0, matrixSize]
                )
                .padding(0.03);

        const matrixY =
            d3.scaleBand()
                .domain(
                    orderedNodes.map(
                        d => d.id
                    )
                )
                .range(
                    [0, matrixSize]
                )
                .padding(0.03);

        const opacityScale =
            d3.scaleLinear()
                .domain(
                    d3.extent(
                        links,
                        d =>
                            d.travel_time_min
                    )
                )
                .range([0.95, 0.35]);

        const cells =
            matrixGroup
                .append("g")
                .attr("class", "matrix-cells")
                .selectAll("rect")
                .data(matrixData)
                .join("rect")
                .attr(
                    "x",
                    d => matrixX(d.col)
                )
                .attr(
                    "y",
                    d => matrixY(d.row)
                )
                .attr(
                    "width",
                    matrixX.bandwidth()
                )
                .attr(
                    "height",
                    matrixY.bandwidth()
                )
                .attr(
                    "fill",
                    d =>
                        d.connected
                            ? routeColor(
                                d.route_type
                            )
                            : "#f3f3f3"
                )
                .attr(
                    "fill-opacity",
                    d =>
                        d.connected
                            ? opacityScale(
                                d.travel_time_min
                            )
                            : 1
                )
                .attr(
                    "stroke",
                    "#fff"
                )
                .attr(
                    "stroke-width",
                    0.5
                );

        cells
            .on("mouseenter", function(event, d) {
                cells
                    .attr(
                        "stroke",
                        "#fff"
                    );

                d3.select(this)
                    .attr(
                        "stroke",
                        "#333"
                    )
                    .attr(
                        "stroke-width",
                        1.5
                    );

                const rowNode =
                    orderedNodes.find(
                        n => n.id === d.row
                    );

                const colNode =
                    orderedNodes.find(
                        n => n.id === d.col
                    );

                if (d.connected) {
                    tooltip
                        .style(
                            "opacity",
                            1
                        )
                        .html(`
                            <strong>
                                ${rowNode.station_name}
                                ↔
                                ${colNode.station_name}
                            </strong><br>
                            Route type:
                            ${d.route_type}<br>
                            Travel time:
                            ${d.travel_time_min} min
                        `)
                        .style(
                            "left",
                            `${event.pageX + 12}px`
                        )
                        .style(
                            "top",
                            `${event.pageY + 12}px`
                        );
                } else {
                    tooltip
                        .style(
                            "opacity",
                            1
                        )
                        .html(`
                            <strong>
                                ${rowNode.station_name}
                                ↔
                                ${colNode.station_name}
                            </strong><br>
                            No direct connection
                        `)
                        .style(
                            "left",
                            `${event.pageX + 12}px`
                        )
                        .style(
                            "top",
                            `${event.pageY + 12}px`
                        );
                }
            })
            .on("mousemove", function(event) {
                tooltip
                    .style(
                        "left",
                        `${event.pageX + 12}px`
                    )
                    .style(
                        "top",
                        `${event.pageY + 12}px`
                    );
            })
            .on("mouseleave", function() {
                d3.select(this)
                    .attr(
                        "stroke",
                        "#fff"
                    )
                    .attr(
                        "stroke-width",
                        0.5
                    );

                tooltip
                    .style(
                        "opacity",
                        0
                    );
            });

        const xLabels =
            matrixGroup
                .append("g")
                .attr(
                    "class",
                    "matrix-x-labels"
                )
                .selectAll("text")
                .data(orderedNodes)
                .join("text")
                .attr(
                    "x",
                    d =>
                        matrixX(d.id) +
                        matrixX.bandwidth() / 2
                )
                .attr(
                    "y",
                    -8
                )
                .attr(
                    "text-anchor",
                    "start"
                )
                .attr(
                    "font-size",
                    "9px"
                )
                .attr(
                    "fill",
                    d =>
                        districtColor(
                            d.district
                        )
                )
                .attr(
                    "transform",
                    d =>
                        `rotate(-60, ${matrixX(d.id) + matrixX.bandwidth() / 2}, -8)`
                )
                .text(
                    d => d.station_name
                );

        matrixGroup
            .append("g")
            .attr(
                "class",
                "matrix-y-labels"
            )
            .selectAll("text")
            .data(orderedNodes)
            .join("text")
            .attr(
                "x",
                -8
            )
            .attr(
                "y",
                d =>
                    matrixY(d.id) +
                    matrixY.bandwidth() / 2
            )
            .attr(
                "text-anchor",
                "end"
            )
            .attr(
                "dominant-baseline",
                "middle"
            )
            .attr(
                "font-size",
                "9px"
            )
            .attr(
                "fill",
                d =>
                    districtColor(
                        d.district
                    )
            )
            .text(
                d => d.station_name
            );

        const districtBoundaries = [];

        let currentDistrict = null;

        orderedNodes.forEach((d, i) => {
            if (d.district !== currentDistrict) {
                districtBoundaries.push({
                    district: d.district,
                    index: i
                });

                currentDistrict =
                    d.district;
            }
        });

        districtBoundaries.forEach(
            boundary => {
                const y =
                    matrixY(
                        orderedNodes[
                            boundary.index
                        ].id
                    );

                matrixGroup
                    .append("line")
                    .attr(
                        "x1",
                        0
                    )
                    .attr(
                        "x2",
                        matrixSize
                    )
                    .attr(
                        "y1",
                        y
                    )
                    .attr(
                        "y2",
                        y
                    )
                    .attr(
                        "stroke",
                        "#555"
                    )
                    .attr(
                        "stroke-width",
                        1
                    )
                    .attr(
                        "stroke-opacity",
                        0.5
                    );

                const x =
                    matrixX(
                        orderedNodes[
                            boundary.index
                        ].id
                    );

                matrixGroup
                    .append("line")
                    .attr(
                        "x1",
                        x
                    )
                    .attr(
                        "x2",
                        x
                    )
                    .attr(
                        "y1",
                        0
                    )
                    .attr(
                        "y2",
                        matrixSize
                    )
                    .attr(
                        "stroke",
                        "#555"
                    )
                    .attr(
                        "stroke-width",
                        1
                    )
                    .attr(
                        "stroke-opacity",
                        0.5
                    );
            }
        );

        matrixSvg
            .append("text")
            .attr(
                "x",
                margin.left
            )
            .attr(
                "y",
                30
            )
            .attr(
                "font-size",
                "16px"
            )
            .attr(
                "font-weight",
                "600"
            )
            .text(
                "Adjacency Matrix"
            );

        matrixSvg
            .append("text")
            .attr("x", margin.left)
            .attr("y", 52)
            .attr("font-size", "12px")
            .attr("fill", "#555")
            .append("tspan")
            .attr("x", margin.left)
            .attr("dy", 0)
            .text("Matrix encoding: light gray = no direct connection;")
            .append("tspan")
            .attr("x", margin.left)
            .attr("dy", 16)
            .text("green = Metro, orange = Express, blue = Shuttle;")
            .append("tspan")
            .attr("x", margin.left)
            .attr("dy", 16)
            .text("higher opacity = shorter travel time, lower opacity = longer travel time.");
    }
});