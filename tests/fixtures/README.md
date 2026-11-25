# OCR fixtures

`ocr-carbon-pyro-A.txt` and `ocr-carbon-pyro-B.txt` are **reconstructed** from K's two
screenshots of the Pyro Carbon contracts (one delivery to Ruin Station, three pickups each,
"8 SCU or smaller", reward 745,250). The raw engine output was not available when the test was
written, so the text follows the mobiGlas layout the engines produce (A: two-column
interleaving as PaddleOCR/tesseract return it, B: one objective per line). Replace them with the
real PaddleOCR / tesseract text when available; the assertions should still hold.
