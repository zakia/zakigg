LedgerClean SetFit merchant classifier

Derived from maaz-zaidi/transaction-classifier-setfit, revision 7425982167ac525d5ae26ebf66367e247398cccd.
Source: https://huggingface.co/maaz-zaidi/transaction-classifier-setfit
Source author: Maaz Zaidi. Source model license: Apache License 2.0 (LICENSE.txt).

Changes: SetFit contrastive adaptation to LedgerClean's eight spending roots, quantized ONNX export, and a new JSON logistic head. Curated training examples and the smoke evaluation are in scripts/ledgerclean-model. No private bank records are used. Scores are uncalibrated; this prototype requires reviewed rule approval.
