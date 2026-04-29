import os
from glob import glob
import cv2
import numpy as np
import easyocr
try:
    from paddleocr import PaddleOCR
except ImportError:
    print("PaddleOCR not installed, skipping.")
    PaddleOCR = None

from flask import Flask, request, jsonify
from flask_cors import CORS
import zipfile
import tempfile
import re
import json
import shutil
from dateutil import parser as dateutil_parser
from difflib import SequenceMatcher

# Load OCR models
try:
    # Separate readers because Arabic is only compatible with English in EasyOCR
    reader_easyocr = easyocr.Reader(['fr', 'en'], gpu=False)
    reader_easyocr_ar = easyocr.Reader(['ar', 'en'], gpu=False)
except Exception as e:
    print(f"Error loading EasyOCR: {e}")
    reader_easyocr = None
    reader_easyocr_ar = None

try:
    if PaddleOCR:
        reader_paddle = PaddleOCR(use_angle_cls=True, lang='fr')
        # New Arabic reader for baccalaureate documents
        reader_paddle_ar = PaddleOCR(use_angle_cls=True, lang='arabic')
    else:
        reader_paddle = None
        reader_paddle_ar = None
except Exception as e:
    print(f"Error loading PaddleOCR: {e}")
    reader_paddle = None
    reader_paddle_ar = None


# Birth date regexes
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


def sort_blocks_reading_order(ocr_blocks):
    """Top-to-bottom, left-to-right order."""
    def sort_key(item):
        box, _ = item
        if not box or len(box) < 4:
            return (0, 0)
        ys = [float(p[1]) for p in box]
        xs = [float(p[0]) for p in box]
        return (sum(ys) / len(ys), min(xs))
    return sorted(ocr_blocks or [], key=sort_key)


def normalize_date(date_str):
    if not date_str: return None
    # Ensure it's a string and remove whitespace
    s = str(date_str).strip()
    # Replace all common separators with /
    clean = re.sub(r'[\.\-\/:\s]', '/', s)
    # Remove any non-numeric chars except /
    clean = re.sub(r'[^0-9/]', '', clean)
    parts = [p for p in clean.split('/') if p]
    
    if len(parts) >= 3:
        # Case YYYY/MM/DD...
        if len(parts[0]) == 4:
            y, m, d = parts[0], parts[1], parts[2]
            return f"{d.zfill(2)}/{m.zfill(2)}/{y}"
        # Case DD/MM/YYYY...
        elif len(parts[2]) == 4:
            d, m, y = parts[0], parts[1], parts[2]
            return f"{d.zfill(2)}/{m.zfill(2)}/{y}"
        # Case DD/MM/YY...
        elif len(parts[2]) == 2:
            d, m, y = parts[0], parts[1], parts[2]
            y = "20" + y if int(y) <= 69 else "19" + y
            return f"{d.zfill(2)}/{m.zfill(2)}/{y}"
            
    # Fallback: if it's already DD/MM/YYYY but maybe with different separators
    m = re.search(r'(\d{1,2})[\./\-](\d{1,2})[\./\-](\d{2,4})', s)
    if m:
        d, m, y = m.group(1), m.group(2), m.group(3)
        if len(y) == 2: y = "20" + y if int(y) <= 69 else "19" + y
        return f"{d.zfill(2)}/{m.zfill(2)}/{y}"

    return s


def parse_date_to_ddmmyyyy(date_fragment):
    if not date_fragment: return None
    clean = re.sub(r"[^0-9\.\-\/\s]", "", date_fragment).strip()
    clean = re.sub(r"[\.\-\/\s]+", "/", clean)
    parts = [p for p in clean.split("/") if p]
    
    if len(parts) == 3:
        # Check if first part is year
        if len(parts[0]) == 4:
            y, m, d = parts[0], parts[1], parts[2]
        else:
            d, m, y = parts[0], parts[1], parts[2]
            
        if len(y) == 2: 
            y = "20" + y if int(y) <= 69 else "19" + y
            
        try:
            day_i, month_i, year_i = int(d), int(m), int(y)
            # Basic validation
            if 1 <= day_i <= 31 and 1 <= month_i <= 12 and 1900 <= year_i <= 2100:
                return f"{day_i:02d}/{month_i:02d}/{year_i}"
        except ValueError: 
            pass
            
    try:
        dt = dateutil_parser.parse(date_fragment, dayfirst=True, fuzzy=True)
        return f"{dt.day:02d}/{dt.month:02d}/{dt.year}"
    except Exception:
        return None

def extract_dob_from_mrz(full_text):
    if not full_text: return None
    compact = re.sub(r"\s+", "", full_text)
    m = MRZ_LINE2_DOB_RE.search(compact)
    if not m: return None
    yy, mm, dd = m.group(1), m.group(2), m.group(3)
    try:
        year = 2000 + int(yy) if int(yy) <= 69 else 1900 + int(yy)
        month_i, day_i = int(mm), int(dd)
        if 1 <= month_i <= 12 and 1 <= day_i <= 31:
            return normalize_date(f"{day_i:02d}/{month_i:02d}/{year}")
    except ValueError: pass
    return None

def extract_birth_date_smart(full_text, ocr_blocks):
    if not full_text: return None
    lines = [ln.strip() for ln in full_text.split("\n") if ln.strip()]

    # 1) Same line
    for line in lines:
        if BIRTH_LABEL_RE.search(line):
            for m in DATE_IN_TEXT_RE.finditer(line):
                parsed = parse_date_to_ddmmyyyy(m.group(1))
                if parsed: return normalize_date(parsed)

    # 2) Next line
    for i, line in enumerate(lines):
        if BIRTH_LABEL_RE.search(line) and not DATE_IN_TEXT_RE.search(line):
            for j in range(i + 1, min(i + 3, len(lines))):
                nxt = lines[j]
                if DATE_INVALID_CONTEXT_RE.search(nxt) and not BIRTH_LABEL_RE.search(nxt): continue
                for m in DATE_IN_TEXT_RE.finditer(nxt):
                    parsed = parse_date_to_ddmmyyyy(m.group(1))
                    if parsed: return normalize_date(parsed)

    # 3) Block merge
    ordered = sort_blocks_reading_order(ocr_blocks)
    for i, (_, txt) in enumerate(ordered):
        if BIRTH_LABEL_RE.search(txt):
            chunk = txt
            for j in range(i + 1, min(i + 3, len(ordered))):
                chunk = chunk + " " + ordered[j][1]
            if DATE_INVALID_CONTEXT_RE.search(chunk) and not BIRTH_LABEL_RE.search(chunk): continue
            for m in DATE_IN_TEXT_RE.finditer(chunk):
                parsed = parse_date_to_ddmmyyyy(m.group(1))
                if parsed: return normalize_date(parsed)

    # 4) Regex fallback
    m = re.search(
        r"(?i)(?:n[ée]e?\s*\(?e?\)?\s*l[ée]|date\s*de\s*naissance)\s*[:\s]*(\d{1,2}[\.\-\/\s]\d{1,2}[\.\-\/\s]\d{2,4})",
        full_text
    )
    if m:
        parsed = parse_date_to_ddmmyyyy(m.group(1))
        if parsed: return normalize_date(parsed)

    return extract_dob_from_mrz(full_text)


def extract_cin_number(full_text, ocr_blocks):
    if not full_text: return None
    patterns = [
        r"(?i)n[°ºo]?\s*[.:]?\s*([A-Z]{1,2}\d{5,8})\b",
        r"(?i)\b([A-Z]{1,2}\d{5,8})\b",
        r"(?i)cin\s*[:\s]*([A-Z]{1,2}\d{5,8})\b",
    ]
    for pat in patterns:
        m = re.search(pat, full_text)
        if m: return m.group(1).upper()
    return None

def extract_cne_number(full_text):
    if not full_text: return None
    
    # Arabic digits normalization (convert to western digits)
    arabic_digits = "٠١٢٣٤٥٦٧٨٩"
    western_digits = "0123456789"
    trans = str.maketrans(arabic_digits, western_digits)
    text_normalized = full_text.translate(trans)
    
    # Try with spaces/separators first
    m = re.search(r'\b([A-Z]\s*\d{8,10})\b', text_normalized, re.IGNORECASE)
    if m: return re.sub(r'\s+', '', m.group(1)).upper()
    
    # Try compact
    clean_text = re.sub(r'[^A-Za-z0-9]', '', text_normalized).upper()
    m = re.search(r'([A-Z]\d{8,10})', clean_text)
    if m: return m.group(1)
    
    # Fallback for old numeric CNEs (usually 8-10 digits)
    m = re.search(r'\b(\d{8,10})\b', text_normalized)
    if m: return m.group(1)
    
    return None

import unicodedata

def clean_string_for_match(s):
    """Normalize a string to lowercase alphanumerics and spaces for fuzzy matching."""
    if not s:
        return ""
    
    # 1. Latin Character Normalization
    # Normalize accents
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode('ascii') if any(ord(c) < 128 for c in s) else s
    
    # Replace non-alphanumeric (except spaces) with space
    s = re.sub(r"[^a-zA-Z0-9\s]", " ", s)
    
    # Remove extra spaces
    s = re.sub(r"\s+", " ", s).strip().lower()
    return s

def supervised_name_extraction(ocr_text, expected_name, is_bac=False):
    """
    Supervision: We know the expected name from the database.
    We just need to check if it occurs in the OCR output, allowing for slight OCR errors.
    """
    if not expected_name or not ocr_text:
        return None
        
    expected_clean = clean_string_for_match(expected_name)
    ocr_clean = clean_string_for_match(ocr_text)
    
    # 1. Direct substring match
    if expected_clean in ocr_clean:
        return expected_name
        
    expected_words = expected_clean.split()
    if not expected_words:
        return None
        
    ocr_words = ocr_clean.split()
    
    # 2. Check word by word intersection
    intersect = set(expected_words).intersection(set(ocr_words))
    # If all or most words found anywhere
    if len(intersect) >= len(expected_words) - 1 and len(expected_words) > 1:
        return expected_name
        
    if len(expected_words) == 1 and len(intersect) == 1:
        return expected_name

    # 3. Check via fuzzy SequenceMatcher sliding window
    # Lower threshold for baccalaureate since they are often low-quality scans
    threshold = 0.7 if is_bac else 0.8
    
    exp_len = len(expected_words)
    best_ratio = 0
    # Sliding window of the same word count
    for i in range(len(ocr_words) - exp_len + 1):
        window = " ".join(ocr_words[i:i+exp_len])
        ratio = SequenceMatcher(None, expected_clean, window).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            
    if best_ratio >= threshold:
        return expected_name
        
    # 4. Special case: Try reversed order of words
    # This handles "LAST First" vs "First LAST"
    if len(expected_words) >= 2:
        reversed_expected = " ".join(reversed(expected_words))
        if reversed_expected in ocr_clean:
            return expected_name
            
        for i in range(len(ocr_words) - exp_len + 1):
            window = " ".join(ocr_words[i:i+exp_len])
            ratio = SequenceMatcher(None, reversed_expected, window).ratio()
            if ratio >= threshold:
                return expected_name

    # 5. Last resort: Compact match (no spaces)
    # Useful for very noisy OCR where spaces are inserted randomly
    expected_compact = "".join(expected_words)
    ocr_compact = "".join(ocr_words)
    if expected_compact in ocr_compact:
        return expected_name
        
    # Fuzzy compact match
    if len(ocr_compact) >= len(expected_compact):
        # We can't easily slide a window on characters for performance if text is huge,
        # but for small fragments it's okay. Let's just do a simple ratio if expected is long enough.
        if len(expected_compact) > 5:
            # Check if expected_compact is "almost" in ocr_compact
            # (This is a bit slow but we only do it if everything else fails)
            for i in range(len(ocr_compact) - len(expected_compact) + 1):
                window = ocr_compact[i:i+len(expected_compact)]
                if SequenceMatcher(None, expected_compact, window).ratio() > 0.85:
                    return expected_name

    return None


def preprocess_image(image_path, is_bac=False):
    img = cv2.imread(image_path)
    if img is None: return None
    
    # Bac documents sometimes benefit from different preprocessing
    if is_bac:
        # Resize if too small
        height, width = img.shape[:2]
        if width < 1500:
            scale = 1500 / width
            img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
            
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Try to denoise without too much blur
    denoised = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
    
    # CLAHE for better contrast
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(denoised)
    
    temp_fd, temp_path = tempfile.mkstemp(suffix=".png")
    os.close(temp_fd)
    cv2.imwrite(temp_path, enhanced)
    return temp_path


def extract_arabic_name(ocr_text, ocr_blocks=None, expected_name=None):
    """
    Extract a likely Arabic full name from OCR text.
    This is used only for baccalaureate documents.
    """
    if not ocr_text:
        return None

    # Common OCR misreadings of "المترشح" / "المترشحة"
    label_patterns = [
        r"المتر[شحخمج][ة]?", 
        r"[اأ]?ن\s*المتر[شحخمج][ة]?",
        r"[اأ]?ن\s*[اأ]ل\s*م\s*ت\s*ر\s*[شحخمج]\s*[ة]?",
        r"المترثم",
        r"انالمترثم",
        r"ان\s*المترشم"
    ]
    label_regex = re.compile("|".join(label_patterns))

    # 1. Targeted Strategy: Look for name after label or nearby
    if ocr_blocks:
        # Strategy A: Near the "Candidate" label
        for i, (box, text) in enumerate(ocr_blocks):
            if label_regex.search(text):
                # Check same block after the label
                # Find the matched label in text
                match = label_regex.search(text)
                after_label = text[match.end():].strip()
                # Clean non-Arabic
                after_label = re.sub(r"[^\u0600-\u06FF\s]", " ", after_label).strip()
                if len(after_label.split()) >= 2:
                    return after_label
                
                # Check next 3 blocks (sometimes the label is separate)
                for j in range(i + 1, min(i + 4, len(ocr_blocks))):
                    next_text = ocr_blocks[j][1]
                    cleaned_next = re.sub(r"[^\u0600-\u06FF\s]", " ", next_text).strip()
                    words = cleaned_next.split()
                    if len(words) >= 2 and len(words) <= 5:
                        # Ensure not another administrative label
                        stop_words_small = {"وزارة", "الأكاديمية", "الجهة", "نيابة", "مركز", "دورة", "المملكة", "المغربية"}
                        if not any(sw in cleaned_next for sw in stop_words_small):
                            return cleaned_next

        # Strategy B: On the same line as the French name (if provided)
        if expected_name:
            expected_clean = clean_string_for_match(expected_name)
            french_block_idx = -1
            french_box = None
            
            # Find the block containing the French name
            for i, (box, text) in enumerate(ocr_blocks):
                if expected_clean in clean_string_for_match(text):
                    french_block_idx = i
                    french_box = box
                    break
            
            if french_box:
                # french_box format: [[x1,y1], [x2,y1], [x2,y2], [x1,y2]]
                y_mid = (french_box[0][1] + french_box[2][1]) / 2
                height = abs(french_box[2][1] - french_box[0][1])
                
                # Look for Arabic blocks that are at a similar Y level
                line_candidates = []
                for i, (box, text) in enumerate(ocr_blocks):
                    if i == french_block_idx: continue
                    
                    this_y_mid = (box[0][1] + box[2][1]) / 2
                    # If within 70% of the height of the french block vertically
                    if abs(this_y_mid - y_mid) < height * 0.7:
                        # Extract Arabic only
                        arabic_only = re.sub(r"[^\u0600-\u06FF\s]", " ", text).strip()
                        words = arabic_only.split()
                        if len(words) >= 2 and len(words) <= 5:
                            line_candidates.append(arabic_only)
                
                if line_candidates:
                    # Return the longest or most likely name candidate on the same line
                    return max(line_candidates, key=len)

    # 2. Fallback: Existing heuristic-based extraction
    normalized = re.sub(r"[^\u0600-\u06FF\s]", " ", ocr_text)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    if not normalized:
        return None

    # Typical non-name Arabic labels seen on bac documents and administrative headers.
    stop_words = [
        "الاسم", "الشخصي", "العائلي", "الكامل", "رقم", "البطاقة",
        "الوطنية", "ازدياد", "تاريخ", "الميلاد", "السنة", "الدراسية",
        "شهادة", "البكالوريا", "المترشح", "المترشحة", "الامتحان",
        "وزارة", "التربية", "والتكوين", "للتربية", "والرياضة", "والتعليم", "الوطنية", "الدراسية",
        "الأكاديمية", "الأولي", "الجهوية", "للتكوين", "المهني", "المملكة", "المغربية", "بأن", "يشهد",
        "تكوين", "أكاديمية", "نيابة", "عمالة", "إقليم", "مركز", "دورة", "مسلك",
        "ميزة", "معدل", "عام", "خاص", "تقني", "متخصص", "عالي", "جامعة", "كلية",
        "معهد", "مدرسة", "الرباط", "سلا", "القنيطرة", "الدار", "البيضاء", "فاس",
        "مكناس", "مراكش", "آسفي", "طنجة", "تطوان", "الحسيمة", "وجدة", "أكادير",
        "بني", "ملال", "خنيفرة", "درعة", "تافيلالت", "سوس", "ماسة", "كلميم",
        "واد", "نون", "العيون", "الساقية", "الحمراء", "الداخلة", "الذهب",
        "مدير", "رئيس", "توقيع", "خاتم", "حرر", "بتاريخ", "قرارلجنة", "المداولات", "المتعلقة", "للتعريف", "بمؤسسة"
    ]

    # Candidate chunks with 2..5 Arabic words (typical full name length).
    candidates = []
    for chunk in re.findall(r"[\u0600-\u06FF]+(?:\s+[\u0600-\u06FF]+){1,4}", normalized):
        words = chunk.split()
        
        # Robust check: if any word in the chunk contains or is a stop word
        is_stop = False
        for w in words:
            for sw in stop_words:
                if sw in w: # Substring match for robustness
                    is_stop = True
                    break
            if is_stop: break
            
        if is_stop:
            continue
            
        # Ignore tiny words-only chunks unlikely to be a name.
        if len("".join(words)) < 5:
            continue
        candidates.append(" ".join(words))

    print(f"DEBUG: Found {len(candidates)} Arabic name candidates: {candidates}")

    if not candidates:
        return None

    # Prefer 2-word names first (common in your example), then 3 words, then longest.
    candidates.sort(key=lambda c: (abs(len(c.split()) - 2), -len(c)))
    return candidates[0]


def process_image(image_path, expected_name=None, expected_cin=None, expected_cne=None, is_bac=False):
    processed_path = None
    try:
        processed_path = preprocess_image(image_path, is_bac)
        img_to_ocr = processed_path if processed_path else image_path
        
        ocr_blocks = []
        
        # Try OCR on normal image
        def run_ocr(img_path, is_bac=False):
            blocks = []
            
            # 1. Run French/Latin OCR (Paddle)
            if reader_paddle:
                try:
                    result = reader_paddle.ocr(img_path)
                    if result and result[0]:
                        for line in result[0]:
                            blocks.append((line[0], line[1][0]))
                except Exception as e:
                    print(f"PaddleOCR (FR) error: {e}")
            
            # 2. Run Arabic OCR (Paddle) ONLY if it's a baccalaureate
            if is_bac:
                if reader_paddle_ar:
                    try:
                        result = reader_paddle_ar.ocr(img_path)
                        if result and result[0]:
                            for line in result[0]:
                                blocks.append((line[0], line[1][0]))
                    except Exception as e:
                        print(f"PaddleOCR (AR) error: {e}")
                elif reader_easyocr_ar:
                    # Fallback for Arabic if Paddle is missing
                    try:
                        result = reader_easyocr_ar.readtext(img_path, detail=1)
                        for res in result: 
                            # Avoid duplicates
                            if not any(b[1] == res[1] for b in blocks):
                                blocks.append((res[0], res[1]))
                    except Exception as e:
                        print(f"EasyOCR (AR fallback) error: {e}")
                    
            # 3. Fallback to EasyOCR if no blocks found yet
            if not blocks and reader_easyocr:
                try:
                    result = reader_easyocr.readtext(img_path, detail=1)
                    for res in result: blocks.append((res[0], res[1]))
                except Exception as e:
                    print(f"EasyOCR error: {e}")
            return blocks

        # 1. Main Extraction
        ocr_blocks = run_ocr(img_to_ocr, is_bac)
        if not ocr_blocks and processed_path:
            ocr_blocks = run_ocr(image_path, is_bac)
            
        ocr_blocks = sort_blocks_reading_order(ocr_blocks)
        extracted_text = "\n".join(t for _, t in ocr_blocks)
        
        # Supervised Name Extraction (Latin)
        extracted_name = supervised_name_extraction(extracted_text, expected_name, is_bac)
        is_name_match = extracted_name is not None
        
        # Arabic Name Extraction (Targeted + Heuristic)
        extracted_arabic_name = None
        if is_bac:
            extracted_arabic_name = extract_arabic_name(extracted_text, ocr_blocks, expected_name)
        
        # DOB Extraction
        extracted_dob = extract_birth_date_smart(extracted_text, ocr_blocks)
        
        # ID Extraction
        extracted_cin = extract_cin_number(extracted_text, ocr_blocks)
        extracted_cne = extract_cne_number(extracted_text)
        
        return {
            "file": os.path.basename(image_path),
            "extracted_name": extracted_name or "Non détecté",
            "extracted_arabic_name": extracted_arabic_name or "Non détecté",
            "is_name_match": is_name_match,
            "extracted_dob": extracted_dob or "Non détecté",
            "extracted_cin": extracted_cin,
            "extracted_cne": extracted_cne,
            "raw_text": extracted_text
        }
    except Exception as e:
        print(f"Error processing {image_path}: {e}")
        return {"file": os.path.basename(image_path), "error": str(e)}
    finally:
        if processed_path and os.path.exists(processed_path):
            os.remove(processed_path)


# Flask Application
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

@app.route('/ping', methods=['GET'])
def ping():
    return jsonify({"status": "ok", "message": "OCR Service is running"})

@app.route('/validate', methods=['POST'])
def validate_folder():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"})

    uploaded_file = request.files['file']
    expected_data_str = request.form.get('expected_data')
    expected_data = {}
    
    if expected_data_str:
        try:
            expected_data = json.loads(expected_data_str)
        except Exception as e:
            print("Error parsing expected_data input:", e)

    temp_dir = tempfile.mkdtemp()
    zip_path = os.path.join(temp_dir, uploaded_file.filename)
    uploaded_file.save(zip_path)

    extract_dir = os.path.join(temp_dir, "extracted")
    os.makedirs(extract_dir, exist_ok=True)

    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            for member in zip_ref.infolist():
                target_path = os.path.normpath(os.path.join(extract_dir, member.filename))
                if not target_path.startswith(os.path.abspath(extract_dir) + os.sep) and target_path != os.path.abspath(extract_dir):
                    continue
                zip_ref.extract(member, extract_dir)

        results = []
        walk_data = list(os.walk(extract_dir))
        
        for root, dirs, files in walk_data:
            image_paths = []
            for ext in ['*.png', '*.jpg', '*.jpeg']:
                image_paths.extend(glob(os.path.join(root, ext)))

            if not image_paths:
                continue

            subdir = os.path.relpath(root, extract_dir)
            folder_name = os.path.basename(root)
            cin = folder_name.split('_')[0] if '_' in folder_name else folder_name
            
            student_expected = expected_data.get(cin, {})
            expected_name = student_expected.get('fullName')
            expected_cin = student_expected.get('cin', cin)
            expected_cne = student_expected.get('cne')

            file_details = []

            for image_path in image_paths:
                is_bac = "baccalaureate" in os.path.basename(image_path).lower()
                ocr_data = process_image(image_path, expected_name, expected_cin, expected_cne, is_bac)
                
                file_details.append({
                    "file": os.path.basename(image_path),
                    "extracted_name": ocr_data.get('extracted_name'),
                    "extracted_dob": ocr_data.get('extracted_dob'),
                    "extracted_cin": ocr_data.get('extracted_cin'),
                    "extracted_cne": ocr_data.get('extracted_cne'),
                    "extracted_arabic_name": ocr_data.get('extracted_arabic_name'),
                    "raw_data": ocr_data
                })

            is_name_correct = True
            is_date_correct = True
            verified_name = None
            verified_dob = None
            errors = []

            # 1. Name Verification
            if expected_name:
                has_any_name_match = any(d.get("extracted_name") == expected_name for d in file_details)
                if not has_any_name_match:
                    is_name_correct = False
                    for detail in file_details:
                        if not detail.get("extracted_name") or detail.get("extracted_name") == "Non détecté":
                             errors.append({"file": detail["file"], "error": f"Nom '{expected_name}' non trouvé"})
                else:
                    verified_name = expected_name
            else:
                found_names = [d["extracted_name"] for d in file_details if d["extracted_name"] and d["extracted_name"] != "Non détecté"]
                if not found_names:
                    is_name_correct = False
                    errors.append({"file": "all", "error": "Aucun nom extrait"})
                else:
                    baseline_name = found_names[0]
                    is_name_correct = all(n == baseline_name for n in found_names)
                    if is_name_correct:
                        verified_name = baseline_name
                    else:
                        errors.append({"file": "all", "error": "Noms discordants entre documents"})

            # 2. Date Verification
            extracted_dobs = [d["extracted_dob"] for d in file_details if d["extracted_dob"] and d["extracted_dob"] != "Non détecté"]
            if extracted_dobs:
                expected_dob = student_expected.get('dateOfBirth')
                if expected_dob:
                    expected_dob_normalized = normalize_date(expected_dob)
                    is_date_correct = all(dob == expected_dob_normalized for dob in extracted_dobs)
                    if not is_date_correct:
                        mismatched_dobs = [dob for dob in extracted_dobs if dob != expected_dob_normalized]
                        errors.append({
                            "file": "all",
                            "error": f"Date discordante. Attendu: {expected_dob_normalized}"
                        })
                    else:
                        verified_dob = expected_dob_normalized
                else:
                    baseline_dob = extracted_dobs[0]
                    is_date_correct = all(dob == baseline_dob for dob in extracted_dobs)
                    if not is_date_correct:
                        errors.append({"file": "all", "error": "Dates discordantes entre documents"})
                    else:
                        verified_dob = baseline_dob

            is_correct = is_name_correct and is_date_correct

            results.append({
                "cin": cin,
                "folder": subdir,
                "is_correct": is_correct,
                "is_date_correct": is_date_correct,
                "verified_name": verified_name,
                "verified_dob": verified_dob,
                "errors": errors,
                "file_details": file_details
            })

        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)})
    finally:
        shutil.rmtree(temp_dir)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5003)
