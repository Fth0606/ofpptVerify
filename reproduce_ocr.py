import os
from doctr.io import DocumentFile
from doctr.models import ocr_predictor
import re

# Load the OCR model
model = ocr_predictor(pretrained=True)

def normalize_value(value):
    if not value:
        return ""
    value = re.sub(r'^\s*[\(\[\]]*[a-zA-Z]{1,2}[\)\}\]>]\s*', '', value)
    while True:
        new_value = re.sub(r'^\s*(?:A|EU|LE|DE|LA|DU|RO|MA|ET)\b\s*', '', value, flags=re.IGNORECASE)
        if new_value == value:
            break
        value = new_value
    value = re.sub(r'[:;=_\-><\[\]\(\)]', ' ', value)
    return " ".join(value.split())

def process_image_test(image_path):
    doc = DocumentFile.from_images(image_path)
    result = model(doc)
    extracted_text = result.render()
    print(f"--- Extracted Text from {image_path} ---")
    print(extracted_text)
    print("---------------------------------------")

    is_cin = any(ind in extracted_text.upper() for ind in ["ROYAUME DU MAROC", "CARTE NATIONALE", "IDENTITE"])
    print(f"Is CIN: {is_cin}")

    # Specific CIN logic from app.py
    lines = extracted_text.split('\n')
    cin_name_parts = []
    found_header = False
    cin_blacklist = ["ROYAUME", "MAROC", "CARTE", "NATIONALE", "IDENTITE", "D'IDENTITE"]

    for line in lines:
        l_upper = line.upper()
        if any(h in l_upper for h in ["CARTE NATIONALE", "IDENTITE"]):
            found_header = True
            print(f"Found header in line: {line}")
            continue
        if found_header:
            print(f"Checking line after header: {line}")
            if any(f in l_upper for f in ["NÉ LE", "NE LE", "VALABLE", "MAJMAA", "TOLBA", "KHEMISSET"]):
                print(f"Breaking at line: {line}")
                break
            clean_line = re.sub(r'[^A-Z\s]', '', line.strip())
            if len(clean_line) > 2 and clean_line.isupper():
                words = clean_line.split()
                filtered_words = [w for w in words if w not in cin_blacklist]
                if filtered_words:
                    cin_name_parts.append(" ".join(filtered_words))
                    print(f"Added name part: {' '.join(filtered_words)}")

    if cin_name_parts:
        print(f"Result: {' '.join(cin_name_parts)}")
    else:
        print("No name parts found using CIN logic")

if __name__ == "__main__":
    process_image_test("/tmp/file_attachments/CIN.png")
