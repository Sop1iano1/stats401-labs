# ============================================================
# STATS 401 Lab 4 — Stage 2
# RoBERTa Sentiment Analysis
# ============================================================

from pathlib import Path
import pandas as pd
from transformers import pipeline
from tqdm import tqdm


# ------------------------------------------------------------
# Paths
# ------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"

INPUT_PATH = DATA_DIR / "lab4_sentiment_ready.csv"
OUTPUT_PATH = DATA_DIR / "lab4_clean_tweets_sentiment.csv"

# Number of tweets to analyze
SAMPLE_SIZE = 3000

# Fixed seed so the same tweets are selected every time
RANDOM_STATE = 401


print("=" * 70)
print("STATS 401 Lab 4 — Stage 2: RoBERTa Sentiment Analysis")
print("=" * 70)


# ------------------------------------------------------------
# Load cleaned dataset
# ------------------------------------------------------------

print("\nLoading input file:")
print(INPUT_PATH)

if not INPUT_PATH.exists():
    raise FileNotFoundError(
        f"\nInput file not found:\n{INPUT_PATH}\n\n"
        "Please run clean_tweets.py first."
    )

df = pd.read_csv(INPUT_PATH)

print("\nInput shape:")
print(df.shape)

print("\nColumns:")
print(df.columns.tolist())


# ------------------------------------------------------------
# Check required text field
# ------------------------------------------------------------

if "tweet_text_raw" not in df.columns:
    raise ValueError(
        "Required column 'tweet_text_raw' is missing."
    )

df["tweet_text_raw"] = df["tweet_text_raw"].fillna("").astype(str)


# ------------------------------------------------------------
# Fixed random sample
# ------------------------------------------------------------

if len(df) < SAMPLE_SIZE:
    raise ValueError(
        f"Dataset contains only {len(df)} rows, "
        f"but SAMPLE_SIZE={SAMPLE_SIZE}."
    )

df = df.sample(
    n=SAMPLE_SIZE,
    random_state=RANDOM_STATE
).reset_index(drop=True)

print("\n" + "-" * 70)
print("SENTIMENT SAMPLE")
print("-" * 70)

print(f"Original records:  {len(pd.read_csv(INPUT_PATH)):,}")
print(f"Sample size:       {len(df):,}")
print(f"Random state:      {RANDOM_STATE}")


# ------------------------------------------------------------
# Prepare text for RoBERTa
# ------------------------------------------------------------

def prepare_for_roberta(text):
    """
    Light normalization for RoBERTa.

    We intentionally do NOT use text_clean here because
    RoBERTa should receive natural-language information such
    as stopwords, punctuation, and original wording.
    """
    text = str(text)

    # Standard Twitter-style placeholders
    import re

    text = re.sub(r"@\w+", "@user", text)
    text = re.sub(r"https?://\S+|www\.\S+", "http", text)

    # Normalize whitespace
    text = re.sub(r"\s+", " ", text).strip()

    return text


print("\nPreparing sentiment text...")

df["sentiment_text"] = df["tweet_text_raw"].apply(
    prepare_for_roberta
)

empty_sentiment_texts = (
    df["sentiment_text"].str.strip().eq("").sum()
)

print(f"Empty sentiment texts: {empty_sentiment_texts}")

if empty_sentiment_texts > 0:
    raise ValueError(
        f"Found {empty_sentiment_texts} empty sentiment texts."
    )


# ------------------------------------------------------------
# Load RoBERTa model
# ------------------------------------------------------------

MODEL_NAME = "cardiffnlp/twitter-roberta-base-sentiment-latest"

print("\nLoading sentiment model:")
print(MODEL_NAME)

print(
    "\nThe first run may take some time because the model "
    "may need to be downloaded from Hugging Face."
)

sentiment_model = pipeline(
    "sentiment-analysis",
    model=MODEL_NAME,
    tokenizer=MODEL_NAME,
    top_k=None
)

print("\nModel loaded successfully.")


# ------------------------------------------------------------
# Model test
# ------------------------------------------------------------

print("\n" + "-" * 70)
print("MODEL TEST")
print("-" * 70)

test_tweet = "I absolutely love this new update!"

print("\nTest tweet:")
print(test_tweet)

test_output = sentiment_model(
    test_tweet,
    truncation=True,
    max_length=512
)

print("\nModel output:")
print(test_output)


# ------------------------------------------------------------
# Batch sentiment analysis
# ------------------------------------------------------------

print("\n" + "-" * 70)
print("RUNNING SENTIMENT ANALYSIS")
print("-" * 70)

print(f"\nNumber of tweets: {len(df):,}")
print("Batch size: 16")
print("Maximum sequence length: 512")
print("\nProgress:")

texts = df["sentiment_text"].tolist()

all_results = []

BATCH_SIZE = 16

for start in tqdm(
    range(0, len(texts), BATCH_SIZE),
    desc="RoBERTa sentiment",
    unit="batch"
):
    batch_texts = texts[start:start + BATCH_SIZE]

    batch_results = sentiment_model(
        batch_texts,
        truncation=True,
        max_length=512,
        batch_size=BATCH_SIZE
    )

    all_results.extend(batch_results)


# ------------------------------------------------------------
# Convert model output
# ------------------------------------------------------------

print("\nSentiment analysis completed.")

negative_scores = []
neutral_scores = []
positive_scores = []
sentiments = []

for result in all_results:

    result_dict = {
        item["label"].lower(): item["score"]
        for item in result
    }

    negative = result_dict.get("negative", 0.0)
    neutral = result_dict.get("neutral", 0.0)
    positive = result_dict.get("positive", 0.0)

    negative_scores.append(negative)
    neutral_scores.append(neutral)
    positive_scores.append(positive)

    sentiment = max(
        [
            ("negative", negative),
            ("neutral", neutral),
            ("positive", positive)
        ],
        key=lambda x: x[1]
    )[0]

    sentiments.append(sentiment.capitalize())


# ------------------------------------------------------------
# Add sentiment fields
# ------------------------------------------------------------

df["sentiment_negative"] = negative_scores
df["sentiment_neutral"] = neutral_scores
df["sentiment_positive"] = positive_scores

df["sentiment"] = sentiments

# Continuous sentiment score:
# positive probability - negative probability
df["sentiment_score"] = (
    df["sentiment_positive"]
    - df["sentiment_negative"]
)


# ------------------------------------------------------------
# Final inspection
# ------------------------------------------------------------

print("\n" + "-" * 70)
print("SENTIMENT RESULTS")
print("-" * 70)

print("\nSentiment counts:")
print(df["sentiment"].value_counts())

print("\nSentiment score summary:")
print(df["sentiment_score"].describe())

print("\nProbability sums:")
probability_sum = (
    df["sentiment_negative"]
    + df["sentiment_neutral"]
    + df["sentiment_positive"]
)

print(probability_sum.describe())

print("\nMissing sentiment values:")

sentiment_columns = [
    "sentiment_negative",
    "sentiment_neutral",
    "sentiment_positive",
    "sentiment",
    "sentiment_score"
]

print(
    df[sentiment_columns]
    .isna()
    .sum()
)


# ------------------------------------------------------------
# Save final dataset
# ------------------------------------------------------------

df.to_csv(
    OUTPUT_PATH,
    index=False
)

print("\n" + "-" * 70)
print("FINAL OUTPUT")
print("-" * 70)

print("\nFinal shape:")
print(df.shape)

print("\nSaved sentiment dataset:")
print(OUTPUT_PATH)

print("\n" + "=" * 70)
print("Stage 2 completed.")
print("=" * 70)
