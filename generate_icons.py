
import os
from PIL import Image

def generate_android_icons(source_path, res_path):
    # Standard Android mipmap sizes for ic_launcher
    sizes = {
        'mipmap-mdpi': 48,
        'mipmap-hdpi': 72,
        'mipmap-xhdpi': 96,
        'mipmap-xxhdpi': 144,
        'mipmap-xxxhdpi': 192
    }

    try:
        img = Image.open(source_path).convert("RGBA")
        
        for folder, size in sizes.items():
            folder_path = os.path.join(res_path, folder)
            if not os.path.exists(folder_path):
                os.makedirs(folder_path, exist_ok=True)
            
            # Resize
            resized = img.resize((size, size), Image.Resampling.LANCZOS)
            
            # Save as ic_launcher.png (standard icon)
            output_path = os.path.join(folder_path, 'ic_launcher.png')
            resized.save(output_path, "PNG")
            
            # Also save round icon if needed, but for now just standard
            output_round = os.path.join(folder_path, 'ic_launcher_round.png')
            resized.save(output_round, "PNG")
            
            print(f"Generated {folder}/{size}px")
            
    except Exception as e:
        print(f"Error: {e}")

source = "c:/Users/Usuario/Desktop/Nur - Islamic App/public/icon.png"
res_dir = "c:/Users/Usuario/Desktop/Nur - Islamic App/android/app/src/main/res"

if os.path.exists(res_dir):
    generate_android_icons(source, res_dir)
else:
    print("Android res directory not found yet.")
