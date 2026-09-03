import os
import csv
import json
import time
import requests
from datetime import datetime


API_URL = "https://www.alphavantage.co/query"

API_KEY = os.getenv("ALPHAVANTAGE_API_KEY")

if not API_KEY:
    raise RuntimeError(
        "ALPHAVANTAGE_API_KEY is not set. "
        "Please set your API key as an environment variable."
    )


LIMIT = 1000


TICKER = "AAPL"

HEADERS = {
    "User-Agent": "STATS401-Lab3-StudentProject/1.0"
}


CSV_FILE = "../data/lab3_news_sentiment.csv"
JSON_FILE = "../data/lab3_news_sentiment.json"


# ============================================================
# Helper functions
# ============================================================

def parse_timestamp(timestamp):
    """
    Convert Alpha Vantage timestamp such as
    20260903T081341 into a more readable format.
    """
    try:
        dt = datetime.strptime(timestamp, "%Y%m%dT%H%M%S")
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except (TypeError, ValueError):
        return timestamp


def get_main_topic(topics):
    """
    Extract the most relevant topic from the topics list.
    Alpha Vantage returns topics as a list of dictionaries.
    """
    if not topics:
        return ""

    
    best_topic = max(
        topics,
        key=lambda x: float(x.get("relevance_score", 0))
    )

    return best_topic.get("topic", "")


def request_news():
    """
    Send one request to the Alpha Vantage NEWS_SENTIMENT API
    and return the JSON response.
    """

    params = {
        "function": "NEWS_SENTIMENT",
        "tickers": TICKER,
        "limit": LIMIT,
        "apikey": API_KEY
    }

    print("Requesting data from Alpha Vantage...")

    try:
        response = requests.get(
            API_URL,
            params=params,
            headers=HEADERS,
            timeout=15
        )

        print("HTTP status code:", response.status_code)

       
        response.raise_for_status()

    except requests.RequestException as error:
        print("Request failed:")
        print(error)
        raise

    try:
        data = response.json()
    except ValueError:
        raise RuntimeError("The API response is not valid JSON.")

    
    if "Error Message" in data:
        raise RuntimeError(
            "Alpha Vantage API error: "
            + str(data["Error Message"])
        )

    if "Note" in data:
        raise RuntimeError(
            "Alpha Vantage API notice: "
            + str(data["Note"])
        )

    if "Information" in data:
        raise RuntimeError(
            "Alpha Vantage API information: "
            + str(data["Information"])
        )

    return data


def parse_articles(feed):
    """
    Convert the nested Alpha Vantage JSON structure into
    flat article-ticker observations.

    One record = one article + one ticker sentiment observation.
    """

    records = []

    for article in feed:

        title = article.get("title", "").strip()
        url = article.get("url", "").strip()
        timestamp = parse_timestamp(
            article.get("time_published")
        )
        source = article.get("source", "").strip()

        topics = article.get("topics", [])
        topic = get_main_topic(topics)

        ticker_sentiments = article.get(
            "ticker_sentiment",
            []
        )


        for ticker_data in ticker_sentiments:

            ticker = ticker_data.get(
                "ticker", ""
            ).strip()

            relevance = ticker_data.get(
                "relevance_score", ""
            )

            sentiment_score = ticker_data.get(
                "ticker_sentiment_score", ""
            )

            sentiment_label = ticker_data.get(
                "ticker_sentiment_label", ""
            )

            
            if not ticker:
                continue

            record = {
                "ticker": ticker,
                "time_published": timestamp,
                "title": title,
                "source": source,
                "topic": topic,
                "sentiment_label": sentiment_label,
                "sentiment_score": sentiment_score,
                "relevance_score": relevance,
                "url": url
            }

            records.append(record)

    return records


def clean_records(records):
    """
    Basic data cleaning and deduplication.
    """

    cleaned = []

    seen = set()

    for record in records:

        
        if not record["ticker"]:
            continue

        if not record["title"]:
            continue

        if not record["url"]:
            continue

        try:
            record["sentiment_score"] = float(
                record["sentiment_score"]
            )
        except (TypeError, ValueError):
            record["sentiment_score"] = None

        try:
            record["relevance_score"] = float(
                record["relevance_score"]
            )
        except (TypeError, ValueError):
            record["relevance_score"] = None

        unique_key = (
            record["url"],
            record["ticker"]
        )

        if unique_key in seen:
            continue

        seen.add(unique_key)
        cleaned.append(record)

    return cleaned


def save_csv(records, filename):
    """
    Save records as CSV.
    """

    if not records:
        raise RuntimeError(
            "No records available for CSV output."
        )

    fieldnames = [
        "ticker",
        "time_published",
        "title",
        "source",
        "topic",
        "sentiment_label",
        "sentiment_score",
        "relevance_score",
        "url"
    ]

    with open(
        filename,
        "w",
        newline="",
        encoding="utf-8"
    ) as file:

        writer = csv.DictWriter(
            file,
            fieldnames=fieldnames
        )

        writer.writeheader()
        writer.writerows(records)


def save_json(records, filename):
    """
    Save records as JSON.
    """

    with open(
        filename,
        "w",
        encoding="utf-8"
    ) as file:

        json.dump(
            records,
            file,
            indent=2,
            ensure_ascii=False
        )


def main():

    print("=" * 60)
    print("STATS 401 Lab 3 - Financial News Acquisition")
    print("=" * 60)

    data = request_news()

    print("\nTop-level keys:")
    print(list(data.keys()))

    feed = data.get("feed", [])

    print("\nNumber of articles retrieved:", len(feed))

    if not feed:
        raise RuntimeError(
            "The API returned no articles."
        )

    raw_records = parse_articles(feed)

    print(
        "Raw ticker sentiment observations:",
        len(raw_records)
    )

    records = clean_records(raw_records)

    print(
        "Final records after cleaning:",
        len(records)
    )

    if len(records) < 1000:
        raise RuntimeError(
            f"Only {len(records)} final records were obtained. "
            "At least 1000 records are required."
        )

    print("\nRequirement check:")
    print("PASS - At least 1000 records were collected.")

    save_csv(records, CSV_FILE)
    save_json(records, JSON_FILE)

    print("\nFiles saved:")
    print(CSV_FILE)
    print(JSON_FILE)

    print("\nFirst 3 records:")

    for record in records[:3]:
        print(record)

    print("\n" + "=" * 60)
    print("Data acquisition completed successfully.")
    print("=" * 60)


if __name__ == "__main__":
    main()