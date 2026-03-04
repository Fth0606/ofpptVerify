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
    # Remove common separators and clean whitespace
    value = re.sub(r'[:;=_-]', '', value)
    return value.strip()


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
    elif "Le candidat(e)" in name_info:
        full_name = normalize_value(name_info["Le candidat(e)"])
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
        "Le candidat(e)": r'(?i)Le\s*candidat\(e\)'
    }

    for line in lines:
        for key, pattern in patterns.items():
            match = re.search(pattern, line)
            if match:
                # Get everything after the keyword (until end of line or another field)
                value = line[match.end():].strip()
                # Clean colon and whitespace
                value = re.sub(r'[:\s=]+', ' ', value).strip()
                if value and len(value) > 2: # Ignore noise
                    name_info[key] = value
                break

    return name_info


def extract_capital_words(result):
    """Extract capitalized words from OCR result."""
    capital_words = []
    for page in result.pages:
        for block in page.blocks:
            for line in block.lines:
                for word in line.words:
                    word_text = word.value
                    if word_text.isupper() and len(word_text) > 2:
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
    try:
        # Load and process the image
        doc = DocumentFile.from_images(image_path)
        result = model(doc)
        extracted_text = result.render()

        # 1. Attempt: Extract names using keywords
        name_info = extract_names(extracted_text, keywords)

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

                if 'candidat' in line.lower() and i + 1 < len(lines):
                    name_info['Le candidat(e)'] = lines[i + 1].strip()

        if name_info:
            return name_info
            
        # 4. Fallback: Extract capitalized words (last resort)
        capital_words = extract_capital_words(result)
        if len(capital_words) >= 7:
            return {
                "Prénom": capital_words[5],
                "Nom": capital_words[6]
            }

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
                names = process_image(image_path)
                formatted_name = reformat_name(names) if names else None

                file_details.append({
                    "file": os.path.basename(image_path),
                    "extracted_name": formatted_name,
                    "raw_data": names
                })

                if formatted_name:
                    extracted_names.append(formatted_name)

            # Determine if all names match
            is_correct = False
            verified_name = None
            errors = []

            if extracted_names:
                first_name = extracted_names[0]
                is_correct = all(name == first_name for name in extracted_names)
                verified_name = first_name if is_correct else None

                # Generate errors for mismatches
                for detail in file_details:
                    if not detail["extracted_name"]:
                        errors.append({
                            "file": detail["file"],
                            "error": "No name could be extracted"
                        })
                    elif not is_correct and detail["extracted_name"] != first_name:
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
