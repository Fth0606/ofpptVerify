import os
from glob import glob
from doctr.io import DocumentFile
from doctr.models import ocr_predictor
from flask import Flask, request, jsonify
from flask_cors import CORS
import zipfile
import tempfile
import re
import json
import shutil

# Load the OCR model from docTR
model = ocr_predictor(pretrained=True)

# Keywords to search for
keywords = ["Prénom", "Nom", "Le candidat(e)"]


def normalize_value(value):
    """Clean and normalize extracted values."""
    if not value:
        return ""
    # Remove common OCR artifacts at the beginning like 'ie)', 'e)', 'c)', 'l\''
    value = re.sub(r'^[a-z]{0,2}\)\s*', '', value, flags=re.IGNORECASE)
    # Remove common separators and clean whitespace
    value = re.sub(r'[:;=_\-><\[\]]', ' ', value)
    # Remove redundant prefix noise
    value = re.sub(r'^(?:A|EU|RO|DU)\s+', '', value)
    return value.strip()


def names_match(name1, name2):
    """Check if two names match regardless of word order. Strict on characters but flexible on order."""
    if not name1 or not name2:
        return False
    
    # Normalize and split into words
    words1 = sorted(re.findall(r'\w+', name1.lower()))
    words2 = sorted(re.findall(r'\w+', name2.lower()))
    
    # Filter out short noise words
    words1 = [w for w in words1 if len(w) > 1]
    words2 = [w for w in words2 if len(w) > 1]
    
    if not words1 or not words2:
        return False
        
    return words1 == words2


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

    # Expanded keyword patterns for common OCR errors
    patterns = {
        "Nom": r'(?i)Nom|Last\s*Name|Surname',
        "Prénom": r'(?i)Pr[ée]no[mn]|First\s*Name',
        "Le candidat(e)": r'(?i)Le\s*candidat\(?[ée]?\)?|Candidature'
        
    }

    for i, line in enumerate(lines):
        for key, pattern in patterns.items():
            match = re.search(pattern, line)
            if match:
                # Get everything after the keyword (until end of line or another field)
                value = line[match.end():].strip()
                # Clean colon and whitespace
                value = re.sub(r'[:\s=]+', ' ', value).strip()
                
                # Check for floating uppercase name fragments on previous lines for 'Le candidat(e)'
                if key == "Le candidat(e)" and i > 0:
                    extra_parts = []
                    # Look back up to 3 lines
                    for j in range(max(0, i-3), i):
                        # clean noise
                        clean_prev = lines[j].strip()
                        # Strict check: only A-Z and spaces, must be mostly alphabetical
                        if bool(re.match(r'^[A-Z\s]+$', clean_prev)) and len(clean_prev) > 2:
                            words = clean_prev.split()
                            # skip common headers in case
                            if any(len(w) > 2 for w in words) and clean_prev not in ["ROYAUME", "MAROC", "CARTE", "NATIONALE"]:
                                extra_parts.append(clean_prev)
                    if extra_parts:
                        value = " ".join(extra_parts) + " " + value

                if value and len(value) > 2: # Ignore noise
                    name_info[key] = value
                break

    return name_info


def extract_capital_words(result):
    """Extract capitalized words from OCR result, filtering out common document headers."""
    capital_words = []
    headers = {
    "ROYAUME", "MAROC", "CARTE", "NATIONALE", "IDENTITE", "D'IDENTITE",
    "CANDIDAT", "CANDIDATE", "PRENOM", "NOM", "REPUBLIQUE", "FRANCAISE",
    "MINISTERE", "EDUCATION", "NATIONALE", "IDENTIFICATION", "UNIQUE"
    }
    for page in result.pages:
        for block in page.blocks:  # Indented correctly
            for line in block.lines:  # Indented correctly
                for word in line.words:  # Indented correctly
                    word_text = re.sub(r'[^A-Z]', '', word.value.upper())
                    if word_text.isupper() and len(word_text) > 2 and word_text not in headers:
                        # Extra check: avoid words that are likely addresses or locations
                        # Often these are in later sections of the document
                        capital_words.append(word.value)
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
    try:
        # Load and process the image
        doc = DocumentFile.from_images(image_path)
        result = model(doc)
        extracted_text = result.render()
         # Check if it's a CIN (Moroccan National ID)
        is_cin = any(ind in extracted_text.upper() for ind in ["ROYAUME DU MAROC", "CARTE NATIONALE", "IDENTITE"])

        # 1. Attempt: Extract names using keywords
        name_info = extract_names(extracted_text, keywords)
        
        if is_cin and not name_info:
            # Specific CIN logic: Names are usually the first few capitalized lines 
            # after the headers and before "Né le"
            lines = extracted_text.split('\n')
            cin_name_parts = []
            found_header = False
            # Common headers to ignore within the name area
            cin_blacklist = ["ROYAUME", "MAROC", "CARTE", "NATIONALE", "IDENTITE", "D'IDENTITE"]
            
            for line in lines:
                l_upper = line.upper()
                if any(h in l_upper for h in ["CARTE NATIONALE", "IDENTITE"]):
                    found_header = True
                    continue
                if found_header:
                    if any(f in l_upper for f in ["NÉ LE", "NE LE", "VALABLE", "MAJMAA", "TOLBA", "KHEMISSET"]):
                        break
                    # Clean the line and see if it's a name part (all caps)
                    # Exclude lines with any lowercase letters to avoid multi-case noise like "EU aibgil"
                    if not any(c.islower() for c in line) and len(re.sub(r'[^A-Z]', '', line)) > 1:
                        clean_line = re.sub(r'[^A-Z\s]', '', line.strip())
                        words = clean_line.split()
                        filtered_words = [w for w in words if w not in cin_blacklist and len(w) > 1]
                        if filtered_words:
                            cin_name_parts.append(" ".join(filtered_words))
            
            if cin_name_parts:
                name_info["Le candidat(e)"] = " ".join(cin_name_parts)


        if not name_info:
            # 2. Attempt: Regex patterns
            name_info = extract_names_regex(extracted_text)

        if not name_info:
            # 3. Attempt: Look for patterns in the text lines
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
            
        # 4. Fallback: Extract capitalized words (last resort)
        if not final_data:
            capital_words = extract_capital_words(result)
            if 2 <= len(capital_words) <= 5:
                final_data = {
                    "Prénom": capital_words[0],
                    "Nom": " ".join(capital_words[1:])
                }
        # 5. Extract Date of Birth and CIN (common for all IDs)
        # Date pattern: DD.MM.YYYY, DD-MM-YYYY, DD/MM/YYYY, or with colon due to OCR error
        dob_match = re.search(r'(?i)(?:n[ée]\s*le|date\s*de\s*naissance)[:\s]+(\d{1,2}[\.\-\/:]\d{1,2}[\.\-\/:]\d{4})', extracted_text)
        if dob_match:
            final_data['dob'] = dob_match.group(1).replace(':', '.')
            
        # CIN pattern: 1-2 letters followed by 5-7 digits
        cin_match = re.search(r'(?i)N[°\s]*([A-Z]{1,2}\d{5,7})', extracted_text)
        if cin_match:
            final_data['cin'] = cin_match.group(1)

        return final_data if final_data else None

    except Exception as e:
        print(f"Error processing {image_path}: {e}")

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

            # Determine if all names match
            is_correct = False
            verified_name = None
            errors = []

            if extracted_names:
                # Use the first extracted name as baseline
                baseline_name = extracted_names[0]
                
                # Check if all extracted names match the baseline (order-insensitive)
                is_correct = all(names_match(name, baseline_name) for name in extracted_names)
                verified_name = baseline_name if is_correct else None

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
                "is_correct": is_correct,
                "verified_name": verified_name,
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
