# Image to PDF Receipt Organizer

This tool takes images from the `images` folder, resizes and arranges them (4 per A4 page, landscape images span 2 columns), adds a receipt number as a caption, and generates a PDF.

## Setup Instructions

### 1. Clone or Download the Project
Place all your receipt images in the `images` folder.

### 2. Create a Python Virtual Environment (Recommended)

```
python3 -m venv .venv
```

Activate the virtual environment:
- On macOS/Linux:
  ```
  source .venv/bin/activate
  ```
- On Windows:
  ```
  .venv\Scripts\activate
  ```

### 3. Install Requirements

```
pip install Pillow reportlab
```

## Usage

1. Place your receipt images (JPG, PNG, etc.) in the `images` folder.
2. Run the script:
   ```
   python image_to_pdf.py
   ```
3. The output PDF (`output.pdf`) will be created in the project folder.

## Features
- Automatically resizes and arranges images (4 per A4 page, landscape images span 2 columns)
- Adds a large, clear receipt number as a caption below each image
- If the filename contains a receipt number (e.g., `Receipt No 123.jpg`), that number is used; otherwise, images are numbered in order

## Troubleshooting
- If you see font or image errors, ensure you have the required Python packages installed and your images are valid formats.
- For best results, use high-resolution images.

## Requirements
- Python 3.7+
- Pillow
- reportlab

---

Feel free to modify the script for your specific needs!
