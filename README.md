# Subvert

Transform any webpage into a clean, distraction-free reading experience with a simple bookmarklet.

![Demo of clean view transformation](https://github.com/user-attachments/assets/b78c8b96-08cb-4ba8-9f9f-98b7ead2a2bf)

## Features

- One-click activation
- Removes ads, navigation, footers, and distractions
- Smart content detection
- Dark mode toggle
- Responsive design
- No external dependencies
- Works on any website

## Usage

1. Visit [Subvert.site](https://subvert.site)
2. Drag the "Clean View" button to your bookmarks bar
3. Visit any article or content-heavy webpage
4. Click the bookmark to transform the page
5. Use the restore button to return to the original page

## How It Works

Subvert uses advanced content detection algorithms to identify the main content of a webpage:

1. Searches for common article selectors
2. Analyzes text density and content structure
3. Evaluates content scoring based on:
   - Text length
   - Paragraph count
   - Image presence
   - Element positioning
   - Semantic markers

## Development

```bash
git clone https://github.com/yourusername/subvert.git
cd subvert
```

The project consists of a single `index.html` file containing all necessary HTML, CSS, and JavaScript.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/improvement`)
3. Commit your changes (`git commit -am 'Add improvement'`)
4. Push to the branch (`git push origin feature/improvement`)
5. Open a Pull Request

## Technical Details

- Vanilla JavaScript
- No external dependencies
- CSS Custom Properties for theming
- System font stack for optimal performance
- Mobile-responsive design
