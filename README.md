# Receipt Organizer - Web Application

Transform your receipt images into organized PDF documents with automatic numbering and smart layout. Built with modern web technologies and ready to deploy on Netlify!

![Receipt Organizer](https://img.shields.io/badge/Status-Ready-success) ![Netlify](https://img.shields.io/badge/Deploy-Netlify-00C7B7)

## ✨ Features

- 🎨 **Beautiful Modern UI** - Dark theme with glassmorphism effects and smooth animations
- 📤 **Drag & Drop Upload** - Simply drag your receipt images or click to browse
- 🔢 **Smart Numbering** - Automatically extracts receipt numbers from filenames
- 📄 **PDF Generation** - Creates organized A4 PDFs with 2x2 grid layout
- 📱 **Responsive Design** - Works perfectly on desktop, tablet, and mobile
- ⚡ **Client-Side Processing** - All processing happens in your browser, no server needed
- 🌐 **Easy Deployment** - Deploy to Netlify in seconds

## 🚀 Quick Start

### Option 1: Use Locally

1. Clone or download this repository
2. Open `index.html` in your web browser
3. Start uploading receipt images!

### Option 2: Deploy to Netlify

#### Method A: Drag & Drop (Easiest)

1. Go to [Netlify Drop](https://app.netlify.com/drop)
2. Drag the entire project folder onto the page
3. Your site is live! 🎉

#### Method B: Using Netlify CLI

```bash
# Install Netlify CLI (one time only)
npm install -g netlify-cli

# Navigate to project directory
cd "For expenses Clearing"

# Deploy to Netlify
netlify deploy --prod
```

#### Method C: Connect to Git

1. Push your code to GitHub
2. Go to [Netlify](https://app.netlify.com)
3. Click "New site from Git"
4. Select your repository
5. Click "Deploy site"

## 📖 How to Use

1. **Upload Images**: Drag and drop your receipt images or click the upload zone
2. **Preview**: Review your uploaded images with automatic receipt numbers
3. **Generate PDF**: Click "Generate PDF" to create your organized document
4. **Download**: Your PDF will automatically download with today's date

### Receipt Number Detection

The app automatically extracts receipt numbers from filenames:
- `Receipt No 123.jpg` → Receipt No: 123
- `receipt_no_456.png` → Receipt No: 456
- `789_expense.jpg` → Receipt No: 789
- If no number is found, images are numbered sequentially

## 🎯 Layout Features

- **2x2 Grid**: Up to 4 receipts per A4 page
- **Smart Spacing**: Landscape images automatically span 2 columns
- **Automatic Pagination**: Creates multiple pages as needed
- **Clear Captions**: Receipt numbers displayed below each image

## 🛠️ Technology Stack

- **HTML5** - Semantic markup
- **CSS3** - Modern styling with animations
- **JavaScript** - Client-side processing
- **jsPDF** - PDF generation library
- **Google Fonts** - Inter font family

## 📁 Project Structure

```
For expenses Clearing/
├── index.html          # Main HTML file
├── style.css           # Styling and animations
├── app.js              # Application logic
├── netlify.toml        # Netlify configuration
├── images/             # Place your receipt images here (for local use)
└── README.md           # This file
```

## 🔧 Browser Compatibility

- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Mobile browsers

## 💡 Tips

- Use high-resolution images for best PDF quality
- Name your files with receipt numbers for automatic detection
- The app works completely offline after initial load
- No data is sent to any server - everything stays in your browser

## 🐛 Troubleshooting

**Images not uploading?**
- Ensure files are valid image formats (JPG, PNG, GIF, BMP)
- Check browser console for errors

**PDF not generating?**
- Make sure JavaScript is enabled
- Try using a modern browser (Chrome, Firefox, Safari)

**Layout issues?**
- Clear browser cache and reload
- Try a different browser

## 📝 License

Free to use and modify for personal and commercial projects.

---

**Previous Python Version**: The original Python script (`image_to_pdf.py`) is still available in this repository for reference or local command-line use.

Built with ❤️ for easy expense management

