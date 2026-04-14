import os
import re

app_py_content = r'''import os
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

# Load OCR models (removed spaCy for performance and cleanups)
try:
    reader_easyocr = easyocr.Reader(['fr', 'en'], gpu=False)
except Exception as e:
    print(f"Error loading EasyOCR: {e}")
    reader_easyocr = None

try:
    reader_paddle = PaddleOCR(use_angle_cls=True, lang='fr')
except Exception as e:
    print(f"Error loading PaddleOCR: {e}")
    reader_paddle = None


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
    clean_date = re.sub(r'[^0-9\.\-\/:]', '', date_str)
    clean_date = re.sub(r'[\.\-\/:]', '/', clean_date)
    parts = clean_date.split('/')
    if len(parts) == 3:
        return f"{parts[0].zfill(2)}/{parts[1].zfill(2)}/{parts[2]}"
    return clean_date


def parse_date_to_ddmmyyyy(date_fragment):
    if not date_fragment: return None
    clean = re.sub(r"[^0-9\.\-\/\s]", "", date_fragment).strip()
    clean = re.sub(r"[\.\-\/\s]+", "/", clean)
    parts = [p for p in clean.split("/") if p]
    if len(parts) == 3:
        d, m, y = parts[0], parts[1], parts[2]
        if len(y) == 2: y = "20" + y if int(y) <= 69 else "19" + y
        try:
            day_i, month_i, year_i = int(d), int(m), int(y)
            if 1 <= day_i <= 31 and 1 <= month_i <= 12 and 1900 <= year_i <= 2100:
                return f"{day_i:02d}/{month_i:02d}/{year_i}"
        except ValueError: pass
    try:
        dt = dateutil_parser.parse(date_fragment, dayfirst=True, fuzzy=False)
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

def clean_string_for_match(s):
    """Normalize a string to lowercase alphanumerics and spaces for fuzzy matching."""
    if not s:
        return ""
    # Replace non-alphanumeric (except spaces) with space
    s = re.sub(r"[^a-zA-Z0-9\s]", " ", s)
    # Remove extra spaces
    s = re.sub(r"\s+", " ", s).strip().lower()
    return s

def supervised_name_extraction(ocr_text, expected_name):
    """
    Supervision: We know the expected name from the database.
    We just need to check if it occurs in the OCR output, allowing for slight OCR errors.
    If it closely matches any segment of the OCR text, we return the expected name, 
    effectively correcting the OCR.
    """
    if not expected_name or not ocr_text:
        return None
        
    expected_clean = clean_string_for_match(expected_name)
    ocr_clean = clean_string_for_match(ocr_text)
    
    if expected_clean in ocr_clean:
        return expected_name
        
    expected_words = expected_clean.split()
    if not expected_words:
        return None
        
    ocr_words = ocr_clean.split()
    
    # Check word by word intersection
    intersect = set(expected_words).intersection(set(ocr_words))
    # If all or most words found anywhere
    if len(intersect) >= len(expected_words) - 1 and len(expected_words) > 1:
        return expected_name
        
    if len(expected_words) == 1 and len(intersect) == 1:
        return expected_name

    # Check via fuzzy SequenceMatcher sliding window (approximating 85% match tolerance)
    exp_len = len(expected_words)
    best_ratio = 0
    for i in range(len(ocr_words) - exp_len + 1):
        window = " ".join(ocr_words[i:i+exp_len])
        ratio = SequenceMatcher(None, expected_clean, window).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            
    if best_ratio > 0.8:
        return expected_name
        
    return None


def preprocess_image(image_path):
    img = cv2.imread(image_path)
    if img is None: return None
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(blur)
    temp_fd, temp_path = tempfile.mkstemp(suffix=".png")
    os.close(temp_fd)
    cv2.imwrite(temp_path, enhanced)
    return temp_path


def process_image(image_path, expected_name=None, expected_cin=None):
    processed_path = None
    try:
        processed_path = preprocess_image(image_path)
        img_to_ocr = processed_path if processed_path else image_path
        
        extracted_text = ""
        ocr_blocks = []
        
        if reader_paddle:
            try:
                result = reader_paddle.ocr(img_to_ocr)
                if result and result[0]:
                    for line in result[0]:
                        ocr_blocks.append((line[0], line[1][0]))
            except Exception as e:
                print(f"PaddleOCR error: {e}")
                
        if not ocr_blocks and reader_easyocr:
            try:
                result = reader_easyocr.readtext(img_to_ocr, detail=1)
                for res in result: ocr_blocks.append((res[0], res[1]))
            except Exception as e:
                print(f"EasyOCR error: {e}")

        ocr_blocks = sort_blocks_reading_order(ocr_blocks)
        extracted_text = "\n".join(t for _, t in ocr_blocks)

        final_data = {}
        
        # Supervised Name Extraction
        supervised_name = supervised_name_extraction(extracted_text, expected_name)
        if supervised_name:
            final_data["extracted_name"] = supervised_name
        else:
            # Fallback if no expected name provided or completely missing (useful for mismatch reporting)
            final_data["extracted_name"] = None 
            
        # DOB and CIN Extraction
        dob = extract_birth_date_smart(extracted_text, ocr_blocks)
        if dob:
            final_data["dob"] = dob
            
        cin_num = extract_cin_number(extracted_text, ocr_blocks)
        if cin_num:
            final_data["cin"] = cin_num

        return final_data

    except Exception as e:
        print(f"Error processing {image_path}: {e}")
    finally:
        if processed_path and os.path.exists(processed_path):
            try: os.remove(processed_path)
            except: pass
    return {}


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

            file_details = []
            extracted_names = []

            for image_path in image_paths:
                ocr_data = process_image(image_path, expected_name, expected_cin)
                
                # If we supervised successfully, name will be expected_name
                formatted_name = ocr_data.get('extracted_name')
                
                file_details.append({
                    "file": os.path.basename(image_path),
                    "extracted_name": formatted_name,
                    "extracted_dob": ocr_data.get('dob'),
                    "extracted_cin": ocr_data.get('cin'),
                    "raw_data": ocr_data
                })

                if formatted_name:
                    extracted_names.append(formatted_name)

            is_correct = False
            is_date_correct = False
            verified_name = None
            verified_dob = None
            errors = []

            if extracted_names:
                baseline_name = expected_name if expected_name else extracted_names[0]
                # In supervised, if formatted_name matches expected_name, it's correct
                is_correct = all(name.lower() == baseline_name.lower() for name in extracted_names if name)
                verified_name = baseline_name if is_correct else None

                extracted_dobs = [d["extracted_dob"] for d in file_details if d["extracted_dob"]]
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
                            "error": f"Date mismatch among documents: {', '.join(set(extracted_dobs))}"
                        })

                for detail in file_details:
                    if not detail["extracted_name"]:
                        errors.append({
                            "file": detail["file"],
                            "error": "No valid name corresponding to the database record could be extracted"
                        })
                    elif not is_correct and detail["extracted_name"].lower() != baseline_name.lower():
                        errors.append({
                            "file": detail["file"],
                            "error": f"Name mismatch: found '{detail['extracted_name']}' vs expected '{baseline_name}'"
                        })

            results.append({
                "cin": cin,
                "folder": subdir,
                "is_correct": is_correct and is_date_correct,
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
    app.run(host='0.0.0.0', port=5001)
'''

with open(r'e:\ofpptVerify\app.py', 'w', encoding='utf8') as f:
    f.write(app_py_content)
print("app.py successfully overwritten and cleaned up!")
