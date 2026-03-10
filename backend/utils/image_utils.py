import base64
import io
import textwrap
import numpy as np
from PIL import Image, ImageDraw, ImageFont

def create_grainy_canvas(question_data: dict, width: int = 800, height: int = 600) -> str:
    """
    Creates an image from the question text and options on a grainy, paper-like canvas.
    Returns the image as a base64 encoded string.
    """
    # 1. Create a base off-white canvas (paper texture)
    base_color = (240, 238, 230)
    img = Image.new("RGB", (width, height), base_color)
    
    # 2. Add RGB noise for the grain effect
    img_array = np.array(img, dtype=np.int16)
    # Generate random noise between -15 and +15 for each RGB channel
    noise = np.random.randint(-15, 16, (height, width, 3), dtype=np.int16)
    
    # Apply noise and clip to valid RGB range [0, 255]
    noisy_img_array = np.clip(img_array + noise, 0, 255).astype(np.uint8)
    img = Image.fromarray(noisy_img_array, 'RGB')
    
    # 3. Draw the question text
    draw = ImageDraw.Draw(img)
    
    # Try to load a standard font, fallback to default if not available
    try:
        # On Windows this usually exists
        font = ImageFont.truetype("arial.ttf", 24)
        title_font = ImageFont.truetype("arialbd.ttf", 28)
    except IOError:
        font = ImageFont.load_default()
        title_font = font

    text_color = (30, 30, 30)
    margin = 50
    current_y = 50

    # Draw Question Number/Title
    q_title = f"Question {question_data.get('id', '?')}"
    draw.text((margin, current_y), q_title, fill=text_color, font=title_font)
    current_y += 40

    # Draw Question Text (wrapped)
    q_text = question_data.get("q", "")
    wrapped_q = textwrap.fill(q_text, width=60)
    
    # Calculate text height for the wrapped block
    for line in wrapped_q.split('\n'):
        draw.text((margin, current_y), line, fill=text_color, font=font)
        current_y += 35
        
    current_y += 20 # Add some spacing before options
    
    # Draw Options
    options = question_data.get("options", [])
    letters = ['A', 'B', 'C', 'D', 'E']
    for i, opt in enumerate(options):
        if i < len(letters):
            opt_text = f"{letters[i]}) {opt}"
            draw.text((margin + 20, current_y), opt_text, fill=text_color, font=font)
            current_y += 35

    # 4. Convert the image to base64
    buffered = io.BytesIO()
    img.save(buffered, format="PNG")
    img_b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
    
    return img_b64
