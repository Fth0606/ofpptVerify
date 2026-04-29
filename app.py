# pip install flask flask-cors opencv-python easyocr paddleocr arabic-reshaper python-bidi python-dateutil

import os
import logging
import unicodedata
from glob import glob
import cv2
import numpy as np
import easyocr
from paddleocr import PaddleOCR
from flask import Flask, request, jsonify
from flask_cors import CORS
import zipfile
import tempfile
import re
import json
import shutil
from dateutil import parser as dateutil_parser
from difflib import SequenceMatcher

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

# ---------------------------------------------------------------------------
# Arabic display helpers
# ---------------------------------------------------------------------------
try:
    import arabic_reshaper
    from bidi.algorithm import get_display as bidi_get_display
    _ARABIC_SUPPORT = True
except ImportError:
    logging.warning("arabic_reshaper / python-bidi not installed.")
    _ARABIC_SUPPORT = False

# ---------------------------------------------------------------------------
# OCR models — ONE EasyOCR reader for all languages, run once per image
# ---------------------------------------------------------------------------
try:
    # NOTE: some EasyOCR versions error if you mix Arabic with non-English
    # languages in the same reader. Arabic works with ['ar','en'].
    reader_easyocr = easyocr.Reader(['ar', 'en'], gpu=False)
    logging.info("EasyOCR (ar+en) loaded.")
except Exception as e:
    logging.error(f"Error loading EasyOCR: {e}")
    reader_easyocr = None

try:
    # use_gpu=False + enable_mkldnn=False disables oneDNN (Intel MKL-DNN) which
    # causes a hard crash on Windows with recent PaddleOCR versions:
    # "ConvertPirAttribute2RuntimeAttribute not support [pir::ArrayAttribute<pir::DoubleAttribute>]"
    # Disabling mkldnn falls back to plain CPU execution — slower but stable.
    reader_paddle = PaddleOCR(
        use_angle_cls=True,
        lang='fr',
        enable_mkldnn=False,   # FIX: prevents Windows oneDNN crash
        cpu_threads=4,
    )
    logging.info("PaddleOCR (fr) loaded.")
except Exception as e:
    logging.error(f"Error loading PaddleOCR: {e}")
    reader_paddle = None

# ---------------------------------------------------------------------------
# Regex constants
# ---------------------------------------------------------------------------
BIRTH_LABEL_RE = re.compile(
    r"(?i)n[ée]e?\s*\(?e?\)?\s*l[ée]|n[ée]\s*l[ée]|ne\s*le|date\s*de\s*naissance|naissance\s*[\(\)]?\s*l[ée]"
)
DATE_INVALID_CONTEXT_RE = re.compile(
    r"(?i)valable|jusqu|expir|d[ée]liv|d[ée]livr|[ée]tabli|signature|autorit[ée]"
)
MRZ_LINE2_DOB_RE = re.compile(
    r"(?<![0-9])(\d{2})(\d{2})(\d{2})\d[MF<](\d{2})(\d{2})(\d{2})"
)
DATE_IN_TEXT_RE = re.compile(
    r"\b(\d{1,2}[\.\-\/\s]\d{1,2}[\.\-\/\s]\d{2,4})\b"
)

# ---------------------------------------------------------------------------
# Script detection — RELAXED thresholds for real-world bilingual scans
# ---------------------------------------------------------------------------

def is_arabic_block(text):
    """
    True if at least 25% of non-space characters are Arabic Unicode.
    FIX: was 15% but on bilingual cards EasyOCR mixes scripts in one block.
    25% is the right balance — catches Arabic blocks without false-positiving Latin.
    """
    if not text:
        return False
    chars = [c for c in text if c != ' ']
    if not chars:
        return False
    ratio = sum(1 for c in chars if '\u0600' <= c <= '\u06FF') / len(chars)
    return ratio >= 0.25


def is_latin_block(text):
    """
    True if fewer than 25% of characters are Arabic.
    Mirrors is_arabic_block threshold so no block falls through the gap.
    """
    if not text:
        return False
    chars = [c for c in text if c != ' ']
    if not chars:
        return False
    ratio = sum(1 for c in chars if '\u0600' <= c <= '\u06FF') / len(chars)
    return ratio < 0.25


# ---------------------------------------------------------------------------
# Arabic text handling
#
# CRITICAL FIX: fix_arabic() must ONLY be applied for display/storage output.
# It must NEVER be applied before matching because arabic_reshaper+bidi reverses
# the character order for visual rendering — matching against a reversed string
# against a logical-order DB value will always fail.
#
# Rule: fix_arabic() → called once when storing the final result
#       clean_arabic_for_match() → called on raw OCR text before any comparison
# ---------------------------------------------------------------------------

def fix_arabic_for_display(text):
    """Reshape + BiDi for frontend display only. Never call before matching."""
    if not _ARABIC_SUPPORT or not text:
        return text
    try:
        return bidi_get_display(arabic_reshaper.reshape(text))
    except Exception as e:
        logging.warning(f"fix_arabic_for_display failed: {e}")
        return text


def clean_arabic_for_match(s):
    """
    Normalize Arabic for fuzzy matching (logical order, no diacritics).
    This is the ONLY normalization used before any comparison.
    """
    if not s:
        return ""
    s = re.sub(r'[\u064B-\u065F\u0670]', '', s)           # strip tashkeel
    s = re.sub(r'[\u0622\u0623\u0625\u0671]', '\u0627', s) # alef variants → ا
    s = re.sub(r'\u0629', '\u0647', s)                     # ة → ه
    s = re.sub(r'\u0649', '\u064A', s)                     # ى → ي
    s = re.sub(r'[^\u0600-\u06FF\s]', ' ', s)              # keep Arabic + spaces
    s = re.sub(r'\s+', ' ', s).strip()
    return s

# ---------------------------------------------------------------------------
# Date utilities
# ---------------------------------------------------------------------------

def normalize_date(date_str):
    if not date_str:
        return None
    clean_date = re.sub(r'[^0-9\.\-\/:]', '', date_str)
    clean_date = re.sub(r'[\.\-\/:]', '/', clean_date)
    parts = clean_date.split('/')
    if len(parts) == 3:
        year_part = parts[2]
        if not (re.match(r'^\d{4}$', year_part) and 1900 <= int(year_part) <= 2100):
            return None
        return f"{parts[0].zfill(2)}/{parts[1].zfill(2)}/{year_part}"
    return clean_date


def parse_date_to_ddmmyyyy(date_fragment):
    if not date_fragment:
        return None
    clean = re.sub(r"[^0-9\.\-\/\s]", "", date_fragment).strip()
    clean = re.sub(r"[\.\-\/\s]+", "/", clean)
    parts = [p for p in clean.split("/") if p]
    if len(parts) == 3:
        d, m, y = parts[0], parts[1], parts[2]
        if len(y) == 2:
            y = "20" + y if int(y) <= 69 else "19" + y
        try:
            day_i, month_i, year_i = int(d), int(m), int(y)
            if 1 <= day_i <= 31 and 1 <= month_i <= 12 and 1900 <= year_i <= 2100:
                return f"{day_i:02d}/{month_i:02d}/{year_i}"
        except ValueError:
            pass
    try:
        dt = dateutil_parser.parse(date_fragment, dayfirst=True, fuzzy=False)
        return f"{dt.day:02d}/{dt.month:02d}/{dt.year}"
    except Exception:
        return None


def extract_dob_from_mrz(full_text):
    if not full_text:
        return None
    compact = re.sub(r"\s+", "", full_text)
    m = MRZ_LINE2_DOB_RE.search(compact)
    if not m:
        return None
    yy, mm, dd = m.group(1), m.group(2), m.group(3)
    try:
        year = 2000 + int(yy) if int(yy) <= 69 else 1900 + int(yy)
        month_i, day_i = int(mm), int(dd)
        if 1 <= month_i <= 12 and 1 <= day_i <= 31:
            return normalize_date(f"{day_i:02d}/{month_i:02d}/{year}")
    except ValueError:
        pass
    return None


def extract_birth_date_smart(full_text, ocr_blocks):
    if not full_text:
        return None
    lines = [ln.strip() for ln in full_text.split("\n") if ln.strip()]

    for line in lines:
        if BIRTH_LABEL_RE.search(line):
            for m in DATE_IN_TEXT_RE.finditer(line):
                parsed = parse_date_to_ddmmyyyy(m.group(1))
                if parsed:
                    return normalize_date(parsed)

    for i, line in enumerate(lines):
        if BIRTH_LABEL_RE.search(line) and not DATE_IN_TEXT_RE.search(line):
            for j in range(i + 1, min(i + 3, len(lines))):
                nxt = lines[j]
                if DATE_INVALID_CONTEXT_RE.search(nxt) and not BIRTH_LABEL_RE.search(nxt):
                    continue
                for m in DATE_IN_TEXT_RE.finditer(nxt):
                    parsed = parse_date_to_ddmmyyyy(m.group(1))
                    if parsed:
                        return normalize_date(parsed)

    ordered = sort_blocks_reading_order(ocr_blocks)
    for i, (_, txt) in enumerate(ordered):
        if BIRTH_LABEL_RE.search(txt):
            chunk = txt
            for j in range(i + 1, min(i + 3, len(ordered))):
                chunk = chunk + " " + ordered[j][1]
            if DATE_INVALID_CONTEXT_RE.search(chunk) and not BIRTH_LABEL_RE.search(chunk):
                continue
            for m in DATE_IN_TEXT_RE.finditer(chunk):
                parsed = parse_date_to_ddmmyyyy(m.group(1))
                if parsed:
                    return normalize_date(parsed)

    m = re.search(
        r"(?i)(?:n[ée]e?\s*\(?e?\)?\s*l[ée]|date\s*de\s*naissance)\s*[:\s]*(\d{1,2}[\.\-\/\s]\d{1,2}[\.\-\/\s]\d{2,4})",
        full_text
    )
    if m:
        parsed = parse_date_to_ddmmyyyy(m.group(1))
        if parsed:
            return normalize_date(parsed)

    return extract_dob_from_mrz(full_text)

# ---------------------------------------------------------------------------
# Block sorting and field extraction
# ---------------------------------------------------------------------------

def sort_blocks_reading_order(ocr_blocks):
    def sort_key(item):
        box, _ = item
        if not box or len(box) < 4:
            return (0, 0)
        ys = [float(p[1]) for p in box]
        xs = [float(p[0]) for p in box]
        return (sum(ys) / len(ys), min(xs))
    return sorted(ocr_blocks or [], key=sort_key)


def extract_cin_number(full_text, ocr_blocks):
    if not full_text:
        return None
    patterns = [
        r"(?i)n[°ºo]?\s*[.:]?\s*([A-Z]{1,2}\d{5,8})\b",
        r"(?i)\b([A-Z]{1,2}\d{5,8})\b",
        r"(?i)cin\s*[:\s]*([A-Z]{1,2}\d{5,8})\b",
    ]
    for pat in patterns:
        m = re.search(pat, full_text)
        if m:
            return m.group(1).upper()
    return None


def extract_cne_number(full_text):
    if not full_text:
        return None
    pattern = r'\b([A-Za-z]\d{8,9}|\d{8,13})\b'
    matches = list(re.finditer(pattern, full_text))
    if not matches:
        return None
    context_re = re.compile(r'(?i)\b(cne|massar|code|id)\b')
    context_positions = [m.start() for m in context_re.finditer(full_text)]
    if context_positions:
        best_match = None
        best_distance = float('inf')
        for match in matches:
            for ctx_pos in context_positions:
                distance = abs(match.start() - ctx_pos)
                if distance < best_distance:
                    best_distance = distance
                    best_match = match
        if best_match:
            return best_match.group(0).upper()
    return matches[0].group(0).upper()

# ---------------------------------------------------------------------------
# String normalization — French/Latin
# ---------------------------------------------------------------------------

def clean_string_for_match(s):
    """Strip diacritics, lowercase, alphanumeric only — for French name matching."""
    if not s:
        return ""
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = re.sub(r"[^a-zA-Z0-9\s]", " ", s)
    s = re.sub(r"\s+", " ", s).strip().lower()
    return s

# ---------------------------------------------------------------------------
# Name matching — French
# ---------------------------------------------------------------------------

def supervised_name_extraction(ocr_text, expected_name):
    """
    Supervised French name extraction.
    
    FIX for split-line names (e.g. CIN has 'ZAYAD' on line 1, 'SAHMOUDI' on line 2):
    The full text is checked both as-is (newline-joined) AND as a single space-joined
    string, so names split across lines are still found by substring match.
    """
    if not expected_name or not ocr_text:
        return None

    expected_clean = clean_string_for_match(expected_name)
    # Check both newline-joined and space-joined versions
    ocr_clean_newline = clean_string_for_match(ocr_text)
    ocr_clean_space = clean_string_for_match(ocr_text.replace('\n', ' '))

    # Substring match (handles names on one line)
    if expected_clean in ocr_clean_newline or expected_clean in ocr_clean_space:
        return expected_name

    expected_words = expected_clean.split()
    if not expected_words:
        return None

    # Use space-joined for word-level operations (handles split-line names)
    ocr_words = ocr_clean_space.split()

    # Word intersection — all or all-but-one expected words found anywhere in text
    intersect = set(expected_words).intersection(set(ocr_words))
    if len(intersect) >= len(expected_words) - 1 and len(expected_words) > 1:
        return expected_name
    if len(expected_words) == 1 and len(intersect) == 1:
        return expected_name

    # Sliding-window fuzzy match (threshold 0.75)
    exp_len = len(expected_words)
    best_ratio = 0
    for i in range(max(1, len(ocr_words) - exp_len + 1)):
        window = " ".join(ocr_words[i:i + exp_len])
        ratio = SequenceMatcher(None, expected_clean, window).ratio()
        if ratio > best_ratio:
            best_ratio = ratio

    if best_ratio > 0.75:
        return expected_name

    return None

# ---------------------------------------------------------------------------
# Name matching — Arabic
# ---------------------------------------------------------------------------

def supervised_arabic_name_extraction(ocr_text_arabic, expected_arabic_name):
    """
    Supervised Arabic name extraction.
    
    CRITICAL: receives RAW Arabic OCR text (logical order).
    fix_arabic_for_display() must NOT be called before this function.
    Normalization is done by clean_arabic_for_match() only.
    """
    if not expected_arabic_name or not ocr_text_arabic:
        return None

    expected_clean = clean_arabic_for_match(expected_arabic_name)
    ocr_clean = clean_arabic_for_match(ocr_text_arabic)

    if not expected_clean or not ocr_clean:
        return None

    if expected_clean in ocr_clean:
        return expected_arabic_name

    expected_words = expected_clean.split()
    if not expected_words:
        return None

    ocr_words = ocr_clean.split()

    intersect = set(expected_words).intersection(set(ocr_words))
    if len(intersect) >= len(expected_words) - 1 and len(expected_words) > 1:
        return expected_arabic_name
    if len(expected_words) == 1 and len(intersect) == 1:
        return expected_arabic_name

    exp_len = len(expected_words)
    best_ratio = 0
    for i in range(max(1, len(ocr_words) - exp_len + 1)):
        window = " ".join(ocr_words[i:i + exp_len])
        ratio = SequenceMatcher(None, expected_clean, window).ratio()
        if ratio > best_ratio:
            best_ratio = ratio

    if best_ratio > 0.70:
        return expected_arabic_name

    # Per-word fuzzy: every expected word has a close partner in OCR output
    matched = 0
    for ew in expected_words:
        for ow in ocr_words:
            if SequenceMatcher(None, ew, ow).ratio() >= 0.70:
                matched += 1
                break
    if matched >= len(expected_words):
        return expected_arabic_name

    return None

# ---------------------------------------------------------------------------
# EasyOCR single-pass helpers
# ---------------------------------------------------------------------------

def cv2_imread_any_path(image_path):
    """
    Robust image read on Windows.

    Why: cv2.imread() frequently returns None for paths that are:
    - very long (deep temp ZIP extraction paths)
    - contain non-ASCII characters
    - contain some characters that OpenCV's path handling can't decode

    Using np.fromfile + cv2.imdecode bypasses OpenCV's path parsing and works
    reliably on Windows with Unicode paths.
    """
    try:
        data = np.fromfile(image_path, dtype=np.uint8)
        if data.size == 0:
            return None
        img = cv2.imdecode(data, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        logging.warning(f"cv2_imread_any_path failed for {image_path}: {e}")
        return None


def run_easyocr_once(image_path):
    """
    Run the unified EasyOCR reader exactly once on an image.
    Returns raw result list [(box, text, conf), ...].

    CRITICAL FIX for Windows: EasyOCR sometimes silently returns [] when given
    a file path string on Windows (temp paths, unicode characters, long paths).
    We load the image with OpenCV into a numpy array first, then pass the array
    directly to EasyOCR — this bypasses all path-related issues completely.
    EasyOCR readtext() accepts numpy BGR arrays natively.
    """
    if not reader_easyocr:
        return []
    try:
        img = cv2_imread_any_path(image_path)
        if img is None:
            logging.warning(f"run_easyocr_once: image read returned None for {image_path}")
            return []
        result = reader_easyocr.readtext(img, detail=1)
        logging.info(f"EasyOCR: {len(result)} raw blocks from {os.path.basename(image_path)}")
        return result
    except Exception as e:
        logging.error(f"EasyOCR error on {image_path}: {e}")
        return []


def split_easy_results(easy_result):
    """
    Split one EasyOCR run into Latin and Arabic block lists.

    Confidence threshold: 0.0 — we accept everything EasyOCR returns and let
    the supervised matching filter false positives. Dropping blocks by confidence
    was the reason Arabic blocks came back as [] on real scanned documents:
    EasyOCR's Arabic confidence scores are often very low (0.05–0.25) even on
    clearly readable text because the model is less certain about Arabic glyphs
    than Latin ones.
    """
    latin, arabic = [], []
    for res in easy_result:
        box, text, conf = res[0], res[1], res[2]
        # Log every block to make diagnosis easy
        script = "AR" if is_arabic_block(text) else ("LA" if is_latin_block(text) else "MX")
        logging.debug(f"  EasyOCR block [{script} conf={conf:.2f}]: '{text}'")
        if is_arabic_block(text):
            arabic.append((box, text))   # store RAW — never apply fix_arabic before matching
        elif is_latin_block(text):
            latin.append((box, text))
    return sort_blocks_reading_order(latin), sort_blocks_reading_order(arabic)

# ---------------------------------------------------------------------------
# Image preprocessing
# ---------------------------------------------------------------------------

def preprocess_image(image_path):
    img = cv2_imread_any_path(image_path)
    if img is None:
        logging.warning(f"preprocess_image: image read returned None for: {image_path}")
        return None
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (3, 3), 0)  # lighter blur — preserves thin Arabic strokes
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(blur)
    # FIX: do NOT auto-invert based on mean pixel value.
    # The mean threshold (< 100) was inverting valid light-background scans
    # that happened to be slightly dark due to scanner settings, destroying
    # both the French and Arabic text for PaddleOCR and EasyOCR.
    # Only invert if the image is genuinely very dark (mean < 60).
    if enhanced.mean() < 60:
        enhanced = cv2.bitwise_not(enhanced)
    temp_fd, temp_path = tempfile.mkstemp(suffix=".png")
    os.close(temp_fd)
    cv2.imwrite(temp_path, enhanced)
    return temp_path

# ---------------------------------------------------------------------------
# Main OCR processing
# ---------------------------------------------------------------------------

def process_image(image_path, expected_name=None, expected_cin=None,
                  expected_cne=None, expected_arabic_name=None, is_bac=False):
    processed_path = None
    try:
        processed_path = preprocess_image(image_path)
        img_to_ocr = processed_path if processed_path else image_path

        # ── Step 1: EasyOCR once — split into Latin and Arabic views ──────────
        easy_result = run_easyocr_once(img_to_ocr)
        easy_latin_blocks, easy_arabic_blocks = split_easy_results(easy_result)

        # If preprocessing produced zero Arabic blocks, retry on the original.
        # Now that run_easyocr_once uses numpy arrays, this is purely about
        # whether CLAHE/blur hurt the Arabic text — not path issues.
        if not easy_arabic_blocks and img_to_ocr != image_path:
            logging.info(f"No Arabic blocks from preprocessed image, retrying on original")
            easy_result_orig = run_easyocr_once(image_path)
            _, easy_arabic_blocks_orig = split_easy_results(easy_result_orig)
            if easy_arabic_blocks_orig:
                easy_arabic_blocks = easy_arabic_blocks_orig
                logging.info(f"  → Found {len(easy_arabic_blocks)} Arabic blocks from original")

        # Log Arabic blocks summary
        ar_raw_texts = [t for _, t in easy_arabic_blocks]
        logging.info(f"[{os.path.basename(image_path)}] Arabic blocks ({len(ar_raw_texts)}): {ar_raw_texts[:6]}")

        # ── Step 2: PaddleOCR for Latin text ──────────────────────────────────
        paddle_blocks = []
        if reader_paddle:
            try:
                result = reader_paddle.ocr(img_to_ocr)
                if result and result[0]:
                    for line in result[0]:
                        paddle_blocks.append((line[0], line[1][0]))
                paddle_blocks = sort_blocks_reading_order(paddle_blocks)
            except Exception as e:
                logging.error(f"PaddleOCR error on {image_path}: {e}")

        # Primary Latin text: PaddleOCR if available, else EasyOCR Latin
        primary_latin_blocks = paddle_blocks if paddle_blocks else easy_latin_blocks
        extracted_text = "\n".join(t for _, t in primary_latin_blocks)

        # Arabic raw text for matching (RAW — no fix_arabic_for_display yet)
        ar_text_raw = " ".join(t for _, t in easy_arabic_blocks)

        final_data = {}

        # ── Baccalaureate ─────────────────────────────────────────────────────
        if is_bac:
            # Latin name
            supervised_latin = supervised_name_extraction(extracted_text, expected_name)
            if not supervised_latin:
                easy_latin_text = "\n".join(t for _, t in easy_latin_blocks)
                supervised_latin = supervised_name_extraction(easy_latin_text, expected_name)

            # Arabic name — match against RAW text, apply display fix only on result
            arabic_name_matched = None
            if expected_arabic_name:
                # Try same-line as Latin name first (position-based)
                same_line_ar_text = ""
                if supervised_latin and expected_name and easy_arabic_blocks:
                    exp_words = clean_string_for_match(expected_name).split()
                    matched_ys = []
                    for box, txt in primary_latin_blocks:
                        if any(w in clean_string_for_match(txt) for w in exp_words):
                            matched_ys.extend([p[1] for p in box])
                    if matched_ys:
                        y_min = min(matched_ys) - 20
                        y_max = max(matched_ys) + 20
                        same_line_ar_blocks = [
                            ar_txt for ar_box, ar_txt in easy_arabic_blocks
                            if y_min <= (sum(p[1] for p in ar_box) / 4) <= y_max
                        ]
                        same_line_ar_text = " ".join(same_line_ar_blocks)

                # Match against RAW text; fix_arabic_for_display applied only on final result
                arabic_name_matched = (
                    supervised_arabic_name_extraction(same_line_ar_text, expected_arabic_name)
                    or supervised_arabic_name_extraction(ar_text_raw, expected_arabic_name)
                )

            # CNE extraction
            cne_num = extract_cne_number(extracted_text)
            if not cne_num and expected_cne:
                clean_full = re.sub(r'[^A-Za-z0-9]', '', extracted_text).upper()
                clean_expected = re.sub(r'[^A-Za-z0-9]', '', expected_cne).upper()
                if clean_expected and clean_expected in clean_full:
                    cne_num = expected_cne
                else:
                    easy_full = re.sub(r'[^A-Za-z0-9]', '', "\n".join(t for _, t in easy_latin_blocks)).upper()
                    if clean_expected and clean_expected in easy_full:
                        cne_num = expected_cne

            # Apply display fix to Arabic name only at output time
            arabic_logical = arabic_name_matched
            arabic_display = fix_arabic_for_display(arabic_logical) if arabic_logical else None

            logging.info(
                f"[BAC] {os.path.basename(image_path)} → latin='{supervised_latin}' arabic_logical='{arabic_logical}' arabic_display='{arabic_display}' cne='{cne_num}'"
            )

            final_data["extracted_name"] = supervised_latin
            final_data["extracted_arabic_name"] = arabic_display
            final_data["extracted_arabic_name_logical"] = arabic_logical
            final_data["extracted_cne"] = cne_num
            return final_data

        # ── CIN / Birth Certificate ───────────────────────────────────────────

        # French name: PaddleOCR first, then EasyOCR Latin fallback
        supervised_name = supervised_name_extraction(extracted_text, expected_name)
        if not supervised_name:
            easy_latin_text = "\n".join(t for _, t in easy_latin_blocks)
            supervised_name = supervised_name_extraction(easy_latin_text, expected_name)
            if supervised_name:
                logging.info(f"French name found via EasyOCR fallback: {image_path}")
                extracted_text += "\n" + easy_latin_text
                primary_latin_blocks = primary_latin_blocks + easy_latin_blocks

        final_data["extracted_name"] = supervised_name

        # Arabic name on CIN — use same-line approach + full fallback
        arabic_name_matched = None
        if expected_arabic_name and easy_arabic_blocks:
            same_line_ar_text = ""
            if supervised_name and expected_name:
                exp_words = clean_string_for_match(expected_name).split()
                matched_ys = []
                for box, txt in primary_latin_blocks:
                    if any(w in clean_string_for_match(txt) for w in exp_words):
                        matched_ys.extend([p[1] for p in box])
                if matched_ys:
                    y_min = min(matched_ys) - 20
                    y_max = max(matched_ys) + 20
                    same_line_ar_blocks = [
                        ar_txt for ar_box, ar_txt in easy_arabic_blocks
                        if y_min <= (sum(p[1] for p in ar_box) / 4) <= y_max
                    ]
                    same_line_ar_text = " ".join(same_line_ar_blocks)

            arabic_name_matched = (
                supervised_arabic_name_extraction(same_line_ar_text, expected_arabic_name)
                or supervised_arabic_name_extraction(ar_text_raw, expected_arabic_name)
            )

            if arabic_name_matched:
                logging.info(f"Arabic name found on CIN: {arabic_name_matched}")
            else:
                logging.info(f"Arabic name not matched | ar_text: '{ar_text_raw[:100]}'")

        # Apply display fix only at output time
        arabic_logical = arabic_name_matched
        arabic_display = fix_arabic_for_display(arabic_logical) if arabic_logical else None
        final_data["extracted_arabic_name"] = arabic_display
        final_data["extracted_arabic_name_logical"] = arabic_logical

        # DOB and CIN number
        dob = extract_birth_date_smart(extracted_text, primary_latin_blocks)
        if dob:
            final_data["dob"] = dob

        cin_num = extract_cin_number(extracted_text, primary_latin_blocks)
        if cin_num:
            final_data["cin"] = cin_num

        logging.info(f"[CIN] {os.path.basename(image_path)} → name='{supervised_name}' arabic='{arabic_name_matched}' dob='{dob}' cin='{cin_num}'")
        return final_data

    except Exception as e:
        logging.error(f"Error processing {image_path}: {e}")
    finally:
        if processed_path and os.path.exists(processed_path):
            try:
                os.remove(processed_path)
            except Exception:
                pass
    return {}

# ---------------------------------------------------------------------------
# Flask Application
# ---------------------------------------------------------------------------
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024
CORS(app, resources={r"/*": {"origins": os.environ.get("ALLOWED_ORIGINS", "*").split(",")}})


@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({"error": "Le fichier est trop volumineux. La taille maximale est de 50 Mo."}), 413


@app.route('/ping', methods=['GET'])
def ping():
    return jsonify({"status": "ok", "message": "OCR Service is running"})


@app.route('/validate', methods=['POST'])
def validate_folder():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    uploaded_file = request.files['file']
    expected_data_str = request.form.get('expected_data')
    expected_data = {}

    if expected_data_str:
        try:
            expected_data = json.loads(expected_data_str)
        except Exception as e:
            logging.warning(f"Error parsing expected_data: {e}")

    temp_dir = tempfile.mkdtemp()
    zip_path = os.path.join(temp_dir, "upload.zip")
    uploaded_file.save(zip_path)

    extract_dir = os.path.join(temp_dir, "extracted")
    os.makedirs(extract_dir, exist_ok=True)

    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            for member in zip_ref.infolist():
                target_path = os.path.normpath(os.path.join(extract_dir, member.filename))
                if not target_path.startswith(os.path.abspath(extract_dir) + os.sep) and \
                        target_path != os.path.abspath(extract_dir):
                    logging.warning(f"Skipping unsafe zip entry: {member.filename}")
                    continue
                zip_ref.extract(member, extract_dir)

        results = []

        for root, dirs, files in os.walk(extract_dir):
            image_paths = []
            # Case-insensitive and broader image support than glob('*.jpg').
            # Users frequently have .JPG/.PNG, or scans in .tif/.tiff/.bmp/.webp.
            allowed_ext = {'.png', '.jpg', '.jpeg', '.tif', '.tiff', '.bmp', '.webp'}
            for fn in files:
                _, ext = os.path.splitext(fn)
                if ext.lower() in allowed_ext:
                    image_paths.append(os.path.join(root, fn))

            if not image_paths:
                continue

            subdir = os.path.relpath(root, extract_dir)
            folder_name = os.path.basename(root)
            cin = folder_name.split('_')[0] if '_' in folder_name else folder_name

            student_expected = expected_data.get(cin, {})
            expected_name = student_expected.get('fullName')
            expected_cin = student_expected.get('cin', cin)
            expected_cne = student_expected.get('student_id')
            expected_arabic_name = student_expected.get('fullNameArabic')

            file_details = []
            extracted_names = []
            extracted_arabic_names = []

            for image_path in image_paths:
                is_bac = "baccalaureate" in os.path.basename(image_path).lower()
                ocr_data = process_image(
                    image_path,
                    expected_name=expected_name,
                    expected_cin=expected_cin,
                    expected_cne=expected_cne,
                    expected_arabic_name=expected_arabic_name,
                    is_bac=is_bac
                )

                formatted_name = ocr_data.get('extracted_name')
                arabic_name = ocr_data.get('extracted_arabic_name')
                arabic_name_logical = ocr_data.get('extracted_arabic_name_logical')

                file_details.append({
                    "file": os.path.basename(image_path),
                    "extracted_name": formatted_name,
                    "extracted_arabic_name": arabic_name,
                    "extracted_arabic_name_logical": arabic_name_logical,
                    "extracted_dob": ocr_data.get('dob'),
                    "extracted_cin": ocr_data.get('cin'),
                    "extracted_cne": ocr_data.get('extracted_cne'),
                    "raw_data": ocr_data
                })

                if not is_bac and formatted_name:
                    extracted_names.append(formatted_name)
                if arabic_name:
                    extracted_arabic_names.append(arabic_name)

            is_correct = True
            is_date_correct = True
            verified_name = None
            verified_arabic_name = None
            verified_dob = None
            errors = []
            french_name_failed = False

            baseline_name = expected_name if expected_name else \
                (extracted_names[0] if extracted_names else "")

            # ── Date validation ───────────────────────────────────────────────
            extracted_dobs = [d["extracted_dob"] for d in file_details if d.get("extracted_dob")]
            if extracted_dobs:
                expected_dob = student_expected.get('dateOfBirth')
                if expected_dob:
                    expected_dob_normalized = normalize_date(expected_dob)
                    is_date_correct = all(dob == expected_dob_normalized for dob in extracted_dobs)
                    verified_dob = expected_dob_normalized if is_date_correct else None
                else:
                    baseline_dob = extracted_dobs[0]
                    is_date_correct = all(dob == baseline_dob for dob in extracted_dobs)
                    verified_dob = baseline_dob if is_date_correct else None

                if not is_date_correct:
                    errors.append({
                        "file": "all",
                        "error": f"Date mismatch: {', '.join(set(extracted_dobs))}"
                    })
                    is_correct = False

            # ── Per-file validation ───────────────────────────────────────────
            for detail in file_details:
                is_bac_detail = "baccalaureate" in detail["file"].lower()

                if is_bac_detail:
                    ext_cne = detail.get("extracted_cne")
                    if not ext_cne:
                        errors.append({"file": detail["file"], "error": "No valid CNE could be extracted"})
                        is_correct = False
                    elif expected_cne and \
                            clean_string_for_match(expected_cne) != clean_string_for_match(ext_cne):
                        errors.append({
                            "file": detail["file"],
                            "error": f"CNE mismatch: expected '{expected_cne}', got '{ext_cne}'"
                        })
                        is_correct = False

                    if expected_arabic_name:
                        ar_name_logical = detail.get("extracted_arabic_name_logical")
                        if not ar_name_logical:
                            errors.append({
                                "file": detail["file"],
                                "error": "Arabic name not found on baccalaureate",
                            })
                            is_correct = False
                        else:
                            exp_ar = clean_arabic_for_match(expected_arabic_name)
                            got_ar = clean_arabic_for_match(ar_name_logical)
                            if exp_ar and got_ar and exp_ar != got_ar:
                                errors.append({
                                    "file": detail["file"],
                                    "error": f"Arabic name mismatch on baccalaureate (expected '{expected_arabic_name}')",
                                })
                                is_correct = False

                else:
                    if not detail.get("extracted_name"):
                        if expected_name:
                            errors.append({
                                "file": detail["file"],
                                "error": f"French name mismatch (expected '{expected_name}')",
                            })
                        else:
                            errors.append({"file": detail["file"], "error": "No valid name could be extracted"})
                        is_correct = False
                        french_name_failed = True
                    elif baseline_name and \
                            detail["extracted_name"].lower() != baseline_name.lower():
                        errors.append({
                            "file": detail["file"],
                            "error": f"Name mismatch: expected '{baseline_name}'"
                        })
                        is_correct = False
                        french_name_failed = True

                    if expected_arabic_name:
                        ar_name_logical = detail.get("extracted_arabic_name_logical")
                        if not ar_name_logical:
                            errors.append({
                                "file": detail["file"],
                                "error": f"Arabic name not found on CIN (expected '{expected_arabic_name}')",
                            })
                            is_correct = False
                        else:
                            exp_ar = clean_arabic_for_match(expected_arabic_name)
                            got_ar = clean_arabic_for_match(ar_name_logical)
                            if exp_ar and got_ar and exp_ar != got_ar:
                                errors.append({
                                    "file": detail["file"],
                                    "error": f"Arabic name mismatch on CIN (expected '{expected_arabic_name}')",
                                })
                                is_correct = False

            if is_correct and baseline_name:
                verified_name = baseline_name

            if extracted_arabic_names:
                verified_arabic_name = extracted_arabic_names[0]

            results.append({
                "cin": cin,
                "folder": subdir,
                "is_correct": is_correct,
                "is_date_correct": is_date_correct,
                "verified_name": verified_name,
                "verified_arabic_name": verified_arabic_name,
                "verified_dob": verified_dob,
                "errors": errors,
                "file_details": file_details
            })

        return jsonify(results)

    except Exception as e:
        logging.error(f"validate_folder error: {e}")
        return jsonify({"error": str(e)}), 500

    finally:
        try:
            shutil.rmtree(temp_dir)
        except Exception as e:
            logging.warning(f"Failed to clean up temp dir {temp_dir}: {e}")


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, threaded=True)
    