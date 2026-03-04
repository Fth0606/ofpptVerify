from PIL import Image, ImageDraw, ImageFont
import os

def create_mock_doc(text, path):
    # Create a white image
    img = Image.new('RGB', (800, 400), color=(255, 255, 255))
    d = ImageDraw.Draw(img)

    # Try to use a default font
    try:
        font = ImageFont.load_default()
    except:
        font = None

    d.text((50, 50), text, fill=(0, 0, 0), font=font)
    img.save(path)

# Ahmed's docs
create_mock_doc("Nom: EL MANSOUR\nPrénom: AHMED\nCIN: BB123456\nDocument: Attestation de scolarité", "test_data/documents/BB123456/scolarity.jpg")
create_mock_doc("Nom: EL MANSOUR\nPrénom: AHMED\nDate de naissance: 15/05/2000\nDocument: Extrait d'acte de naissance", "test_data/documents/BB123456/birth.jpg")

# Sarah's docs (one mismatch for testing)
create_mock_doc("Nom: BENANI\nPrénom: SARAH\nCIN: CC789012\nDocument: Diplôme du Baccalauréat", "test_data/documents/CC789012/bac.jpg")
create_mock_doc("Nom: BENANI\nPrénom: FATIMA\nDocument: Another Doc", "test_data/documents/CC789012/wrong_name.jpg")

print("Mock documents created in test_data/documents/")
