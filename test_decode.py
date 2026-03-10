"""
Test script to decode a watermarked StegaStamp image.

Usage:
  python test_decode.py path\to\your_image.png

The script sends the image to the StegaStamp microservice at http://localhost:5001/decode
and prints the extracted student ID.
"""

import sys
import base64
import requests

if len(sys.argv) < 2:
    print("Usage: python test_decode.py path\\to\\image.png")
    sys.exit(1)

image_path = sys.argv[1]

with open(image_path, "rb") as f:
    image_b64 = base64.b64encode(f.read()).decode("utf-8")

print(f"Sending image to StegaStamp decoder...")

response = requests.post("http://localhost:5001/decode", json={
    "image_b64": image_b64
}, timeout=30)

if response.ok:
    result = response.json()
    print(f"\n✅ Decoded successfully!")
    print(f"   Extracted Student ID: {result.get('extracted_student_id', '(empty)')}")
else:
    print(f"\n❌ Error: {response.status_code} - {response.text}")
