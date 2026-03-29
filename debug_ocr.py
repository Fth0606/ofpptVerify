import os
import cv2
import tempfile
import re
from paddleocr import PaddleOCR
import spacy

reader_paddle = PaddleOCR(use_angle_cls=True, lang='fr')
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
    # Let's generate a dummy image with text that mimics the failure
    import numpy as np
    img = np.ones((500, 800, 3), dtype=np.uint8) * 255
    font = cv2.FONT_HERSHEY_SIMPLEX
    cv2.putText(img, "ROYAUME DU MAROC", (50, 50), font, 1, (0, 0, 0), 2)
    cv2.putText(img, "CARTE NATIONALE D'IDENTITE", (50, 100), font, 1, (0, 0, 0), 2)
    cv2.putText(img, "MOHAMMED", (300, 150), font, 1, (0, 0, 0), 2)
    cv2.putText(img, "TABSART", (300, 200), font, 1, (0, 0, 0), 2)
    cv2.putText(img, "Ne le 6.12.2004", (300, 250), font, 1, (0, 0, 0), 2)
    cv2.putText(img, "N X451686", (50, 450), font, 1, (0, 0, 0), 2)
    
    cv2.imwrite("test_cin.png", img)
    
    img2 = np.ones((500, 800, 3), dtype=np.uint8) * 255
    cv2.putText(img2, "ATTESTATION DU BACCALAUREAT", (50, 50), font, 1, (0, 0, 0), 2)
    cv2.putText(img2, "Le candidat(e) : TABSART MOHAMMED", (50, 150), font, 1, (0, 0, 0), 2)
    cv2.putText(img2, "Ne(e) le : 16-12-2004", (50, 200), font, 1, (0, 0, 0), 2)
    cv2.imwrite("test_bac.png", img2)

    for img_name in ["test_cin.png", "test_bac.png"]:
        print(f"\n--- Testing {img_name} ---")
        processed = preprocess_image(img_name)
        result = reader_paddle.ocr(processed)
        print("Raw result:", result)
        if result and result[0]:
            lines = [line[1][0] for line in result[0]]
            text = "\n".join(lines)
            print("Extracted Text:\n", text)
            
            # Print spacy results
            doc = nlp(text)
            print("spaCy PER entities:", [ent.text for ent in doc.ents if ent.label_ == "PER"])
        else:
            print("No text extracted!")

if __name__ == "__main__":
    test_on_dummy_text()
