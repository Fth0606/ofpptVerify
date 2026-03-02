import requests
import sys

def check_service(name, url):
    print(f"Checking {name} at {url}...")
    try:
        if name == "OCR Service":
            response = requests.get(f"{url}/ping", timeout=5)
        else:
            # Laravel root or simple endpoint
            response = requests.get(url, timeout=5)

        if response.status_code == 200:
            print(f"✅ {name} is reachable!")
            if name == "OCR Service":
                print(f"   CORS Headers: {response.headers.get('Access-Control-Allow-Origin')}")
        else:
            print(f"⚠️ {name} returned status {response.status_code}")
    except Exception as e:
        print(f"❌ {name} is NOT reachable: {e}")

if __name__ == "__main__":
    print("--- System Connectivity Check ---")
    check_service("OCR Service", "http://localhost:5000")
    check_service("Laravel Backend", "http://localhost:8000")
    print("---------------------------------")
    print("If OCR Service is failing:")
    print("1. Ensure 'python app.py' is running.")
    print("2. Ensure 'pip install flask flask-cors' was successful.")
    print("3. Check for any firewall/antivirus blocking port 5000.")
