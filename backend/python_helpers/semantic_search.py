import sys
import json
import os
import numpy as np
from sentence_transformers import SentenceTransformer, util

MODEL_PATH = "./models/all-MiniLM-L6-v2"

def search_for_topic(pages_json, topic_query, field="title", threshold=0.5, max_results=None):
    """
    pages_json: dict like { "Page 1": {"title": ..., "content": ...}, ... }
    topic_query: string (e.g., "MD & CEO's Message")
    field: "title" or "content"
    threshold: include matches with similarity >= threshold
    max_results: if set, cap number of returned matches per topic (sorted by similarity desc)
    """
    model = SentenceTransformer(MODEL_PATH)

    pages = list(pages_json.keys())
    texts = [pages_json[p].get(field, "") or "" for p in pages]

    # Encode
    text_vectors = model.encode(texts, convert_to_tensor=True, normalize_embeddings=True)
    query_vector = model.encode(topic_query, convert_to_tensor=True, normalize_embeddings=True)

    # Similarities
    similarities = util.cos_sim(query_vector, text_vectors)[0].cpu().numpy()

    # Collect ≥ threshold
    hits = []
    for i, score in enumerate(similarities):
        if score >= threshold:
            page = pages[i]
            page_title = pages_json[page].get("title", "")
            page_content = pages_json[page].get("content", "")
            # Build the single-line string in the exact shape you asked:
            # "page title page num page content"
            # page is like "Page 18"; we'll preserve that text.
            joined = f"{page_title} {page} {page_content}"
            hits.append({
                "joined": joined,
                "similarity": float(score)
            })

    # Sort by similarity (high → low) and optionally cap
    hits.sort(key=lambda x: x["similarity"], reverse=True)
    if max_results is not None:
        hits = hits[:max_results]

    # Return only the requested string format
    return [h["joined"] for h in hits]


def main():
    if len(sys.argv) < 3:
        print(f"Usage: python {os.path.basename(sys.argv[0])} pages.json topics.json [threshold] [field] [max_results]")
        print("  pages.json : output from your PDF extractor ({'Page N': {'title','content'}})")
        print("  topics.json: dict of { 'Topic Name': '...summary...' } (only keys used)")
        print("  threshold  : optional float, default 0.5")
        print("  field      : 'title' (default) or 'content'")
        print("  max_results: optional int to cap results per topic")
        sys.exit(1)

    pages_path = sys.argv[1]
    topics_path = sys.argv[2]
    threshold = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
    field = sys.argv[4] if len(sys.argv) > 4 else "title"
    max_results = int(sys.argv[5]) if len(sys.argv) > 5 else None

    with open(pages_path, "r", encoding="utf-8") as f:
        pages_json = json.load(f)

    with open(topics_path, "r", encoding="utf-8") as f:
        topics_json = json.load(f)

    topic_names = list(topics_json.keys())

    results_map = {}
    for topic in topic_names:
        hits = search_for_topic(
            pages_json=pages_json,
            topic_query=topic,
            field=field,
            threshold=threshold,
            max_results=max_results
        )
        results_map[topic] = hits

    out_path = "search_results.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results_map, f, ensure_ascii=False, indent=2)

    # Also print to stdout for quick inspection
    print(json.dumps(results_map, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
