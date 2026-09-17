import csv
import json

input_file = "/Users/rang_yu/Downloads/stats401-labs/data/lab6_assignment_gdp.csv"
output_file = "/Users/rang_yu/Downloads/stats401-labs/data/lab6_assignment_gdp.json"

root = {
    "name": "World",
    "children": []
}

continent_map = {}

with open(input_file, "r", encoding="utf-8-sig", newline="") as f:
    reader = csv.DictReader(f)

    for row in reader:
        continent = row["continent"].strip()
        area = row["area"].strip()
        country = row["country"].strip()
        gdp = float(row["gdp_billion_usd"])
        status = row["gdp_status"].strip()

        if continent not in continent_map:
            continent_node = {
                "name": continent,
                "children": []
            }

            continent_map[continent] = continent_node
            root["children"].append(continent_node)

        continent_node = continent_map[continent]

        area_node = next(
            (child for child in continent_node["children"]
             if child["name"] == area),
            None
        )

        if area_node is None:
            area_node = {
                "name": area,
                "children": []
            }

            continent_node["children"].append(area_node)

        area_node["children"].append({
            "name": country,
            "gdp": gdp,
            "status": status
        })

with open(output_file, "w", encoding="utf-8") as f:
    json.dump(root, f, indent=2, ensure_ascii=False)

print(f"Created: {output_file}")