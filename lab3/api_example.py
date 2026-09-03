import os
import requests

API_KEY = os.getenv("ALPHAVANTAGE_API_KEY")

if not API_KEY:
    raise RuntimeError("ALPHAVANTAGE_API_KEY is not set.")

url = "https://www.alphavantage.co/query"

params = {
    "function": "NEWS_SENTIMENT",
    "tickers": "AAPL",
    "limit": 1000,
    "apikey": API_KEY
}

try:
    response = requests.get(
        url,
        params=params,
        timeout=10
    )

    print("Status code:", response.status_code)

    response.raise_for_status()

    data = response.json()

except requests.RequestException as error:
    print("Request failed:", error)
    raise

print("\nTop-level keys:")
print(data.keys())

feed = data.get("feed", [])

print("\nNumber of articles:", len(feed))

ticker_observations = 0

for article in feed:
    ticker_sentiment = article.get("ticker_sentiment", [])
    ticker_observations += len(ticker_sentiment)

print("Number of ticker sentiment observations:", ticker_observations)

if feed:
    print("\nFirst article title:")
    print(feed[0].get("title"))

    print("\nFirst article ticker sentiment:")
    print(feed[0].get("ticker_sentiment"))