from doctr.io import DocumentFile
from doctr.models import ocr_predictor

model = ocr_predictor(pretrained=True)
doc = DocumentFile.from_images('./test_data/documents/X451686/CIN.png')
result = model(doc)
extracted_text = result.render()
print(extracted_text)
