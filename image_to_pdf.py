# Image to PDF Converter
# This script will resize images to A4, add receipt number as caption, and generate a PDF.


import os
import datetime
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4

import datetime

IMAGES_DIR = "images"
today_str = datetime.datetime.now().strftime("%Y-%m-%d")
OUTPUT_PDF = f"receipts_{today_str}.pdf"
A4_WIDTH, A4_HEIGHT = A4  # in points (1 point = 1/72 inch)


def get_images_list(directory):
    # Get list of image files, ordered by filename
    valid_ext = (".jpg", ".jpeg", ".png", ".bmp", ".gif")
    files = [f for f in os.listdir(directory) if f.lower().endswith(valid_ext)]
    files.sort()
    return files


def resize_image_to_a4(img):
    # Convert A4 size from points to pixels (assuming 72 dpi)
    a4_px = (int(A4_WIDTH), int(A4_HEIGHT))
    img = img.convert("RGB")
    img.thumbnail(a4_px, Image.LANCZOS)
    return img


def extract_receipt_number(filename):
    # Example: extract from filename before first space or dot
    base = os.path.splitext(filename)[0]
    return base


def add_caption(img, caption):
    # Add caption below the image
    font_size = 40
    # Try to use a bold font if available, fallback to arial or default
    try:
        font = ImageFont.truetype("arialbd.ttf", font_size)
    except:
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            font = ImageFont.load_default()
    width, height = img.size
    caption_height = font_size + 20
    new_img = Image.new("RGB", (width, height + caption_height), "white")
    new_img.paste(img, (0, 0))
    draw = ImageDraw.Draw(new_img)
    # Use textbbox for Pillow >=10, fallback to textsize for older versions
    try:
        bbox = draw.textbbox((0, 0), caption, font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
    except AttributeError:
        text_width, text_height = draw.textsize(caption, font=font)
    text_x = (width - text_width) // 2
    text_y = height + 10
    draw.text((text_x, text_y), caption, fill="black", font=font)
    return new_img


def main():
    images = get_images_list(IMAGES_DIR)
    processed_images = []
    import re

    captions = []
    for idx, fname in enumerate(images, 1):
        path = os.path.join(IMAGES_DIR, fname)
        img = Image.open(path)
        # Try to extract 'Receipt No' from filename, e.g. 'Receipt No 123' or 'receipt_no_123'
        match = re.search(r"receipt[ _-]*no[ _-]*(\d+)", fname, re.IGNORECASE)
        if match:
            receipt_no = match.group(1)
            caption = f"Receipt No: {receipt_no}"
        else:
            caption = f"Receipt No: {idx}"
        processed_images.append(img)
        captions.append(caption)

    # Layout: 2x2 grid per A4 page, landscape images take 2 spaces (span 2 columns)
    grid_rows, grid_cols = 2, 2
    margin = 30
    spacing = 20
    c = canvas.Canvas(OUTPUT_PDF, pagesize=A4)
    cell_width = (A4_WIDTH - 2 * margin - (grid_cols - 1) * spacing) / grid_cols
    cell_height = (A4_HEIGHT - 2 * margin - (grid_rows - 1) * spacing) / grid_rows

    def is_landscape(img):
        return img.width > img.height

    def resize_for_cell(img, span_cols=1, span_rows=1):
        w = cell_width * span_cols + spacing * (span_cols - 1)
        h = (
            cell_height * span_rows + spacing * (span_rows - 1) - 80
        )  # leave space for caption
        img_w, img_h = img.size
        scale = min(w / img_w, h / img_h)
        new_size = (int(img_w * scale), int(img_h * scale))
        return img.resize(new_size, Image.LANCZOS)

    i = 0
    n = len(processed_images)
    while i < n:
        slots = [[False, False], [False, False]]  # 2x2 grid occupancy
        imgs_on_page = []
        j = i
        while j < n and len(imgs_on_page) < 4:
            img = processed_images[j]
            if is_landscape(img):
                # Try to fit in top row (span 2 columns)
                if not slots[0][0] and not slots[0][1]:
                    imgs_on_page.append(
                        (img, 0, 0, 2, 1)
                    )  # (img, row, col, colspan, rowspan)
                    slots[0][0] = slots[0][1] = True
                # Try to fit in bottom row
                elif not slots[1][0] and not slots[1][1]:
                    imgs_on_page.append((img, 1, 0, 2, 1))
                    slots[1][0] = slots[1][1] = True
                else:
                    break  # No space for landscape image
            else:
                # Try to fit in any single slot
                placed = False
                for row in range(2):
                    for col in range(2):
                        if not slots[row][col]:
                            imgs_on_page.append((img, row, col, 1, 1))
                            slots[row][col] = True
                            placed = True
                            break
                    if placed:
                        break
                if not placed:
                    break  # No space for portrait image
            j += 1

        # Draw images on this page
        for k, (img, row, col, colspan, rowspan) in enumerate(imgs_on_page):
            img_idx = i + k
            img_resized = resize_for_cell(img, span_cols=colspan, span_rows=rowspan)
            temp_path = f"_temp_img_{k}.jpg"
            img_resized = img_resized.convert("RGB")
            img_resized.save(temp_path, "JPEG")
            x = margin + col * (cell_width + spacing)
            y = (
                A4_HEIGHT
                - margin
                - (row + rowspan) * cell_height
                - row * spacing
                - (rowspan - 1) * spacing
            )
            # Center image in its cell(s)
            cell_w = cell_width * colspan + spacing * (colspan - 1)
            cell_h = cell_height * rowspan + spacing * (rowspan - 1)
            x += (cell_w - img_resized.width) / 2
            y += (
                cell_h - img_resized.height
            ) / 2 + 80  # move image up to leave space for caption
            c.drawImage(
                temp_path, x, y, width=img_resized.width, height=img_resized.height
            )
            # Draw caption below image using reportlab (guaranteed large)
            caption = captions[img_idx]
            font_size = 24
            c.setFont("Helvetica-Bold", font_size)
            caption_width = c.stringWidth(caption, "Helvetica-Bold", font_size)
            caption_x = x + (img_resized.width - caption_width) / 2
            caption_y = y - 40  # more space between image and caption
            c.setFillColorRGB(0, 0, 0)
            c.drawString(caption_x, caption_y, caption)
            os.remove(temp_path)
        c.showPage()
        i += len(imgs_on_page)
    c.save()
    print(f"PDF generated: {OUTPUT_PDF}")


if __name__ == "__main__":
    main()
