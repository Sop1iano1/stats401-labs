"""
STATS 401 — Lab 8, Part C: semantic analysis of the DKU Bulletin passages.

    pip install sentence-transformers umap-learn scikit-learn pandas numpy
    OMP_NUM_THREADS=1 KMP_DUPLICATE_LIB_OK=TRUE python lab8_semantic.py

Embeddings are cached in lab8_embeddings.npy, so re-running is cheap.
If UMAP still segfaults, run again with SAFE_UMAP=1 in the environment.

Input   : bulletin_passages.csv
Outputs : lab8_embedding_map.csv, lab8_topic_section_matrix.csv,
          lab8_corpus_terms.csv, lab8_cluster_report.txt
"""

# --- thread settings must be applied before numpy / numba / sklearn load
import os

os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("NUMEXPR_NUM_THREADS", "1")
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
if os.environ.get("SAFE_UMAP") == "1":
    os.environ["NUMBA_NUM_THREADS"] = "1"
# -----------------------------------------------------------------------

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

SEED = 401
N_CLUSTERS = 8
N_NEIGHBORS = 5
MODEL_NAME = "all-MiniLM-L6-v2"
CACHE = "lab8_embeddings.npy"

# ---------------------------------------------------------------- load
df = pd.read_csv("bulletin_passages.csv")
df["subsection"] = df["subsection"].fillna("")
df["text_clean"] = df["text"].str.replace(r"\s+", " ", regex=True).str.strip()
df = df.dropna(subset=["text_clean"]).drop_duplicates(subset=["text_clean"])
df = df.reset_index(drop=True)
print(f"{len(df)} passages, {df['section'].nunique()} formal sections")

# ------------------------------------------------------- 1. embeddings
if os.path.exists(CACHE):
    emb = np.load(CACHE)
    print(f"loaded cached embeddings {emb.shape} from {CACHE}")
    assert len(emb) == len(df), "cache does not match the passage file — delete it"
else:
    from sentence_transformers import SentenceTransformer

    print(f"encoding with {MODEL_NAME} ...")
    model = SentenceTransformer(MODEL_NAME)
    emb = model.encode(
        df["text_clean"].tolist(),
        normalize_embeddings=True,
        batch_size=32,
        show_progress_bar=True,
    )
    emb = np.asarray(emb, dtype="float32")
    np.save(CACHE, emb)
    print("embedding shape:", emb.shape, "-> cached")

# ------------------------------------------------------- 2. UMAP to 2D
print("projecting with UMAP ...")
import umap

reducer = umap.UMAP(
    n_components=2,
    n_neighbors=15,
    min_dist=0.15,
    metric="cosine",
    init="pca" if os.environ.get("SAFE_UMAP") == "1" else "spectral",
    random_state=SEED,
    verbose=True,
)
coords = reducer.fit_transform(emb)
df["x"] = coords[:, 0]
df["y"] = coords[:, 1]
np.save("lab8_umap_coords.npy", coords)
print("UMAP done")

# --------------------------------------------- 3. cluster the full vectors
kmeans = KMeans(n_clusters=N_CLUSTERS, random_state=SEED, n_init=10)
print("clustering done")
df["cluster"] = kmeans.fit_predict(emb)

# ------------------------------------------ 4. nearest semantic neighbors
sim = cosine_similarity(emb)
np.fill_diagonal(sim, -1)
order = np.argsort(-sim, axis=1)[:, :N_NEIGHBORS]
for k in range(N_NEIGHBORS):
    df[f"nn{k + 1}"] = df["passage_id"].values[order[:, k]]
    df[f"nn{k + 1}_sim"] = sim[np.arange(len(df)), order[:, k]].round(4)

# ----------------- 5. how typical is a passage for its own formal section
#     high score = the passage is unusual relative to its section
section_centroid = {}
for sec, idx in df.groupby("section").groups.items():
    section_centroid[sec] = emb[list(idx)].mean(axis=0)
df["outlier_score"] = [
    round(float(1 - np.dot(emb[i], section_centroid[df.loc[i, "section"]])
                / (np.linalg.norm(section_centroid[df.loc[i, "section"]]) + 1e-9)), 4)
    for i in range(len(df))
]

# ------------------------------------------- 6. TF-IDF terms for labelling
tfidf = TfidfVectorizer(stop_words="english", max_features=20000,
                        ngram_range=(1, 2), min_df=3)
X = tfidf.fit_transform(df["text_clean"])
terms = np.array(tfidf.get_feature_names_out())


def top_terms(mask, n=12):
    if mask.sum() == 0:
        return []
    mean = np.asarray(X[mask].mean(axis=0)).ravel()
    return list(terms[np.argsort(-mean)[:n]])


with open("lab8_cluster_report.txt", "w", encoding="utf-8") as f:
    for c in range(N_CLUSTERS):
        mask = (df["cluster"] == c).values
        sub = df[mask]
        centre = kmeans.cluster_centers_[c]
        closest = sub.assign(d=emb[mask] @ centre).nlargest(8, "d")
        f.write(f"\n{'=' * 70}\nCLUSTER {c}  ({mask.sum()} passages)\n")
        f.write("top terms: " + ", ".join(top_terms(mask)) + "\n")
        f.write("chapters: " + ", ".join(
            f"{k} ({v})" for k, v in sub["chapter"].value_counts().head(4).items()
        ) + "\n")
        f.write("sections: " + ", ".join(
            f"{k} ({v})" for k, v in sub["section"].value_counts().head(5).items()
        ) + "\n\n")
        for _, r in closest.iterrows():
            f.write(f"  [{r.passage_id} | {r.section} | p.{r.page}]\n")
            f.write(f"  {r.text_clean[:320]}\n\n")

# corpus-level terms per section (for the overview charts)
rows = []
for sec, sub in df.groupby("section"):
    if len(sub) < 4:
        continue
    mask = df["section"].eq(sec).values
    rows.append({
        "section": sec,
        "n_passages": len(sub),
        "avg_words": round(sub["word_count"].mean(), 1),
        "top_terms": "; ".join(top_terms(mask, 8)),
    })
pd.DataFrame(rows).sort_values("n_passages", ascending=False) \
    .to_csv("lab8_corpus_terms.csv", index=False)

# ------------------------------------------------------------- 7. export
df["cluster_name"] = "Topic " + df["cluster"].astype(str)   # relabelled later

cols = ["passage_id", "chapter", "section", "subsection", "page",
        "text", "word_count", "cluster", "cluster_name", "x", "y",
        "outlier_score"] + [f"nn{k + 1}" for k in range(N_NEIGHBORS)] \
    + [f"nn{k + 1}_sim" for k in range(N_NEIGHBORS)]
df[cols].to_csv("lab8_embedding_map.csv", index=False)

matrix = (df.groupby(["section", "cluster", "cluster_name"])
            .size().reset_index(name="count"))
matrix.to_csv("lab8_topic_section_matrix.csv", index=False)

print("\nwrote lab8_embedding_map.csv, lab8_topic_section_matrix.csv,")
print("      lab8_corpus_terms.csv, lab8_cluster_report.txt")
print("\nCluster sizes:\n", df["cluster"].value_counts().sort_index())
