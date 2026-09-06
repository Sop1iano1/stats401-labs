# ============================================================
# STATS 401 — Lab 4
# Cleaning Web Data for Visualization
#
# Stage 1:
#   Raw parquet
#       ↓
#   Structured-data cleaning
#       ↓
#   TF-IDF preprocessing
#       ↓
#   DTM / TF-IDF
#       ↓
#   sentiment-ready CSV
# ============================================================

import re
from pathlib import Path

import pandas as pd

from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer

from sklearn.feature_extraction.text import (
    CountVectorizer,
    TfidfVectorizer
)


# ------------------------------------------------------------
# Paths
# ------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[1]

INPUT_PATH = (
    PROJECT_ROOT
    / "data"
    / "lab4_raw_tweets.parquet"
)

OUTPUT_PATH = (
    PROJECT_ROOT
    / "data"
    / "lab4_sentiment_ready.csv"
)

DTM_PATH = (
    PROJECT_ROOT
    / "data"
    / "lab4_dtm.csv"
)

TFIDF_PATH = (
    PROJECT_ROOT
    / "data"
    / "lab4_tfidf.csv"
)


# ------------------------------------------------------------
# Load data
# ------------------------------------------------------------

print("=" * 70)
print("STATS 401 Lab 4 — Stage 1: Cleaning + TF-IDF")
print("=" * 70)

print("\nLoading:")
print(INPUT_PATH)

df = pd.read_parquet(INPUT_PATH)

print("\nRaw shape:")
print(df.shape)


# ------------------------------------------------------------
# Inspect raw data
# ------------------------------------------------------------

print("\n" + "-" * 70)
print("RAW DATA INSPECTION")
print("-" * 70)

print("\nColumns:")
print(df.columns.tolist())

print("\nMissing values:")
print(df.isna().sum())

print("\nDuplicate full rows:")
print(df.duplicated().sum())

print("\nDuplicate tweet URLs:")
print(df["tweet_url"].duplicated().sum())

print("\nData types:")
print(df.dtypes)


# ------------------------------------------------------------
# Validate required fields
# ------------------------------------------------------------

required_columns = [
    "timestamp",
    "ticker",
    "tweet_url",
    "text"
]

missing_required = [
    col for col in required_columns
    if col not in df.columns
]

if missing_required:
    raise ValueError(
        f"Missing required columns: {missing_required}"
    )


# ------------------------------------------------------------
# Remove exact duplicate rows
# ------------------------------------------------------------

before = len(df)

df = df.drop_duplicates()

after = len(df)

print(
    f"\nRemoved exact duplicate rows: "
    f"{before - after}"
)


# ------------------------------------------------------------
# Remove rows without tweet text
# ------------------------------------------------------------

before = len(df)

df = df.dropna(subset=["text"])

df["text"] = (
    df["text"]
    .astype("string")
    .str.strip()
)

df = df[df["text"].notna()]
df = df[df["text"] != ""]

after = len(df)

print(
    f"Removed rows with missing/empty text: "
    f"{before - after}"
)


# ------------------------------------------------------------
# Preserve original tweet text
# ------------------------------------------------------------

# IMPORTANT:
# This column is kept as close as possible to the original
# tweet text and should be the basis for sentiment analysis.

df["tweet_text_raw"] = df["text"]


# ------------------------------------------------------------
# Parse timestamp
# ------------------------------------------------------------

df["timestamp"] = pd.to_datetime(
    df["timestamp"],
    errors="coerce",
    format="mixed",
    utc=True
)

print(
    "Invalid timestamps converted to NaT:",
    df["timestamp"].isna().sum()
)

df["date"] = df["timestamp"].dt.date.astype(str)
df["hour"] = df["timestamp"].dt.hour
df["weekday"] = df["timestamp"].dt.day_name()


# ------------------------------------------------------------
# Create useful time attributes
# ------------------------------------------------------------

df["date"] = df["timestamp"].dt.date.astype(str)

df["hour"] = df["timestamp"].dt.hour

df["weekday"] = (
    df["timestamp"]
    .dt.day_name()
)


# ------------------------------------------------------------
# Clean categorical/string fields
# ------------------------------------------------------------

string_columns = [
    "ticker",
    "tweet_url",
    "author",
    "category",
    "session",
    "market_regime",
    "sector",
    "market_cap_bucket"
]

for col in string_columns:
    if col in df.columns:
        df[col] = (
            df[col]
            .astype("string")
            .str.strip()
        )


# ------------------------------------------------------------
# Standardize categorical fields
# ------------------------------------------------------------

if "session" in df.columns:

    df["session"] = (
        df["session"]
        .str.lower()
        .str.strip()
    )

    session_map = {
        "regular": "regular",
        "premarket": "premarket",
        "afterhours": "afterhours",
        "after_hours": "afterhours",
        "after-hours": "afterhours"
    }

    df["session"] = (
        df["session"]
        .map(session_map)
        .fillna(df["session"])
    )


if "market_regime" in df.columns:

    df["market_regime"] = (
        df["market_regime"]
        .str.lower()
        .str.strip()
    )


if "market_cap_bucket" in df.columns:

    df["market_cap_bucket"] = (
        df["market_cap_bucket"]
        .str.lower()
        .str.strip()
    )


# ------------------------------------------------------------
# Clean numeric columns
# ------------------------------------------------------------

numeric_columns = [
    "label_1d_3class",
    "volatility_7d",
    "relative_volume",
    "rsi_14",
    "distance_from_ma_20",
    "return_5d",
    "return_20d",
    "above_ma_20",
    "slope_ma_20",
    "gap_open",
    "intraday_range"
]

for col in numeric_columns:

    if col in df.columns:

        df[col] = pd.to_numeric(
            df[col],
            errors="coerce"
        )


# ------------------------------------------------------------
# Basic invalid-value checks
# ------------------------------------------------------------

# RSI should normally be between 0 and 100.
if "rsi_14" in df.columns:

    invalid_rsi = (
        (df["rsi_14"] < 0)
        | (df["rsi_14"] > 100)
    )

    print(
        "\nInvalid RSI values:",
        invalid_rsi.sum()
    )

    df.loc[invalid_rsi, "rsi_14"] = pd.NA


# Relative volume should not be negative.
if "relative_volume" in df.columns:

    invalid_volume = (
        df["relative_volume"] < 0
    )

    print(
        "Invalid relative_volume values:",
        invalid_volume.sum()
    )

    df.loc[
        invalid_volume,
        "relative_volume"
    ] = pd.NA


# ------------------------------------------------------------
# Light text normalization for TF-IDF
# ------------------------------------------------------------

def normalize_tweet(text):

    text = str(text)

    text = text.lower()

    # URLs
    text = re.sub(
        r"https?://\S+|www\.\S+",
        " URL ",
        text
    )

    # User mentions
    text = re.sub(
        r"@\w+",
        " USER ",
        text
    )

    # Numbers
    text = re.sub(
        r"\b\d+(?:\.\d+)?\b",
        " NUMBER ",
        text
    )

    # Normalize whitespace
    text = re.sub(
        r"\s+",
        " ",
        text
    )

    return text.strip()


df["text_normalized"] = (
    df["tweet_text_raw"]
    .apply(normalize_tweet)
)


# ------------------------------------------------------------
# Tokenization
# ------------------------------------------------------------

print("\nTokenizing tweets...")

df["tokens"] = (
    df["text_normalized"]
    .apply(word_tokenize)
)


# ------------------------------------------------------------
# Stop-word removal
# ------------------------------------------------------------

stop_words = set(
    stopwords.words("english")
)


def remove_stopwords(tokens):

    return [
        token
        for token in tokens
        if token not in stop_words
    ]


df["tokens_no_stop"] = (
    df["tokens"]
    .apply(remove_stopwords)
)


# ------------------------------------------------------------
# Lemmatization
# ------------------------------------------------------------

lemmatizer = WordNetLemmatizer()


def lemmatize_tokens(tokens):

    return [
        lemmatizer.lemmatize(token)
        for token in tokens
        if token.isalpha()
    ]


df["tokens_clean"] = (
    df["tokens_no_stop"]
    .apply(lemmatize_tokens)
)


df["text_clean"] = (
    df["tokens_clean"]
    .apply(" ".join)
)


# ------------------------------------------------------------
# Inspect preprocessing
# ------------------------------------------------------------

print("\nText preprocessing example:")

print(
    df[
        [
            "tweet_text_raw",
            "text_clean"
        ]
    ].head(5).to_string(index=False)
)


# ------------------------------------------------------------
# DTM
# ------------------------------------------------------------

print("\nCreating Document-Term Matrix...")

count_vectorizer = CountVectorizer(
    min_df=2,
    max_df=0.90,
    lowercase=True
)

dtm = count_vectorizer.fit_transform(
    df["text_clean"]
)

terms = (
    count_vectorizer
    .get_feature_names_out()
)

print(
    "DTM shape:",
    dtm.shape
)

print(
    "Vocabulary size:",
    len(terms)
)


# ------------------------------------------------------------
# Save DTM
# ------------------------------------------------------------

dtm_df = pd.DataFrame(
    dtm.toarray(),
    columns=terms
)

dtm_df.to_csv(
    DTM_PATH,
    index=False
)

print(
    "\nSaved DTM:",
    DTM_PATH
)


# ------------------------------------------------------------
# TF-IDF
# ------------------------------------------------------------

print("\nCreating TF-IDF matrix...")

tfidf_vectorizer = TfidfVectorizer(
    min_df=2,
    max_df=0.90,
    lowercase=True
)

tfidf = tfidf_vectorizer.fit_transform(
    df["text_clean"]
)

tfidf_terms = (
    tfidf_vectorizer
    .get_feature_names_out()
)

print(
    "TF-IDF shape:",
    tfidf.shape
)


# ------------------------------------------------------------
# Save TF-IDF
# ------------------------------------------------------------

tfidf_df = pd.DataFrame(
    tfidf.toarray(),
    columns=tfidf_terms
)

tfidf_df.to_csv(
    TFIDF_PATH,
    index=False
)

print(
    "Saved TF-IDF:",
    TFIDF_PATH
)


# ------------------------------------------------------------
# Prepare sentiment-ready dataset
# ------------------------------------------------------------

sentiment_columns = [
    "timestamp",
    "date",
    "hour",
    "weekday",
    "ticker",
    "tweet_url",
    "author",
    "category",
    "session",
    "market_regime",
    "sector",
    "market_cap_bucket",
    "volatility_7d",
    "relative_volume",
    "rsi_14",
    "distance_from_ma_20",
    "return_5d",
    "return_20d",
    "above_ma_20",
    "slope_ma_20",
    "gap_open",
    "intraday_range",
    "label_1d_3class",
    "tweet_text_raw",
    "text_normalized",
    "text_clean"
]

sentiment_columns = [
    col
    for col in sentiment_columns
    if col in df.columns
]

sentiment_df = df[
    sentiment_columns
].copy()


# ------------------------------------------------------------
# Final inspection
# ------------------------------------------------------------

print("\n" + "-" * 70)
print("CLEANED DATA INSPECTION")
print("-" * 70)

print("\nFinal shape:")
print(sentiment_df.shape)

print("\nMissing values:")
print(
    sentiment_df.isna().sum()
)

print("\nData types:")
print(
    sentiment_df.dtypes
)


# ------------------------------------------------------------
# Export
# ------------------------------------------------------------

sentiment_df.to_csv(
    OUTPUT_PATH,
    index=False
)

print(
    "\nSaved sentiment-ready dataset:"
)

print(OUTPUT_PATH)

print("\nStage 1 completed.")