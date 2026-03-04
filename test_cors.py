import requests
import time
import subprocess
import os

# Start the flask app
proc = subprocess.Popen(["python3", "app.py"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
time.sleep(5) # Give it time to start

try:
    # Test preflight
    headers = {
        'Origin': 'http://localhost:8080',
        'Access-Control-Request-Method': 'POST',
    }
    response = requests.options('http://localhost:5000/validate', headers=headers)
    print(f"Preflight Status: {response.status_code}")
    print(f"Preflight Headers: {response.headers}")

    # Test actual POST (with empty file just to check headers)
    files = {'file': ('test.zip', b'empty')}
    response = requests.post('http://localhost:5000/validate', files=files, headers={'Origin': 'http://localhost:8080'})
    print(f"Post Status: {response.status_code}")
    print(f"Post Headers: {response.headers}")
    print(f"Post Body: {response.text}")

finally:
    proc.terminate()
