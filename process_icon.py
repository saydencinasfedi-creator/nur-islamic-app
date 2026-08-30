
from PIL import Image, ImageDraw

def round_corners(image_path, output_path, radius):
    try:
        # Open and convert to RGBA
        img = Image.open(image_path).convert("RGBA")
        
        # Create a transparency mask
        mask = Image.new("L", img.size, 0)
        draw = ImageDraw.Draw(mask)
        
        # Draw rounded rectangle on mask key visual size
        w, h = img.size
        draw.rounded_rectangle((0, 0, w, h), radius=radius, fill=255)
        
        # Apply mask
        img.putalpha(mask)
        
        # Save
        img.save(output_path, "PNG")
        print(f"Successfully saved to {output_path}")
        
    except Exception as e:
        print(f"Error: {e}")

# Process the image
# Using standard icon size convention, radius usually ~20-25%
source_path = "C:/Users/Usuario/.gemini/antigravity/brain/9a7e8591-88b2-4e1c-9ecb-63d9f421962f/uploaded_image_1768398885897.jpg"
output_path = "C:/Users/Usuario/Desktop/Nur - Islamic App/public/icon.png"

# Load image first to determine radius
img = Image.open(source_path)
radius = int(min(img.size) * 0.22) # ~22% radius for squircle-like look

round_corners(source_path, output_path, radius)
