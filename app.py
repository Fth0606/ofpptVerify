import os
import logging
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
import unicodedata

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

from difflib import SequenceMatcher

# ---------------------------------------------------------------------------
# Arabic Support
# ---------------------------------------------------------------------------
# We no longer use arabic_reshaper or bidi because modern browsers (React with dir="rtl")
# handle logical Arabic text perfectly. Bidi-ing it on the backend reverses it twice.

# ---------------------------------------------------------------------------
# OCR Models Initialization (Clean & Fast)
# ---------------------------------------------------------------------------
# We use EasyOCR for everything to ensure maximum reliability for Moroccan documents.
reader_easyocr = easyocr.Reader(['ar', 'en'], gpu=False)

# ---------------------------------------------------------------------------
# Normalization Helpers
# ---------------------------------------------------------------------------
def clean_latin(s):
    if not s: return ""
    s = unicodedata.normalize('NFKD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r"[^a-zA-Z0-9\s]", " ", s).strip().lower()

def clean_arabic(s):
    if not s: return ""
    s = re.sub(r'[\u064B-\u065F\u0670]', '', s)
    s = re.sub(r'[\u0622\u0623\u0625\u0671]', '\u0627', s)
    s = re.sub(r'\u0629', '\u0647', s)
    s = re.sub(r'\u0649', '\u064A', s)
    s = re.sub(r'[^\u0600-\u06FF\s]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()

def fix_arabic_for_display(text):
    # Just return the logical text. The browser will render it correctly.
    return text

def fuzzy_match(expected, actual_text, threshold=0.75):
    if not expected or not actual_text: return False
    if expected in actual_text: return True
    
    words = expected.split()
    actual_words = actual_text.split()
    if not words or not actual_words: return False
    
    matched = 0
    for w in words:
        if w in actual_text:
            matched += 1
            continue
        for aw in actual_words:
            if SequenceMatcher(None, w, aw).ratio() >= threshold:
                matched += 1
                break
    return matched >= len(words) - (1 if len(words) > 2 else 0)

def load_image(image_path):
    try:
        data = np.fromfile(image_path, dtype=np.uint8)
        if data.size == 0: return None
        return cv2.imdecode(data, cv2.IMREAD_COLOR)
    except:
        return None

# ---------------------------------------------------------------------------
# Processing Logic
# ---------------------------------------------------------------------------
def process_cin(image_path, expected_name, expected_dob, expected_cin):
    """
    Process CIN: Use EasyOCR. Search for French name, DOB, and CIN.
    """
    img = load_image(image_path)
    if img is None: return {}
    
    result = reader_easyocr.readtext(img, detail=1)
    if not result:
        return {}
        
    full_text = " ".join([text for _, text, _ in result])
    full_text_lower = clean_latin(full_text)
    
    data = {}
    
    # 1. French Name
    if expected_name:
        expected_clean = clean_latin(expected_name)
        if fuzzy_match(expected_clean, full_text_lower):
            data['extracted_name'] = expected_name

    # 2. Date of Birth
    m_dob = re.search(r'\b(\d{2}[\.\-/]\d{2}[\.\-/]\d{4})\b', full_text)
    if m_dob:
        data['dob'] = m_dob.group(1).replace('.', '/').replace('-', '/')

    # 3. CIN Number
    compact_text = re.sub(r'\s+', '', full_text.upper())
    if expected_cin:
        if expected_cin.upper() in compact_text:
            data['cin'] = expected_cin
        else:
            # sliding window fuzzy match for CIN (allow 1 or 2 small OCR mistakes)
            matched = False
            exp_len = len(expected_cin)
            for i in range(max(1, len(compact_text) - exp_len + 1)):
                if SequenceMatcher(None, expected_cin.upper(), compact_text[i:i+exp_len]).ratio() >= 0.8:
                    data['cin'] = expected_cin
                    matched = True
                    break
            if not matched:
                m_cin = re.search(r'([A-Z]{1,2}\d{5,8})', compact_text)
                if m_cin:
                    data['cin'] = m_cin.group(1).upper()
    else:
        m_cin = re.search(r'([A-Z]{1,2}\d{5,8})', compact_text)
        if m_cin:
            data['cin'] = m_cin.group(1).upper()
            
    return data

def process_bac(image_path, expected_name, expected_arabic_name):
    """
    Process Baccalaureate: Use EasyOCR. Find French name, get Arabic name on same line.
    """
    img = load_image(image_path)
    if img is None: return {}
    
    result = reader_easyocr.readtext(img, detail=1)
    data = {}
    target_y_min, target_y_max = None, None
    
    # 1. Find French Name to get Y-coordinate
    if expected_name:
        expected_clean = clean_latin(expected_name)
        for box, text, _ in result:
            if expected_clean in clean_latin(text) or any(w in clean_latin(text) for w in expected_clean.split()):
                ys = [p[1] for p in box]
                target_y_min = min(ys) - 15
                target_y_max = max(ys) + 15
                data['extracted_name'] = expected_name
                break

    # 2. Extract Arabic Name on the same horizontal line
    if target_y_min is not None and target_y_max is not None and expected_arabic_name:
        same_line_blocks = []
        for box, text, _ in result:
            center_y = sum(p[1] for p in box) / 4
            if target_y_min <= center_y <= target_y_max:
                same_line_blocks.append(text)
        
        same_line_text = " ".join(same_line_blocks)
        
        # Check if the DB arabic name exists on this line, or if the "Candidate" keyword is there
        expected_ar_clean = clean_arabic(expected_arabic_name)
        same_line_ar_clean = clean_arabic(same_line_text)
        
        if fuzzy_match(expected_ar_clean, same_line_ar_clean):
            data['extracted_arabic_name_logical'] = expected_arabic_name
            data['extracted_arabic_name'] = fix_arabic_for_display(expected_arabic_name)
                
    return data

# ---------------------------------------------------------------------------
# Flask App
# ---------------------------------------------------------------------------
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024
CORS(app, resources={r"/*": {"origins": "*"}})

@app.route('/validate', methods=['POST'])
def validate_folder():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    uploaded_file = request.files['file']
    expected_data = json.loads(request.form.get('expected_data', '{}'))

    temp_dir = tempfile.mkdtemp()
    zip_path = os.path.join(temp_dir, "upload.zip")
    uploaded_file.save(zip_path)

    extract_dir = os.path.join(temp_dir, "extracted")
    os.makedirs(extract_dir, exist_ok=True)

    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(extract_dir)

        results = []
        for root, dirs, files in os.walk(extract_dir):
            image_paths = [os.path.join(root, fn) for fn in files if fn.lower().endswith(('.png', '.jpg', '.jpeg'))]
            if not image_paths: continue

            subdir = os.path.relpath(root, extract_dir)
            cin = os.path.basename(root).split('_')[0]
            student_expected = expected_data.get(cin, {})
            
            expected_name = student_expected.get('fullName')
            expected_cin = student_expected.get('cin', cin)
            expected_dob = student_expected.get('dateOfBirth')
            expected_arabic_name = student_expected.get('fullNameArabic')

            file_details = []

            # Accumulate success states
            found_french = False
            found_arabic = False
            found_cin = False

            for image_path in image_paths:
                is_bac = "baccalaureate" in os.path.basename(image_path).lower()
                
                if is_bac:
                    ocr_data = process_bac(image_path, expected_name, expected_arabic_name)
                    if ocr_data.get('extracted_name'):
                        found_french = True
                    if expected_arabic_name and ocr_data.get('extracted_arabic_name'):
                        found_arabic = True
                else:
                    ocr_data = process_cin(image_path, expected_name, expected_dob, expected_cin)
                    if ocr_data.get('extracted_name'):
                        found_french = True
                    if ocr_data.get('cin') and (not expected_cin or ocr_data.get('cin') == expected_cin):
                        found_cin = True

                file_details.append({
                    "file": os.path.basename(image_path),
                    "extracted_name": ocr_data.get('extracted_name'),
                    "extracted_arabic_name": ocr_data.get('extracted_arabic_name'),
                    "extracted_arabic_name_logical": ocr_data.get('extracted_arabic_name_logical'),
                    "extracted_dob": ocr_data.get('dob'),
                    "extracted_cin": ocr_data.get('cin'),
                })

            # Evaluate global correctness
            is_correct = True
            errors = []
            
            if expected_name and not found_french:
                is_correct = False
                errors.append({"file": "all", "error": f"French name mismatch (expected '{expected_name}')"})
                
            if expected_arabic_name and not found_arabic:
                is_correct = False
                errors.append({"file": "baccalaureate", "error": f"Arabic name mismatch (expected '{expected_arabic_name}')"})
                
            if expected_cin and not found_cin:
                is_correct = False
                errors.append({"file": "cin", "error": f"CIN mismatch (expected '{expected_cin}')"})

            results.append({
                "cin": cin,
                "folder": subdir,
                "is_correct": is_correct,
                "verified_name": expected_name if found_french else None,
                "verified_arabic_name": expected_arabic_name if found_arabic else None,
                "errors": errors,
                "file_details": file_details
            })

        return jsonify(results)

    except Exception as e:
        logging.error(f"validate error: {e}")
        return jsonify({"error": str(e)}), 500
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, threaded=True)