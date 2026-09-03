// ============================================================
// STATS 401 Lab 3
// Financial News & Market Sentiment
// ============================================================


d3.csv("../data/lab3_news_sentiment.csv")
    .then(data => {

        data.forEach(d => {
            d.sentiment_score = +d.sentiment_score;
            d.relevance_score = +d.relevance_score;
        });

        d3.select("#loading")
            .style("display", "none");


        const columns = [
            "ticker",
            "time_published",
            "title",
            "source",
            "topic",
            "sentiment_label",
            "sentiment_score",
            "relevance_score"
        ];

        const displayNames = {
            ticker: "Ticker",
            time_published: "Published",
            title: "Title",
            source: "Source",
            topic: "Topic",
            sentiment_label: "Sentiment",
            sentiment_score: "Sentiment Score",
            relevance_score: "Relevance Score"
        };


        const header = d3.select("#data-table thead")
            .append("tr");


        header.selectAll("th")
            .data(columns)
            .join("th")
            .text(column => displayNames[column])
            .append("span")
            .attr("class", "sort-indicator");


        let currentColumn = null;
        let ascending = true;


        function updateTable() {

            const rows = d3.select("#data-table tbody")
                .selectAll("tr")
                .data(data, d => d.url + d.ticker)
                .join("tr");


            rows.selectAll("td")
                .data(row => columns.map(column => ({
                    column: column,
                    value: row[column],
                    row: row
                })))
                .join("td")
                .html(d => {

                    if (d.column === "title") {

                        return `
                            <a href="${d.row.url}"
                               target="_blank"
                               rel="noopener noreferrer">
                                ${d.value}
                            </a>
                        `;
                    }

           
                    if (d.column === "sentiment_score" ||
                        d.column === "relevance_score") {

                        return d.value.toFixed(3);
                    }

                    return d.value;
                });
        }


        updateTable();
        header.selectAll("th")
            .on("click", function(event, column) {
                if (currentColumn === column) {
                    ascending = !ascending;
                } else {
                    currentColumn = column;
                    ascending = true;
                }


              
                data.sort((a, b) => {

                    let valueA = a[column];
                    let valueB = b[column];


                    if (column === "sentiment_score" ||
                        column === "relevance_score") {

                        return ascending
                            ? d3.ascending(valueA, valueB)
                            : d3.descending(valueA, valueB);
                    }


                    
                    return ascending
                        ? d3.ascending(
                            String(valueA).toLowerCase(),
                            String(valueB).toLowerCase()
                        )
                        : d3.descending(
                            String(valueA).toLowerCase(),
                            String(valueB).toLowerCase()
                        );
                });


                
                updateTable();


                
                header.selectAll(".sort-indicator")
                    .text("");


                d3.select(this)
                    .select(".sort-indicator")
                    .text(ascending ? " ▲" : " ▼");

            });

    })

    .catch(error => {

        console.error("Error loading dataset:", error);

        d3.select("#loading")
            .text(
                "Error loading dataset. Please check the CSV file path."
            );

    });