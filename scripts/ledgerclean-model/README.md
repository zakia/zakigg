# LedgerClean SetFit prototype

One transaction-trained sentence encoder and a logistic classification head for the eight default spending roots. The body starts from [maaz-zaidi/transaction-classifier-setfit](https://huggingface.co/maaz-zaidi/transaction-classifier-setfit), pinned to `7425982167ac525d5ae26ebf66367e247398cccd` (Apache-2.0). Its original categories differ from LedgerClean's, so we adapt the encoder with 300 SetFit contrastive steps on `examples.json` and fit our own head. We read safe tensor weights; the upstream pickle head is never loaded.

The seed examples are developer-curated public merchant names and transaction types. They contain no private bank records. The evaluation is a smoke fixture with brand variants crossing splits; its numbers must not be presented as independent real-world accuracy. Value Buds is represented in training; its statement variation is a regression check, not evidence of recognizing an unseen merchant. The abbreviated Spadina Vet description is not in training.

Retrain/export from the repository root:

```sh
uv venv /tmp/ledgerclean-model-venv --python 3.12
uv pip install --python /tmp/ledgerclean-model-venv/bin/python -r scripts/ledgerclean-model/requirements.txt
/tmp/ledgerclean-model-venv/bin/python scripts/ledgerclean-model/export.py
```

Outputs:

- `static/models/ledgerclean-setfit-v1/`: tokenizer/config and quantized ONNX encoder, about 23 MB.
- `src/lib/tools/ledgerclean/setfit-head.json`: numeric head weights, stable category IDs, encoder fingerprint and provenance.
- `evaluation.json`: full smoke predictions, scores and confusion matrix.

The head is fit on **quantized ONNX embeddings**, matching the browser's mean pooling and normalization. The browser loads the assets once and runs inference in a WASM worker; there are no model/provider calls with merchant data. Cache identity includes the encoder hash. The training stack is development-only and does not increase the browser download. Ship the model folder with the app; regenerating the head and body is one operation.

Scores are classifier outputs, not calibrated likelihoods of correctness. At score < 0.45 or class gap < 0.10, the app returns Uncategorized. Distinct candidates below 0.70 are shown for manual review and are never preselected. Suggestions only become rules after review. Existing approved rules remain authoritative. This fixed head targets the default root IDs; renamed roots work, but new categories and subcategories require manual rules. This keeps the prototype to one model, one head, and the existing review workflow.
