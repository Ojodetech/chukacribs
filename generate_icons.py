#!/usr/bin/env python3
"""
Generate favicon and PWA icons from the Chuka Cribs logo image.
Generates multiple sizes for different purposes.
"""

from PIL import Image
import os
from pathlib import Path

def generate_icons():
    """Generate icon files in all required sizes."""
    
    # Paths
    input_image = "chuka_cribs_logo.png"  # Provided logo image
    output_dir = "public/images"
    
    # Create output directory if it doesn't exist
    Path(output_dir).mkdir(parents=True, exist_ok=True)
    
    # Check if input image exists
    if not os.path.exists(input_image):
        print(f"Error: {input_image} not found!")
        return False
    
    try:
        # Open the image
        print(f"Opening image: {input_image}")
        img = Image.open(input_image).convert("RGBA")
        original_size = img.size
        print(f"Original image size: {original_size}")
        
        # Icon sizes to generate
        sizes = {
            "favicon": 32,
            "icon-192x192": 192,
            "icon-512x512": 512,
        }
        
        # Generate regular icons
        for name, size in sizes.items():
            # Resize image
            resized = img.resize((size, size), Image.Resampling.LANCZOS)
            
            # Save PNG
            output_path = os.path.join(output_dir, f"{name}.png")
            resized.save(output_path, "PNG")
            print(f"✓ Generated {output_path} ({size}x{size})")
        
        # Generate maskable variants (for adaptive icons on Android)
        for size_name in ["192", "512"]:
            size = int(size_name)
            resized = img.resize((size, size), Image.Resampling.LANCZOS)
            output_path = os.path.join(output_dir, f"icon-{size_name}x{size_name}-maskable.png")
            resized.save(output_path, "PNG")
            print(f"✓ Generated {output_path} ({size}x{size} maskable)")
        
        # Generate ICO format for compatibility (16x16 and 32x32)
        for size in [16, 32]:
            resized = img.resize((size, size), Image.Resampling.LANCZOS)
            output_path = os.path.join(output_dir, f"favicon-{size}x{size}.ico")
            resized.save(output_path, "ICO")
            print(f"✓ Generated {output_path} ({size}x{size})")
        
        # Generate apple touch icon (180x180)
        apple_size = 180
        resized = img.resize((apple_size, apple_size), Image.Resampling.LANCZOS)
        output_path = os.path.join(output_dir, "apple-touch-icon.png")
        resized.save(output_path, "PNG")
        print(f"✓ Generated {output_path} ({apple_size}x{apple_size})")
        
        print("\n✅ All icons generated successfully!")
        return True
        
    except Exception as e:
        print(f"❌ Error generating icons: {e}")
        return False

if __name__ == "__main__":
    generate_icons()
