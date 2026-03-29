import os
from glob import glob
import cv2
import numpy as np
import easyocr
from paddleocr import PaddleOCR
import spacy
from flask import Flask, request, jsonify
from flask_cors import CORS
import zipfile
import tempfile
import re
import json
import shutil

# Load OCR and NLP models
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

try:
    nlp = spacy.load("fr_core_news_sm")
except Exception as e:
    print(f"Error loading spaCy model: {e}")
    nlp = None

# Keywords and constants for OCR
keywords = ["Prénom", "Nom", "Le candidat(e)"]

HEADERS = {
    "ROYAUME", "MAROC", "CARTE", "NATIONALE", "IDENTITE", "D'IDENTITE",
    "CANDIDAT", "CANDIDATE", "PRENOM", "NOM", "REPUBLIQUE", "FRANCAISE",
    "MINISTERE", "EDUCATION", "NATIONALE", "IDENTIFICATION", "UNIQUE",
    "PRESCOLAIRE", "SPORTS", "ACADEMIE", "REGIONALE", "SESSION", "MENTION", 
    "PASSABLE", "SERIE", "SCIENCES", "EXPERIMENTALES", "PHYSIQUES", "OPTION", 
    "FRANCAIS", "PRESIDENT", "ATTESTATION", "BACCALAUREAT", "RABAT", "SALE", "KENITRA",
    "DU", "DE", "LA", "LE", "AU", "AUX", "ET", "EN", "DES", "LJI", "CAY", "UU",
    "UBY", "NÉELE", "NEE", "NEE LE", "NE LE", "NE(E) LE", "NE(E)LE", "LU"
}

WHITELIST = {"EL", "BEN", "ABD", "AL", "ID", "AIT"}


def normalize_value(value):
    """Clean and normalize extracted values."""
    if not value:
        return ""

    # Remove common OCR artifacts (e.g., 'ie)', 'e)')
    value = re.sub(r'^[a-z]{0,2}\)\s*', '', value, flags=re.IGNORECASE)
    # Remove common separators
    value = re.sub(r'[:;=_\-><\[\]]', ' ', value)
    # Remove redundant prefix noise
    value = re.sub(r'^(?:A|EU|RO|DU)\s+', '', value)
    
    # Filter out garbage words and common headers
    words = value.split()
    filtered_words = []
    for w in words:
        w_up = w.upper()
        if w_up in WHITELIST:
            filtered_words.append(w)
        elif not is_garbage_word(w) and w_up not in HEADERS:
            filtered_words.append(w)
            
    value = " ".join(filtered_words)

    # Stricter character filtering for names
    value = re.sub(r'[^a-zA-Z\s\u00C0-\u017F]', ' ', value)
    return ' '.join(value.split()).strip().upper()


def normalize_date(date_str):
    """Normalize date strings to DD/MM/YYYY format."""
    if not date_str:
        return None
    # Remove any non-digit/non-separator characters
    clean_date = re.sub(r'[^0-9\.\-\/:]', '', date_str)
    # Replace common separators with /
    clean_date = re.sub(r'[\.\-\/:]', '/', clean_date)
    
    parts = clean_date.split('/')
    if len(parts) == 3:
        day, month, year = parts
        # Pad with zeros if necessary
        return f"{day.zfill(2)}/{month.zfill(2)}/{year}"
    return clean_date


def is_garbage_word(word):
    """Check if a word looks like OCR noise/garbage."""
    if not word or len(word) < 2:
        return True
    # Too long for a typical name part
    if len(word) > 15:
        return True
    # Too many repeating identical characters
    if re.search(r'(.)\1\1\1', word):
        return True
    # Words with no vowels (and not common abbreviations)
    w_up = word.upper()
    has_vowel = bool(re.search(r'[AEIOUY]', w_up))
    if not has_vowel and len(word) > 2:
        return True
    
    # Specific noise patterns (2-3 letter artifacts)
    if len(w_up) <= 3 and w_up not in {"EL", "BEN", "ABD", "AL", "ID", "AIT", "DR", "MR", "MME", "MLLE", "ALI", "GAD", "BAA"}:
        # Check for repeating chars like "UU"
        if len(w_up) == 2 and w_up[0] == w_up[1]: return True
        # More aggressive vowel check for 3-char words (e.g. "LJI", "UBY", "CAY")
        vowels = re.findall(r'[AEIOU]', w_up)
        if len(w_up) == 3 and len(vowels) < 2:
            return True
            
    return False


def names_match(name1, name2):
    """Check if two names match regardless of word order and spaces. Includes fuzzy matching."""
    if not name1 or not name2:
        return False
    
    n1_nospace = ''.join(c.lower() for c in name1 if c.isalnum())
    n2_nospace = ''.join(c.lower() for c in name2 if c.isalnum())
    
    if n1_nospace == n2_nospace:
        return True
    
    # Sort characters to account for docTR line-reading order (e.g. MOHAMMED TABSART vs TABSART MOHAMMED)
    n1_sorted = ''.join(sorted(n1_nospace))
    n2_sorted = ''.join(sorted(n2_nospace))
    
    if n1_sorted == n2_sorted:
        return True
        
    # Fuzzy matching fallback: allow up to 15% difference or max 2 character difference
    from difflib import SequenceMatcher
    ratio = SequenceMatcher(None, n1_nospace, n2_nospace).ratio()
    if ratio > 0.85:
        return True
        
    # Also check sorted fuzzy for order issues + spelling errors
    # Also check token set ratio
    s1 = set(n1_nospace.split())
    s2 = set(n2_nospace.split())
    if s1 and s2:
        # Check if all words from one are in the other
        if s1.issubset(s2) or s2.issubset(s1):
            # But the length difference shouldn't be too huge (max 2 words)
            if abs(len(s1) - len(s2)) <= 2:
                return True

    ratio_sorted = SequenceMatcher(None, n1_sorted, n2_sorted).ratio()
    # Stricter sorted ratio (was 0.90)
    if ratio_sorted > 0.95:
        return True
        
    # Final check: tokens
    words1 = set(normalize_value(name1).split())
    words2 = set(normalize_value(name2).split())
    if words1 == words2 and words1:
        return True

    return False


def reformat_name(name_info):
    """Reformat names into a consistent format."""
    if not name_info:
        return None
    
    # Priority 1: Nom and Prénom (Full combination)
    prenom = name_info.get("Prénom") or name_info.get("First Name") or name_info.get("Prenom")
    nom = name_info.get("Nom") or name_info.get("Last Name") or name_info.get("Surname")
    
    if prenom and nom:
        return f"{normalize_value(prenom)} {normalize_value(nom)}"
    
    # Priority 2: Full name from candidate line
    elif "Le candidat(e)" in name_info or "Candidature" in name_info:
        full_name = normalize_value(name_info.get("Le candidat(e)") or name_info.get("Candidature"))
        parts = full_name.split()
        # Only swap if it's exactly 2 words (likely Prénom Nom)
        if len(parts) == 2:
            return f"{parts[1]} {parts[0]}"
        return full_name
    
    # Priority 3: Combine whatever we found
    parts = []
    if prenom: parts.append(normalize_value(prenom))
    if nom: parts.append(normalize_value(nom))
    
    if parts:
        return " ".join(parts)
        
    return None


def extract_names(text, keywords):
    """Extract names using keywords (case-insensitive)."""
    name_info = {}
    lines = text.split("\n")
    
    headers_local = list(HEADERS)

    # Expanded keyword patterns for common OCR errors
    patterns = {
        "Nom": r'(?i)Nom|Last\s*Name|Surname',
        "Prénom": r'(?i)Pr[ée]no[mn]|First\s*Name',
        "Le candidat(e)": r'(?i)Le\s*c[oa]nd[idat]*\s*[\(\/]?\s*[éeA]?\s*[\)\/]?|Candidature|Nom\s*et\s*pr[ée]nom'
    }

    for i, line in enumerate(lines):
        for key, pattern in patterns.items():
            match = re.search(pattern, line)
            if match:
                # Get everything after the keyword (until end of line or another field)
                value = line[match.end():].strip()
                # Clean colon and whitespace
                value = re.sub(r'[:\s=]+', ' ', value).strip()
                
                current_clean = normalize_value(value)

                # If current line is nearly empty or just 1 word, look forward (common in BAC split lines)
                if key == "Le candidat(e)" and len(current_clean.split()) < 2:
                    forward_parts = []
                    if current_clean: forward_parts.append(current_clean)
                    
                    for k in range(i + 1, min(i + 4, len(lines))):
                        next_line = lines[k].strip()
                        if not next_line: continue
                        if re.search(r'(?i)N[ée]le|N[ée]\s*le|DATE|MAJMAA|TOLBA', next_line.upper()):
                            break
                        
                        clean_next = normalize_value(next_line)
                        if clean_next:
                            forward_parts.append(clean_next)
                        if len(" ".join(forward_parts).split()) >= 2:
                            break
                    
                    if forward_parts:
                        value = " ".join(forward_parts)

                # Only look back if we still don't have a good name
                if key == "Le candidat(e)" and len(normalize_value(value).split()) < 2:
                    extra_parts = []
                    # Look back up to 3 lines
                    for j in range(max(0, i-3), i):
                        clean_prev = normalize_value(lines[j])
                        if clean_prev and len(clean_prev) > 2:
                            # skip common headers in case
                            if clean_prev not in headers_local:
                                extra_parts.append(clean_prev)
                    if extra_parts:
                        value = " ".join(extra_parts) + " " + value

                if value and len(value) > 2: # Ignore noise
                    # Filter value words
                    words = value.split()
                    filtered_words = [w for w in words if not is_garbage_word(w) and w.upper() not in headers_local]
                    if filtered_words:
                        name_info[key] = " ".join(filtered_words)
                break

    return name_info


def preprocess_image(image_path):
    """Apply preprocessing to improve OCR on poor quality images."""
    img = cv2.imread(image_path)
    if img is None:
        return None
    
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blur = cv2.GaussianBlur(gray, (5, 5), 0)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(blur)
    
    temp_fd, temp_path = tempfile.mkstemp(suffix=".png")
    os.close(temp_fd)
    cv2.imwrite(temp_path, enhanced)
    return temp_path

def extract_names_spacy(text):
    """Extract names using spaCy NER."""
    if not nlp:
        return {}
    name_info = {}
    doc = nlp(text)
    
    # Extract PER entities
    persons = [ent.text for ent in doc.ents if ent.label_ == "PER"]
    if persons:
        # Use the first identified person as candidate name
        name = normalize_value(persons[0])
        if len(name) > 3:
            name_info["Le candidat(e)"] = name
            
    return name_info

def extract_capital_words(extracted_text):
    """Extract capitalized words from OCR text, filtering out common document headers."""
    capital_words = []
    headers = {
    "ROYAUME", "MAROC", "CARTE", "NATIONALE", "IDENTITE", "D'IDENTITE",
    "CANDIDAT", "CANDIDATE", "PRENOM", "NOM", "REPUBLIQUE", "FRANCAISE",
    "MINISTERE", "EDUCATION", "NATIONALE", "IDENTIFICATION", "UNIQUE",
    "PRESCOLAIRE", "SPORTS", "ACADEMIE", "REGIONALE", "SESSION", "MENTION", 
    "PASSABLE", "SERIE", "SCIENCES", "EXPERIMENTALES", "PHYSIQUES", "OPTION", 
    "FRANCAIS", "PRESIDENT", "ATTESTATION", "BACCALAUREAT", "RABAT", "SALE", "KENITRA"
    }
    
    words = extracted_text.split()
    for word in words:
        word_text = re.sub(r'[^A-Z]', '', word.upper())
        if word_text.isupper() and len(word_text) > 2 and word_text not in headers:
            if not is_garbage_word(word_text):
                clean_original = re.sub(r'[^a-zA-Z]', '', word)
                if clean_original.isupper():
                    capital_words.append(word_text)
                
    return capital_words

def extract_names_regex(text):
    """Extract names using regex patterns as fallback."""
    name_info = {}
    
    # Pattern for "Nom: VALUE" or "Nom VALUE"
    nom_match = re.search(r'(?i)(?:nom|name)\s*[:\s]+([A-Z\s]{2,})', text)
    if nom_match:
        name_info['Nom'] = nom_match.group(1).strip()
        
    # Pattern for "Prénom: VALUE"
    prenom_match = re.search(r'(?i)(?:pr[ée]nom|first\s*name)\s*[:\s]+([A-Z\s]{2,})', text)
    if prenom_match:
        name_info['Prénom'] = prenom_match.group(1).strip()
        
    return name_info

def process_image(image_path):
    """Process individual image for name extraction."""
    processed_path = None
    try:
        # 1. Preprocess the image
        processed_path = preprocess_image(image_path)
        img_to_ocr = processed_path if processed_path else image_path
        
        extracted_text = ""
        
        # 2. Try PaddleOCR first (better for complex layouts)
        if reader_paddle:
            try:
                result = reader_paddle.ocr(img_to_ocr)
                if result and result[0]:
                    lines = [line[1][0] for line in result[0]]
                    extracted_text = "\n".join(lines)
            except Exception as e:
                print(f"PaddleOCR inference failed: {e}")
                
        # 3. Fallback to EasyOCR if PaddleOCR fails or is empty
        if not extracted_text.strip() and reader_easyocr:
            try:
                result = reader_easyocr.readtext(img_to_ocr, detail=0)
                extracted_text = "\n".join(result)
            except Exception as e:
                print(f"EasyOCR inference failed: {e}")
        
        # Debugging: Log extracted text to console
        print(f"--- OCR Result for {os.path.basename(image_path)} ---")
        print(extracted_text)
        print("---------------------------------------------")
            
        # Check if it's a CIN (Moroccan National ID)
        is_cin = any(ind in extracted_text.upper() for ind in ["ROYAUME DU MAROC", "CARTE NATIONALE", "IDENTITE"])

        # Attempt A: Extract names using spaCy
        name_info = extract_names_spacy(extracted_text)

        # Attempt B: Extract names using keywords
        if not name_info:
            name_info = extract_names(extracted_text, keywords)
        
        if is_cin and not name_info:
            # Specific CIN logic: Names are usually the first few capitalized lines 
            # after the headers and before birth info
            lines = extracted_text.split('\n')
            cin_name_parts = []
            found_header = False
            
            for line in lines:
                l_upper = line.upper()
                if any(h in l_upper for h in ["CARTE NATIONALE", "IDENTITE"]):
                    found_header = True
                    continue
                if found_header:
                    # Termination: birth info or birth place (regex for robust matching)
                    if re.search(r'(?i)N[ée]le|N[ée]\s*le|VALABLE|MAJMAA|TOLBA|KHEMISSET', l_upper):
                        break
                    
                    # Clean the line and see if it's a name part
                    words = line.split()
                    valid_words = []
                    for w in words:
                        w_up = w.upper()
                        if w_up in WHITELIST:
                            valid_words.append(w)
                        elif not is_garbage_word(w) and w_up not in HEADERS:
                            valid_words.append(w)
                    
                    if valid_words:
                        cin_name_parts.append(" ".join(valid_words))
            
            if cin_name_parts:
                name_info["Le candidat(e)"] = " ".join(cin_name_parts)

        if not name_info:
            # Attempt C: Regex patterns
            name_info = extract_names_regex(extracted_text)

        if not name_info:
            # Attempt D: Look for patterns in the text lines
            lines = extracted_text.split('\n')
            for i, line in enumerate(lines):
                if ':' in line:
                    parts = line.split(':')
                    key = parts[0].strip().lower()
                    value = parts[1].strip()
                    if 'nom' in key:
                        name_info['Nom'] = value
                    elif 'prénom' in key or 'prenom' in key:
                        name_info['Prénom'] = value

                if 'candidat' in line.lower():
                    # Check if the name is on the same line after a separator
                    potential_value = re.sub(r'(?i).*candidat\(?[ée]?\)?\s*[:\s]+', '', line).strip()
                    if potential_value and len(potential_value) > 3:
                        name_info['Le candidat(e)'] = potential_value
                    elif i + 1 < len(lines):
                        # Otherwise check the next line
                        name_info['Le candidat(e)'] = lines[i + 1].strip()

        final_data = name_info if name_info else {}
            
        # Attempt E: Extract capitalized words (last resort)
        if not final_data:
            capital_words = extract_capital_words(extracted_text)
            if 2 <= len(capital_words) <= 5:
                final_data = {
                    "Prénom": capital_words[0],
                    "Nom": " ".join(capital_words[1:])
                }
                
        # Extract Date of Birth and CIN (common for all IDs)
        # Handle "Né le", "Née le", "Né(e) le", "Date de naissance"
        dob_match = re.search(r'(?i)(?:n[ée]\(?e?\)?\s*le|date\s*de\s*naissance)[:\s]+(\d{1,2}[\.\-\/:]\d{1,2}[\.\-\/:]\d{4})', extracted_text)
        if dob_match:
            final_data['dob'] = normalize_date(dob_match.group(1))
            
        # CIN pattern: 1-2 letters followed by 5-7 digits
        cin_match = re.search(r'(?i)N[°\s]*([A-Z]{0,2}\d{5,8})', extracted_text)
        if cin_match:
            final_data['cin'] = cin_match.group(1).upper()

        return final_data if final_data else None

    except Exception as e:
        print(f"Error processing {image_path}: {e}")
        import traceback
        traceback.print_exc()

    finally:
        # Clean up temporary preprocessed image
        if processed_path and os.path.exists(processed_path):
            try:
                os.remove(processed_path)
            except:
                pass

    return None


# Flask Application
app = Flask(__name__)
# Use a clean CORS configuration
CORS(app, resources={r"/*": {"origins": "*"}})

@app.route('/ping', methods=['GET'])
def ping():
    return jsonify({"status": "ok", "message": "OCR Service is running"})

@app.route('/validate', methods=['POST'])
def validate_folder():
    """Flask route for folder validation."""
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"})

    uploaded_file = request.files['file']
    temp_dir = tempfile.mkdtemp()
    zip_path = os.path.join(temp_dir, uploaded_file.filename)
    uploaded_file.save(zip_path)

    extract_dir = os.path.join(temp_dir, "extracted")
    os.makedirs(extract_dir, exist_ok=True)

    try:
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            for member in zip_ref.infolist():
                # Check for Zip Slip vulnerability
                target_path = os.path.normpath(os.path.join(extract_dir, member.filename))
                if not target_path.startswith(os.path.abspath(extract_dir) + os.sep) and \
                   target_path != os.path.abspath(extract_dir):
                    continue
                zip_ref.extract(member, extract_dir)

        results = []
        # Find all directories that contain images, or the root if it contains images
        walk_data = list(os.walk(extract_dir))
        
        for root, dirs, files in walk_data:
            image_paths = []
            for ext in ['*.png', '*.jpg', '*.jpeg']:
                pattern = os.path.join(root, ext)
                image_paths.extend(glob(pattern))

            if not image_paths:
                continue

            # This directory has images, treat it as a student folder
            subdir = os.path.relpath(root, extract_dir)
            
            extracted_names = []
            file_details = []

            # Process each image in the folder
            for image_path in image_paths:
                ocr_data = process_image(image_path)
                formatted_name = reformat_name(ocr_data) if ocr_data else None

                file_details.append({
                    "file": os.path.basename(image_path),
                    "extracted_name": formatted_name,
                    "extracted_dob": ocr_data.get('dob') if ocr_data else None,
                    "extracted_cin": ocr_data.get('cin') if ocr_data else None,
                    "raw_data": ocr_data
                })

                if formatted_name:
                    extracted_names.append(formatted_name)

            # Determine if all names match and all dates match
            is_correct = False
            is_date_correct = False
            verified_name = None
            verified_dob = None
            errors = []

            if extracted_names:
                # Use the first extracted name as baseline
                baseline_name = extracted_names[0]
                is_correct = all(names_match(name, baseline_name) for name in extracted_names)
                verified_name = baseline_name if is_correct else None

                # Extract all DOBs
                extracted_dobs = [d["extracted_dob"] for d in file_details if d["extracted_dob"]]
                if extracted_dobs:
                    baseline_dob = extracted_dobs[0]
                    is_date_correct = all(dob == baseline_dob for dob in extracted_dobs)
                    verified_dob = baseline_dob if is_date_correct else None
                    
                    if not is_date_correct:
                        errors.append({
                            "file": "all",
                            "error": f"Date mismatch among documents: {', '.join(set(extracted_dobs))}"
                        })

                # Generate errors for mismatches
                for detail in file_details:
                    if not detail["extracted_name"]:
                        errors.append({
                            "file": detail["file"],
                            "error": "No name could be extracted"
                        })
                    elif not is_correct and not names_match(detail["extracted_name"], baseline_name):
                        errors.append({
                            "file": detail["file"],
                            "error": f"Name mismatch: found '{detail['extracted_name']}'"
                        })

            # Get CIN from folder name
            folder_name = os.path.basename(root)
            cin = folder_name.split('_')[0] if '_' in folder_name else folder_name

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
        # Clean up temporary files
        shutil.rmtree(temp_dir)


if __name__ == '__main__':
    # Changed to 5001 to avoid common system conflicts
    app.run(host='0.0.0.0', port=5001)
