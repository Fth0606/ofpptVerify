
import sys
import os
from app import process_image, reformat_name

def test_ocr():
    image_path = "test_data/documents/X451686/BAC.png"
    if not os.path.exists(image_path):
        print(f"Error: {image_path} not found")
        return

    print(f"Processing {image_path}...")
    names = process_image(image_path)
    print(f"Extracted raw data: {names}")

    formatted_name = reformat_name(names)
    print(f"Formatted name: {formatted_name}")

    expected = "TABSART MOHAMMED"
    if formatted_name and expected in formatted_name.upper():
        print("SUCCESS: Name correctly extracted!")
    else:
        print(f"FAILURE: Expected {expected}, got {formatted_name}")

if __name__ == "__main__":
    test_ocr()
