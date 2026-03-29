import os
import cv2
import tempfile
import easyocr
import spacy

reader_easyocr = easyocr.Reader(['fr', 'en'], gpu=False)
nlp = spacy.load("fr_core_news_sm")

def preprocess_image(image_path):
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

def test_on_dummy_text():
    for img_name in ["test_cin.png", "test_bac.png"]:
        print(f"\n--- Testing {img_name} ---")
        processed = preprocess_image(img_name)
        result = reader_easyocr.readtext(processed, detail=0)
        extracted_text = "\n".join(result)
        print("EasyOCR Extracted Text:\n", extracted_text)
            
        doc = nlp(extracted_text)
        print("spaCy PER entities:", [ent.text for ent in doc.ents if ent.label_ == "PER"])

if __name__ == "__main__":
    test_on_dummy_text()
