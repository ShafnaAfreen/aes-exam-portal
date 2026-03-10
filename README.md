# AES Exam Portal

A secure online exam portal that uses **AES-GCM encryption** and **StegaStamp watermarking** to protect exam content and prevent unauthorized sharing of question papers.

---

## Project Structure

```
aes-exam-portal/
├── backend/          # Flask REST API (authentication, exam management)
├── frontend/         # React + Vite frontend
└── stegastamp_service/
    └── StegaStamp/   # StegaStamp ML model (cloned from original repo)
```

---

## ⚠️ Pretrained Model Files (Required — Not Included in Repo)

The StegaStamp pretrained models are **not included** in this repository due to their large size (~320 MB total). You must download them manually before running the service.

### Download Links

| Model | Source | Extract To |
|-------|--------|-----------|
| `stegastamp_pretrained` (encoder) | [StegaStamp Google Drive](https://drive.google.com/drive/folders/1lchnGUBE_zJFnO-4C7kbvJdHREiSJuA6) | `stegastamp_service/StegaStamp/saved_models/` |
| `stegastamp_detector` (decoder) | [StegaStamp Google Drive](https://drive.google.com/drive/folders/1lchnGUBE_zJFnO-4C7kbvJdHREiSJuA6) | `stegastamp_service/StegaStamp/detector_models/` |

> The original StegaStamp project and its model weights can be found at:  
> 🔗 https://github.com/tancik/StegaStamp

### Expected directory structure after download

```
stegastamp_service/StegaStamp/
├── saved_models/
│   └── stegastamp_pretrained/
│       ├── saved_model.pb
│       └── variables/
└── detector_models/
    └── stegastamp_detector/
        ├── saved_model.pb
        └── variables/
```

---

## Setup

### 1. Backend (Flask)

```bash
cd backend
pip install -r requirements.txt   # if requirements.txt exists
python app.py
```

### 2. StegaStamp Service

> Requires Python 3.7 and TensorFlow 1.x (see `stegastamp_service/StegaStamp/requirements.txt`).

```bash
cd stegastamp_service

# Create and activate a Python 3.7 virtual environment
python -m venv venv_37
venv_37\Scripts\activate          # Windows
# source venv_37/bin/activate     # macOS/Linux

pip install -r StegaStamp/requirements.txt
python app.py
```

### 3. Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

---

## Environment Variables

Create a `.env` file in `backend/` with the following (never commit this file):

```
SECRET_KEY=your_secret_key_here
AES_KEY=your_aes_key_here
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, Vite |
| Backend | Python, Flask |
| Watermarking | StegaStamp (TensorFlow 1.x) |
| Encryption | AES-GCM |
| Database | SQLite |
