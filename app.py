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
from dateutil import parser as dateutil_parser

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

# Birth date: only trust dates tied to these labels (FR + common OCR variants).
BIRTH_LABEL_RE = re.compile(
    r"(?i)n[ée]e?\s*\(?e?\)?\s*l[ée]|"
    r"n[ée]\s*l[ée]|"
    r"ne\s*le|"
    r"date\s*de\s*naissance|"
    r"naissance\s*[\(\)]?\s*l[ée]"
)
# Ignore dates that belong to validity / issue lines.
DATE_INVALID_CONTEXT_RE = re.compile(
    r"(?i)valable|jusqu|expir|"
    r"d[ée]liv|d[ée]livr|"
    r"[ée]tabli|"
    r"signature|"
    r"autorit[ée]"
)

# MRZ-style birth date on CNIE back (TD1 line 2: YYMMDD + sex + expiry YYMMDD)
MRZ_LINE2_DOB_RE = re.compile(
    r"(?<![0-9])(\d{2})(\d{2})(\d{2})\d[MF<](\d{2})(\d{2})(\d{2})"
)

DATE_IN_TEXT_RE = re.compile(
    r"\b(\d{1,2}[\.\-\/\s]\d{1,2}[\.\-\/\s]\d{2,4})\b"
)


def sort_blocks_reading_order(ocr_blocks):
    """Top-to-bottom, left-to-right order so labels stay near their values."""

    def sort_key(item):
        box, _ = item
        if not box or len(box) < 4:
            return (0, 0)
        ys = [float(p[1]) for p in box]
        xs = [float(p[0]) for p in box]
        return (sum(ys) / len(ys), min(xs))

    return sorted(ocr_blocks or [], key=sort_key)


def extract_dob_from_mrz(full_text):
    """Last resort: birth date from TD1-style MRZ line 2 (YYMMDD)."""
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


def normalize_value(value):
    """Clean and normalize extracted values."""
    if not value:
        return ""

    # Remove common OCR artifacts (e.g., 'ie)', 'e)')
    value = re.sub(r'^[a-z]{0,2}\)\s*', '', value, flags=re.IGNORECASE)
    # Remove ALL punctuation
    value = re.sub(r'[^a-zA-Z\s\u00C0-\u017F]', ' ', value)
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
            
    return " ".join(filtered_words).strip().upper()


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


def parse_date_to_ddmmyyyy(date_fragment):
    """Parse a date substring to strict DD/MM/YYYY using day-first (Morocco / FR)."""
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
    except (ValueError, TypeError, OverflowError):
        return None


def extract_birth_date_smart(full_text, ocr_blocks):
    """
    Prefer dates on the same line (or adjacent OCR region) as birth labels.
    Avoids picking validity / expiry / issue dates that appear elsewhere on CIN.
    """
    if not full_text:
        return None

    lines = [ln.strip() for ln in full_text.split("\n") if ln.strip()]

    # 1) Line-level: label and date on same line
    for line in lines:
        if not BIRTH_LABEL_RE.search(line):
            continue
        for m in DATE_IN_TEXT_RE.finditer(line):
            parsed = parse_date_to_ddmmyyyy(m.group(1))
            if parsed:
                return normalize_date(parsed)

    # 2) "Label" line then date on next line (common OCR split)
    for i, line in enumerate(lines):
        if not BIRTH_LABEL_RE.search(line):
            continue
        if DATE_IN_TEXT_RE.search(line):
            continue
        for j in range(i + 1, min(i + 3, len(lines))):
            nxt = lines[j]
            if DATE_INVALID_CONTEXT_RE.search(nxt) and not BIRTH_LABEL_RE.search(nxt):
                continue
            for m in DATE_IN_TEXT_RE.finditer(nxt):
                parsed = parse_date_to_ddmmyyyy(m.group(1))
                if parsed:
                    return normalize_date(parsed)

    # 3) OCR blocks: merge text from block containing birth label with following block(s)
    ordered = sort_blocks_reading_order(ocr_blocks)
    for i, (_, txt) in enumerate(ordered):
        if not BIRTH_LABEL_RE.search(txt):
            continue
        chunk = txt
        for j in range(i + 1, min(i + 3, len(ordered))):
            chunk = chunk + " " + ordered[j][1]
        if DATE_INVALID_CONTEXT_RE.search(chunk) and not BIRTH_LABEL_RE.search(chunk):
            continue
        for m in DATE_IN_TEXT_RE.finditer(chunk):
            parsed = parse_date_to_ddmmyyyy(m.group(1))
            if parsed:
                return normalize_date(parsed)

    # 4) Regex on full text (single clearest birth phrase)
    m = re.search(
        r"(?i)(?:n[ée]e?\s*\(?e?\)?\s*l[ée]|date\s*de\s*naissance)\s*[:\s]*(\d{1,2}[\.\-\/\s]\d{1,2}[\.\-\/\s]\d{2,4})",
        full_text,
    )
    if m:
        parsed = parse_date_to_ddmmyyyy(m.group(1))
        if parsed:
            return normalize_date(parsed)

    return extract_dob_from_mrz(full_text)


def extract_labeled_nom_prenom_from_lines(lines):
    """
    Moroccan CIN / forms: 'Nom' and 'Prénom' (value same line or next line).
    Returns dict with keys 'Nom', 'Prénom' when found.
    """
    out = {}
    if not lines:
        return out

    raw_lines = [ln.strip() for ln in lines]

    label_nom = re.compile(r"(?i)^nom(?:\s*/\s*name)?\s*$")
    label_prenom = re.compile(r"(?i)^pr[ée]nom(?:\s*/\s*(?:first|given)\s*name)?\s*$")
    line_nom_val = re.compile(r"(?i)^nom(?:\s*/\s*name)?\s*[:\s\-–—]+\s*(.+)$")
    line_prenom_val = re.compile(r"(?i)^pr[ée]nom(?:\s*/\s*(?:first|given)\s*name)?\s*[:\s\-–—]+\s*(.+)$")

    for i, line in enumerate(raw_lines):
        if label_nom.match(line) and i + 1 < len(raw_lines):
            nxt = raw_lines[i + 1].strip()
            if nxt and not label_prenom.match(nxt) and not label_nom.match(nxt):
                out["Nom"] = nxt
            continue

        if label_prenom.match(line) and i + 1 < len(raw_lines):
            nxt = raw_lines[i + 1].strip()
            if nxt and not label_nom.match(nxt) and not label_prenom.match(nxt):
                out["Prénom"] = nxt
            continue

        mn = line_nom_val.match(line)
        if mn:
            val = mn.group(1).strip()
            if val and not re.match(r"(?i)^pr[ée]nom", val):
                out["Nom"] = val

        mp = line_prenom_val.match(line)
        if mp:
            val = mp.group(1).strip()
            if val and not re.match(r"(?i)^nom\b", val):
                out["Prénom"] = val

    return out


def extract_cin_number(full_text, ocr_blocks):
    """Moroccan CIN: letter(s) + digits (e.g. WA123456, A1234567)."""
    if not full_text and not ocr_blocks:
        return None

    patterns = [
        r"(?i)n[°ºo]?\s*[.:]?\s*([A-Z]{1,2}\d{5,8})\b",
        r"(?i)\b([A-Z]{1,2}\d{5,8})\b",
        r"(?i)cin\s*[:\s]*([A-Z]{1,2}\d{5,8})\b",
    ]
    for pat in patterns:
        m = re.search(pat, full_text or "")
        if m:
            return m.group(1).upper()

    ordered = sort_blocks_reading_order(ocr_blocks or [])
    for _, txt in ordered:
        for pat in patterns:
            m = re.search(pat, txt)
            if m:
                return m.group(1).upper()
    return None


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

    n1_nospace = "".join(c.lower() for c in name1 if c.isalnum())
    n2_nospace = "".join(c.lower() for c in name2 if c.isalnum())

    if n1_nospace == n2_nospace:
        return True

    s1 = set(w for w in normalize_value(name1).split() if len(w) > 1)
    s2 = set(w for w in normalize_value(name2).split() if len(w) > 1)

    if s1 and s2:
        if s1 == s2:
            return True
        if s1.issubset(s2) or s2.issubset(s1):
            return True
        intersection = s1.intersection(s2)
        if len(intersection) >= min(len(s1), len(s2)):
            return True

    from difflib import SequenceMatcher

    ratio = SequenceMatcher(None, n1_nospace, n2_nospace).ratio()
    if ratio > 0.85:
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
        # BAC often prints "Nom Prénom" as two tokens; normalize to "Prénom Nom"
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

    # Word boundaries so "Nom" does not match inside "Prénom".
    patterns = {
        "Prénom": r'(?i)\bPr[ée]nom\b(?:\s*/\s*First(?:\s*Name)?)?|\bFirst\s*Name\b',
        "Nom": r'(?i)\bNom\b(?:\s*/\s*Name)?|\bLast\s*Name\b|\bSurname\b',
        "Le candidat(e)": r'(?i)Le\s*c[oa]nd[idat]*\s*[\(\/]?\s*[éeA]?\s*[\)\/]?|Candidature|Nom\s*et\s*pr[ée]nom',
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


def extract_by_position(ocr_blocks, is_cin):
    """Fallback extraction using spatial bounding box positions."""
    name_info = {}
    dob = None
    cin = None
    
    if not ocr_blocks:
        return name_info, dob, cin
        
    def get_y_center(box):
        return sum([p[1] for p in box]) / 4
        
    def get_x_center(box):
        return sum([p[0] for p in box]) / 4

    def get_y_top(box):
        return min([p[1] for p in box])
        
    def get_y_bottom(box):
        return max([p[1] for p in box])

    # DOB and CIN must not be taken from "first random date / number" on the card
    # (validity, issue date, MRZ noise). Handled in process_image via label-aware helpers.

    if is_cin:
        y_header_bottom = 0
        y_date_top = 999999
        header_found = False
        date_found = False
        
        for box, text in ocr_blocks:
            t_upper = text.upper()
            if not header_found and any(h in t_upper for h in ["CARTE NATIONALE", "IDENTITE", "ROYAUME"]):
                y_header_bottom = max(y_header_bottom, get_y_bottom(box))
                header_found = True
                
            if not date_found and re.search(
                r'(?i)N[ÉE]?E?\s*\(?E?\)?\s*L[EE]|N[ÉE]\s*LE|DATE\s*DE\s*NAISS',
                t_upper,
            ):
                if get_y_top(box) > y_header_bottom:
                    y_date_top = min(y_date_top, get_y_top(box))
                    date_found = True
                    
        if header_found and date_found and y_date_top > y_header_bottom:
            candidate_blocks = []
            for box, text in ocr_blocks:
                y_c = get_y_center(box)
                # 10 pixel margin
                if (y_header_bottom - 10) < y_c < (y_date_top + 10):
                    candidate_blocks.append((box, text))
            
            candidate_blocks.sort(key=lambda x: get_y_center(x[0]))
            
            valid_words = []
            for box, text in candidate_blocks:
                words = text.split()
                for w in words:
                    w_up = re.sub(r'[^a-zA-Z\s\u00C0-\u017F]', '', w.upper())
                    if w_up and not is_garbage_word(w_up) and w_up not in HEADERS:
                        valid_words.append(w_up)
            
            if valid_words:
                name_info["Le candidat(e)"] = " ".join(valid_words)

    else:
        for i, (box, text) in enumerate(ocr_blocks):
            if re.search(r'(?i)candidat\(?[ée]?\)?', text):
                potential_value = re.sub(r'(?i).*candidat\(?[ée]?\)?\s*[:\s]*', '', text).strip()
                if potential_value and len(re.sub(r'[^a-zA-Z]', '', potential_value)) > 2:
                     name_info["Le candidat(e)"] = potential_value
                else:
                     c_y = get_y_center(box)
                     c_x = get_x_center(box)
                     
                     potential_candidates = []
                     for j in range(i+1, min(i+6, len(ocr_blocks))):
                         n_box, n_text = ocr_blocks[j]
                         n_y = get_y_center(n_box)
                         n_x = get_x_center(n_box)
                         
                         if abs(n_y - c_y) < 30 and n_x > c_x:
                             potential_candidates.append(n_text)
                         elif 0 < (n_y - c_y) < 70:
                             potential_candidates.append(n_text)
                             
                     if potential_candidates:
                         name_info["Le candidat(e)"] = " ".join(potential_candidates)
                break
                
    return name_info, dob, cin

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
    
    nom_match = re.search(
        r'(?i)\bNom\b(?:\s*/\s*Name)?\s*[:\s]+([A-Za-zÀ-ÿ\s\-\'’]{2,})',
        text,
    )
    if nom_match:
        name_info["Nom"] = nom_match.group(1).strip()

    prenom_match = re.search(
        r'(?i)\bPr[ée]nom\b(?:\s*/\s*First(?:\s*Name)?)?\s*[:\s]+([A-Za-zÀ-ÿ\s\-\'’]{2,})',
        text,
    )
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
        ocr_blocks = []
        
        # 2. Try PaddleOCR first (better for complex layouts)
        if reader_paddle:
            try:
                result = reader_paddle.ocr(img_to_ocr)
                if result and result[0]:
                    lines = []
                    for line in result[0]:
                        box = line[0]
                        text = line[1][0]
                        ocr_blocks.append((box, text))
                        lines.append(text)
                    extracted_text = "\n".join(lines)
            except Exception as e:
                print(f"PaddleOCR inference failed: {e}")
                
        # 3. Fallback to EasyOCR if PaddleOCR fails or is empty
        if not extracted_text.strip() and reader_easyocr:
            try:
                result = reader_easyocr.readtext(img_to_ocr, detail=1)
                lines = []
                for res in result:
                    box = res[0]
                    text = res[1]
                    ocr_blocks.append((box, text))
                    lines.append(text)
                extracted_text = "\n".join(lines)
            except Exception as e:
                print(f"EasyOCR inference failed: {e}")
        
        # Debugging: Log extracted text to console
        print(f"--- OCR Result for {os.path.basename(image_path)} ---")
        print(extracted_text)
        print("---------------------------------------------")

        ocr_blocks = sort_blocks_reading_order(ocr_blocks)
        extracted_text = "\n".join(t for _, t in ocr_blocks)
        text_upper = extracted_text.upper()

        is_cin = any(
            ind in text_upper
            for ind in ["ROYAUME DU MAROC", "CARTE NATIONALE", "IDENTITE", "CARTE D'IDENTITE"]
        )

        lines_list = [ln.strip() for ln in extracted_text.split("\n") if ln.strip()]

        name_info = {}

        labeled = extract_labeled_nom_prenom_from_lines(lines_list)
        for k, v in labeled.items():
            if v and len(v.strip()) > 1:
                name_info[k] = v.strip()

        kw_names = extract_names(extracted_text, keywords)
        for k, v in kw_names.items():
            if not v:
                continue
            if k in ("Nom", "Prénom") and name_info.get(k):
                continue
            if k not in name_info:
                name_info[k] = v

        has_both = name_info.get("Nom") and name_info.get("Prénom")

        pos_name_info, _, _ = extract_by_position(ocr_blocks, is_cin)
        if not has_both and pos_name_info.get("Le candidat(e)"):
            clean_name = normalize_value(pos_name_info["Le candidat(e)"])
            if len(clean_name) > 3:
                name_info["Le candidat(e)"] = pos_name_info["Le candidat(e)"].strip()

        if not name_info.get("Le candidat(e)") and not has_both:
            spacy_names = extract_names_spacy(extracted_text)
            if spacy_names.get("Le candidat(e)"):
                name_info["Le candidat(e)"] = spacy_names["Le candidat(e)"]

        if is_cin and not has_both and not name_info.get("Le candidat(e)"):
            cin_name_parts = []
            found_header = False
            for line in lines_list:
                l_upper = line.upper()
                if any(h in l_upper for h in ["CARTE NATIONALE", "IDENTITE", "ROYAUME"]):
                    found_header = True
                    continue
                if found_header:
                    if re.search(
                        r"(?i)N[ÉE]?E?\s*\(?E?\)?\s*L[EE]|"
                        r"DATE\s*DE\s*NAISS|VALABLE|MAJMAA|TOLBA|KHEMISSET",
                        l_upper,
                    ):
                        break
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

        if not has_both and not name_info.get("Le candidat(e)"):
            rx_names = extract_names_regex(extracted_text)
            for k, v in rx_names.items():
                if v and not name_info.get(k):
                    name_info[k] = v

        if not has_both and not name_info.get("Le candidat(e)"):
            for i, line in enumerate(lines_list):
                if ":" in line:
                    parts = line.split(":", 1)
                    key = parts[0].strip().lower()
                    value = parts[1].strip()
                    if re.match(r"(?i)nom\b", key) and "prénom" not in key and "prenom" not in key:
                        name_info["Nom"] = value
                    elif re.match(r"(?i)pr[ée]nom\b", key):
                        name_info["Prénom"] = value
                if "candidat" in line.lower():
                    potential_value = re.sub(
                        r"(?i).*candidat\(?[ée]?\)?\s*[:\s]+", "", line
                    ).strip()
                    if potential_value and len(potential_value) > 3:
                        name_info["Le candidat(e)"] = potential_value
                    elif i + 1 < len(lines_list):
                        name_info["Le candidat(e)"] = lines_list[i + 1].strip()

        final_data = dict(name_info) if name_info else {}

        if not final_data or (
            not final_data.get("Nom")
            and not final_data.get("Prénom")
            and not final_data.get("Le candidat(e)")
        ):
            capital_words = extract_capital_words(extracted_text)
            if 2 <= len(capital_words) <= 5:
                final_data = {
                    "Prénom": capital_words[0],
                    "Nom": " ".join(capital_words[1:]),
                }

        dob = extract_birth_date_smart(extracted_text, ocr_blocks)
        if dob:
            final_data["dob"] = dob
        else:
            dob_match = re.search(
                r"(?i)(?:n[ée]\(?e?\)?\s*le|date\s*de\s*naissance)\s*[:\s]*"
                r"(\d{1,2}[\.\-\/:\s]\d{1,2}[\.\-\/:\s]\d{2,4})",
                extracted_text,
            )
            if dob_match:
                parsed = parse_date_to_ddmmyyyy(dob_match.group(1))
                if parsed:
                    final_data["dob"] = normalize_date(parsed)

        cin_num = extract_cin_number(extracted_text, ocr_blocks)
        if cin_num:
            final_data["cin"] = cin_num

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
