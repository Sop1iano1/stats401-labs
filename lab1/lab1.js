const width = 900;
const height = 520;
const margin = { top: 50, right: 30, bottom: 120, left: 30 };

async function drawChart() {
    const data = await d3.csv("../data/students.csv", d => ({
        name: d.name,
        score: +d.score
    }));

    const svg = d3.select("#chart")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("role", "img")
        .attr("aria-label", "Bar chart of student scores");

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const chart = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
        .domain(data.map(d => d.name))
        .range([0, innerWidth])
        .padding(0.2);

    const y = d3.scaleLinear()
        .domain([0, 100])
        .range([innerHeight, 0]);

    chart.selectAll("rect")
        .data(data)
        .join("rect")
        .attr("class", "bar")
        .attr("x", d => x(d.name))
        .attr("y", d => y(d.score))
        .attr("width", x.bandwidth())
        .attr("height", d => innerHeight - y(d.score))
        .append("title")
        .text(d => `${d.name}: ${d.score}`);

    chart.selectAll(".score-label")
        .data(data)
        .join("text")
        .attr("class", "score-label")
        .attr("x", d => x(d.name) + x.bandwidth() / 2)
        .attr("y", d => y(d.score) - 8)
        .text(d => d.score);

    chart.selectAll(".name-label")
        .data(data)
        .join("text")
        .attr("class", "name-label")
        .attr("x", d => x(d.name) + x.bandwidth() / 2)
        .attr("y", innerHeight + 28)
        .text(d => d.name);
}

drawChart().catch(error => {
    console.error("Could not load the student data:", error);
    d3.select("#chart")
        .append("p")
        .text("Unable to load the CSV. Please run the project using a local web server.");
});
