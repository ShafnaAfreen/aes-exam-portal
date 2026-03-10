import base64
import io
import os
import sys
from io import BytesIO

from flask import Flask, jsonify, request
import numpy as np
from PIL import Image

# Add StegaStamp to Python path so we can import its modules
sys.path.append(os.path.join(os.path.dirname(__file__), "StegaStamp"))

import tensorflow as tf
from models import StegaStampEncoder, StegaStampDecoder

app = Flask(__name__)

# --- Model Initialization ---
# We will load the models once when the app starts.

# Configuration for the models
BCH_POLYNOMIAL = 137
BCH_BITS = 5
SECRET_SIZE = 100

ENCODER_MODEL_DIR = os.path.join(os.path.dirname(__file__), "StegaStamp", "saved_models", "stegastamp_pretrained")
DECODER_MODEL_DIR = os.path.join(os.path.dirname(__file__), "StegaStamp", "saved_models", "stegastamp_pretrained")

sess = tf.InteractiveSession(graph=tf.Graph())

# Restore the model weights from the SavedModel wrapper
# The saved model already contains the graph. We don't restore with Saver. 
# We need to reload using `tf.saved_model.loader.load`
tf.saved_model.loader.load(sess, [tf.saved_model.tag_constants.SERVING], ENCODER_MODEL_DIR)

# Get the tensors from the loaded graph by name since they are already built
image_input = sess.graph.get_tensor_by_name('input_hide:0')
secret_input = sess.graph.get_tensor_by_name('input_prep:0')
encoded_image_clipped = sess.graph.get_tensor_by_name('clip_by_value:0')

# Decoder tensors
decode_image_input = sess.graph.get_tensor_by_name('input_hide:0')
decoded_secret_only = sess.graph.get_tensor_by_name('gen_decoder/decoder_out/BiasAdd:0')



# --- Helper Functions ---

def string_to_100_bits(s: str) -> list:
    """
    Converts a string (like a registration number '23BCE1240') into exactly 100 binary bits.
    Each character is converted to its 8-bit ASCII representation.
    If the result is shorter than 100 bits, it is padded with zeros.
    """
    bits = []
    for char in s:
        bin_val = bin(ord(char))[2:].zfill(8)
        bits.extend([int(b) for b in bin_val])
    
    # Truncate if too long (max ~12 characters fit in 100 bits)
    if len(bits) > 100:
        bits = bits[:100]
    # Pad with zeros if too short
    while len(bits) < 100:
        bits.append(0)
    
    return bits

def bits_to_string(bits: list) -> str:
    """
    Converts a list of exactly 100 binary bits back into an alphanumeric string.
    """
    s = ""
    # Process 8 bits at a time
    for i in range(0, len(bits), 8):
        byte_bits = bits[i:i+8]
        if len(byte_bits) < 8:
            break
        # If the byte is all zeros, it was padding
        if all(b == 0 for b in byte_bits):
            break
        
        char_code = int("".join(str(int(b)) for b in byte_bits), 2)
        # Basic printable ASCII check to avoid garbled output
        if 32 <= char_code <= 126:
            s += chr(char_code)
    return s

def prepare_image_for_model(img, target_size=(400, 400)):
    """Resizes and normalizes an image for the StegaStamp model."""
    img = img.resize(target_size, Image.BILINEAR)
    img_array = np.array(img, dtype=np.float32) / 255.0
    return np.expand_dims(img_array, axis=0)

# --- API Endpoints ---

@app.route("/", methods=["GET"])
def health_check():
    return jsonify({"status": "StegaStamp Microservice Running"})

@app.route("/encode", methods=["POST"])
def encode_image():
    """
    Expects JSON:
    {
      "image_b64": "<base64 encoded image string>",
      "student_id": "23BCE1240"
    }
    Returns JSON:
    {
      "watermarked_image_b64": "<base64 encoded image string>"
    }
    """
    try:
        data = request.json
        image_b64 = data.get("image_b64")
        student_id = data.get("student_id")

        if not image_b64 or not student_id:
            return jsonify({"error": "Missing image_b64 or student_id"}), 400

        # Decode the image
        image_data = base64.b64decode(image_b64)
        img = Image.open(BytesIO(image_data)).convert('RGB')
        
        # Prepare image (needs to be 400x400 for StegaStamp)
        original_size = img.size
        input_img = prepare_image_for_model(img, target_size=(400, 400))

        # Prepare the secret (100 bits)
        secret_bits = string_to_100_bits(student_id)
        input_secret = np.array([secret_bits], dtype=np.float32)

        # Run the encoder
        watermarked_tensor = sess.run(encoded_image_clipped, feed_dict={
            image_input: input_img,
            secret_input: input_secret
        })

        # Process output
        watermarked_img_array = (watermarked_tensor[0] * 255.0).astype(np.uint8)
        watermarked_img = Image.fromarray(watermarked_img_array).resize(original_size, Image.BILINEAR)

        # Convert back to base64
        buffered = BytesIO()
        watermarked_img.save(buffered, format="PNG")
        watermarked_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

        return jsonify({
            "watermarked_image_b64": watermarked_b64
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@app.route("/decode", methods=["POST"])
def decode_image():
    """
    Expects JSON:
    {
      "image_b64": "<base64 encoded cropped image string>"
    }
    Returns JSON:
    {
      "extracted_student_id": "23BCE1240"
    }
    """
    try:
        data = request.json
        image_b64 = data.get("image_b64")

        if not image_b64:
            return jsonify({"error": "Missing image_b64"}), 400

        # Decode the image
        image_data = base64.b64decode(image_b64)
        img = Image.open(BytesIO(image_data)).convert('RGB')
        
        # Prepare image (needs to be 400x400 for the decoder)
        input_img = prepare_image_for_model(img, target_size=(400, 400))

        # Run the decoder
        extracted_secret_tensor = sess.run(decoded_secret_only, feed_dict={
            decode_image_input: input_img
        })

        # The tensor outputs raw probabilities/activations, so threshold at 0 to get bits
        extracted_bits = (extracted_secret_tensor[0] > 0).astype(int).tolist()

        # Convert back to string
        student_id = bits_to_string(extracted_bits)

        return jsonify({
            "extracted_student_id": student_id.strip('\x00')
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    print("Starting StegaStamp Microservice on port 5001...")
    # Using threaded=False to prevent TF graph threading issues
    app.run(host="0.0.0.0", port=5001, threaded=False)
