// ============================================================
// Lab 4
// Cleaning Web Data for Visualization
// Tweet Sentiment by Market Regime
// ============================================================


// ------------------------------------------------------------
// Data path
// ------------------------------------------------------------

const DATA_PATH =
    "../data/lab4_clean_tweets_sentiment.csv";


// ------------------------------------------------------------
// Chart settings
// ------------------------------------------------------------

const margin = {
    top: 50,
    right: 40,
    bottom: 90,
    left: 80
};

const width = 900;

const height = 520;

const innerWidth =
    width - margin.left - margin.right;

const innerHeight =
    height - margin.top - margin.bottom;


// ------------------------------------------------------------
// Market regime categories
// ------------------------------------------------------------

const regimes = [
    "calm",
    "trending_down",
    "trending_up",
    "volatile"
];


// ------------------------------------------------------------
// Sentiment categories
// ------------------------------------------------------------

const sentiments = [
    "Negative",
    "Neutral",
    "Positive"
];


// ------------------------------------------------------------
// Display labels
// ------------------------------------------------------------

const regimeLabels = {

    calm: "Calm",

    trending_down: "Trending Down",

    trending_up: "Trending Up",

    volatile: "Volatile"

};


// ------------------------------------------------------------
// Sentiment colors
// ------------------------------------------------------------

const sentimentColors = {

    Negative: "#D96C75",
    Neutral: "#6C8EBF",
    Positive: "#78A878"


};


// ============================================================
// Load CSV
// ============================================================

d3.csv(DATA_PATH)

    .then(function(data) {


        // ----------------------------------------------------
        // Check data
        // ----------------------------------------------------

        console.log(
            "Loaded Lab 4 data:",
            data
        );

        console.log(
            "Number of records:",
            data.length
        );


        // ----------------------------------------------------
        // Convert numeric fields
        // ----------------------------------------------------

        data.forEach(function(d) {

            d.sentiment_score =
                +d.sentiment_score;

            d.volatility_7d =
                +d.volatility_7d;

            d.relative_volume =
                +d.relative_volume;

            d.rsi_14 =
                +d.rsi_14;

            d.return_5d =
                +d.return_5d;

            d.return_20d =
                +d.return_20d;

            d.distance_from_ma_20 =
                +d.distance_from_ma_20;

            d.slope_ma_20 =
                +d.slope_ma_20;

            d.gap_open =
                +d.gap_open;

            d.intraday_range =
                +d.intraday_range;

        });


        // ====================================================
        // Dataset summary
        // ====================================================

        const totalRecords =
            data.length;


        const sentimentCounts =
            d3.rollup(

                data,

                function(records) {
                    return records.length;
                },

                function(d) {
                    return d.sentiment;
                }

            );


        d3.select("#total-records")
            .text(
                totalRecords.toLocaleString()
            );


        d3.select("#positive-count")
            .text(
                (
                    sentimentCounts.get("Positive")
                    || 0
                ).toLocaleString()
            );


        d3.select("#neutral-count")
            .text(
                (
                    sentimentCounts.get("Neutral")
                    || 0
                ).toLocaleString()
            );


        d3.select("#negative-count")
            .text(
                (
                    sentimentCounts.get("Negative")
                    || 0
                ).toLocaleString()
            );


        // ====================================================
        // Aggregate by market regime and sentiment
        // ====================================================

        const grouped =
            d3.rollup(

                data,

                function(records) {

                    return {

                        count:
                            records.length,

                        avgScore:
                            d3.mean(
                                records,
                                function(d) {
                                    return d.sentiment_score;
                                }
                            )

                    };

                },

                function(d) {
                    return d.market_regime;
                },

                function(d) {
                    return d.sentiment;
                }

            );


        // ====================================================
        // Build normalized chart data
        // ====================================================

        const chartData =
            regimes.map(function(regime) {


                const regimeGroup =
                    grouped.get(regime);


                const counts = {};


                let total = 0;


                sentiments.forEach(
                    function(sentiment) {


                        const result =
                            regimeGroup
                                ? regimeGroup.get(sentiment)
                                : null;


                        counts[sentiment] =
                            result
                                ? result.count
                                : 0;


                        total +=
                            counts[sentiment];

                    }
                );


                const row = {

                    market_regime:
                        regime,

                    total:
                        total

                };


                sentiments.forEach(
                    function(sentiment) {

                        row[sentiment] =
                            total > 0

                                ? counts[sentiment]
                                  / total

                                : 0;

                    }
                );


                return row;

            });


        console.log(
            "Aggregated chart data:",
            chartData
        );


        // ====================================================
        // Create SVG
        // ====================================================

        const svg =
            d3.select("#chart")

                .append("svg")

                .attr(
                    "viewBox",
                    `0 0 ${width} ${height}`
                )

                .attr(
                    "width",
                    "100%"
                )

                .attr(
                    "height",
                    height
                );


        const chartGroup =
            svg.append("g")

                .attr(
                    "transform",
                    `translate(
                        ${margin.left},
                        ${margin.top}
                    )`
                );


        // ====================================================
        // X scale
        // ====================================================

        const x =
            d3.scaleBand()

                .domain(regimes)

                .range([
                    0,
                    innerWidth
                ])

                .padding(0.30);


        // ====================================================
        // Y scale
        // ====================================================

        const y =
            d3.scaleLinear()

                .domain([
                    0,
                    1
                ])

                .range([
                    innerHeight,
                    0
                ]);


        // ====================================================
        // X axis
        // ====================================================

        const xAxis =
            d3.axisBottom(x)

                .tickFormat(
                    function(d) {
                        return regimeLabels[d];
                    }
                );


        chartGroup.append("g")

            .attr(
                "transform",
                `translate(
                    0,
                    ${innerHeight}
                )`
            )

            .call(xAxis);


        // ====================================================
        // Y axis
        // ====================================================

        const yAxis =
            d3.axisLeft(y)

                .ticks(5)

                .tickFormat(
                    function(d) {
                        return `${d * 100}%`;
                    }
                );


        chartGroup.append("g")

            .call(yAxis);


        // ====================================================
        // Y axis label
        // ====================================================

        chartGroup.append("text")

            .attr(
                "transform",
                "rotate(-90)"
            )

            .attr(
                "x",
                -innerHeight / 2
            )

            .attr(
                "y",
                -55
            )

            .attr(
                "text-anchor",
                "middle"
            )

            .style(
                "font-size",
                "14px"
            )

            .text(
                "Percentage of Records"
            );


        // ====================================================
        // X axis label
        // ====================================================

        chartGroup.append("text")

            .attr(
                "x",
                innerWidth / 2
            )

            .attr(
                "y",
                innerHeight + 65
            )

            .attr(
                "text-anchor",
                "middle"
            )

            .style(
                "font-size",
                "14px"
            )

            .text(
                "Market Regime"
            );


        // ====================================================
        // Gridlines
        // ====================================================

        chartGroup.append("g")

            .attr(
                "class",
                "grid"
            )

            .call(

                d3.axisLeft(y)

                    .ticks(5)

                    .tickSize(
                        -innerWidth
                    )

                    .tickFormat("")

            );


        // ====================================================
        // Stack data
        // ====================================================

        const stack =
            d3.stack()

                .keys(sentiments);


        const stackedData =
            stack(chartData);


        // ====================================================
        // Tooltip
        // ====================================================

        const tooltip =
            d3.select("#tooltip");


        // ====================================================
        // Draw stacked bars
        // ====================================================

        chartGroup.selectAll(
            ".sentiment-layer"
        )

            .data(stackedData)

            .join("g")

            .attr(
                "class",
                "sentiment-layer"
            )

            .attr(
                "fill",
                function(d) {

                    return sentimentColors[d.key];

                }
            )

            .selectAll("rect")

            .data(
                function(d) {
                    return d;
                }
            )

            .join("rect")

            .attr(
                "x",
                function(d) {

                    return x(
                        d.data.market_regime
                    );

                }
            )

            .attr(
                "y",
                function(d) {

                    return y(d[1]);

                }
            )

            .attr(
                "height",
                function(d) {

                    return y(d[0])
                        - y(d[1]);

                }
            )

            .attr(
                "width",
                x.bandwidth()
            )

            .style(
                "cursor",
                "pointer"
            )


            // ------------------------------------------------
            // Mouse over
            // ------------------------------------------------

            .on(
                "mouseover",
                function(event, d) {


                    const regime =
                        d.data.market_regime;


                    const sentiment =
                        this.parentNode
                            .__data__
                            .key;


                    const regimeGroup =
                        grouped.get(regime);


                    const result =
                        regimeGroup
                            ? regimeGroup.get(sentiment)
                            : null;


                    const count =
                        result
                            ? result.count
                            : 0;


                    const avgScore =
                        result
                            ? result.avgScore
                            : 0;


                    const percentage =
                        d.data[sentiment]
                        * 100;


                    tooltip

                        .style(
                            "opacity",
                            1
                        )

                        .html(`

                            <strong>
                                ${regimeLabels[regime]}
                            </strong>

                            <br>

                            Sentiment:
                            <strong>
                                ${sentiment}
                            </strong>

                            <br>

                            Records:
                            ${count.toLocaleString()}

                            <br>

                            Share:
                            ${percentage.toFixed(1)}%

                            <br>

                            Avg. sentiment score:
                            ${avgScore.toFixed(3)}

                        `);

                }
            )


            // ------------------------------------------------
            // Mouse move
            // ------------------------------------------------

            .on(
                "mousemove",
                function(event) {

                    tooltip

                        .style(
                            "left",
                            `${event.pageX + 12}px`
                        )

                        .style(
                            "top",
                            `${event.pageY - 28}px`
                        );

                }
            )


            // ------------------------------------------------
            // Mouse out
            // ------------------------------------------------

            .on(
                "mouseout",
                function() {

                    tooltip

                        .style(
                            "opacity",
                            0
                        );

                }
            );


        // ====================================================
        // Percentage labels
        // ====================================================

        stackedData.forEach(
            function(layer) {


                chartGroup.selectAll(
                    `.label-${layer.key}`
                )

                    .data(layer)

                    .join("text")

                    .attr(
                        "class",
                        `label-${layer.key}`
                    )

                    .attr(
                        "x",
                        function(d) {

                            return x(
                                d.data.market_regime
                            )
                            + x.bandwidth() / 2;

                        }
                    )

                    .attr(
                        "y",
                        function(d) {

                            return y(
                                (d[0] + d[1]) / 2
                            );

                        }
                    )

                    .attr(
                        "text-anchor",
                        "middle"
                    )

                    .attr(
                        "fill",
                        "white"
                    )

                    .style(
                        "font-size",
                        "12px"
                    )

                    .style(
                        "font-weight",
                        "600"
                    )

                    .style(
                        "display",
                        function(d) {


                            const percentage =
                                (d[1] - d[0])
                                * 100;


                            return percentage >= 7
                                ? "block"
                                : "none";

                        }
                    )

                    .text(
                        function(d) {


                            const percentage =
                                (d[1] - d[0])
                                * 100;


                            return `${percentage.toFixed(0)}%`;

                        }
                    );

            }
        );


        // ====================================================
        // Legend
        // ====================================================

        const legend =
            svg.append("g")

                .attr(
                    "transform",
                    `translate(
                        ${margin.left},
                        ${height - 20}
                    )`
                );


        sentiments.forEach(
            function(sentiment, i) {


                const legendItem =
                    legend.append("g")

                        .attr(
                            "transform",
                            `translate(
                                ${i * 120},
                                0
                            )`
                        );


                legendItem.append("rect")

                    .attr(
                        "width",
                        14
                    )

                    .attr(
                        "height",
                        14
                    )

                    .attr(
                        "fill",
                        sentimentColors[sentiment]
                    );


                legendItem.append("text")

                    .attr(
                        "x",
                        20
                    )

                    .attr(
                        "y",
                        12
                    )

                    .style(
                        "font-size",
                        "13px"
                    )

                    .text(
                        sentiment
                    );

            }
        );


        // ====================================================
        // Chart title
        // ====================================================

        svg.append("text")

            .attr(
                "x",
                width / 2
            )

            .attr(
                "y",
                25
            )

            .attr(
                "text-anchor",
                "middle"
            )

            .style(
                "font-size",
                "17px"
            )

            .style(
                "font-weight",
                "600"
            )

            .text(
                "How Sentiment Composition Varies by Market Regime"
            );

    })


    // ========================================================
    // Error handling
    // ========================================================

    .catch(function(error) {

        console.error(
            "Error loading Lab 4 data:",
            error
        );

        d3.select("#chart")
            .html(`
                <p>
                    Unable to load the dataset.
                    Please check the CSV file path and
                    run the project through a local web server.
                </p>
            `);

    });