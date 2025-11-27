# nopamine 智商税检测器

## Overview
nopamine is a tool for detecting and analyzing "stupid tax", designed to help users identify and avoid unnecessary expenses.

nopamine 是一个用于检测和分析智商税的工具，旨在帮助用户识别和避免不必要的支出。

## Setup

```bash
# Clone the repository
git clone <repository-url>
cd nopamine

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment configuration
cp .env .env.local
# Edit .env.local with your actual configuration
```

## Development

```bash
# Activate virtual environment
source venv/bin/activate

# Run the application
python main.py
```

## Project Structure

```
nopamine/
├── .env              # Environment template (committed)
├── .env.local        # Your local config (not committed)
├── .gitignore
├── README.md
└── code-practice.md  # Coding standards reference
```

## Resources

- See `code-practice.md` for coding standards
- See `code-eval.md` for code review criteria
