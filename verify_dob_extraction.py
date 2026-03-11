import os
from doctr.io import DocumentFile
from doctr.models import ocr_predictor
import re

# Load the OCR model
model = ocr_predictor(pretrained=True)

def process_image_test(image_path):
    doc = DocumentFile.from_images(image_path)
    result = model(doc)
    extracted_text = result.render()
    print(f"--- Extracted Text from {image_path} ---")
    print(extracted_text)
    print("---------------------------------------")

    # 5. Extract Date of Birth and CIN (common for all IDs)
    dob_match = re.search(r'(?i)(?:n[ée]\s*le|date\s*de\s*naissance)[:\s]+(\d{1,2}[\.\-\/:]\d{1,2}[\.\-\/:]\d{4})', extracted_text)
    extracted_dob = dob_match.group(1).replace(':', '.') if dob_match else None
    print(f"Extracted DOB: {extracted_dob}")

    cin_match = re.search(r'(?i)N[°\s]*([A-Z]{1,2}\d{5,7})', extracted_text)
    extracted_cin = cin_match.group(1) if cin_match else None
    print(f"Extracted CIN: {extracted_cin}")

if __name__ == "__main__":
    process_image_test("/tmp/file_attachments/CIN.png")
