from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import docx
from pdfminer.high_level import extract_text

app = Flask(__name__)
CORS(app)

UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

@app.route('/', methods=['GET'])
def home():
    return jsonify({"message": "SmartHire backend is running!"})

def extract_text_from_docx(path):
    doc = docx.Document(path)
    return '\n'.join([para.text for para in doc.paragraphs])

def extract_text_from_pdf(path):
    return extract_text(path)

@app.route('/upload', methods=['POST'])
def upload_resume():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400

    file = request.files['file']
    filename = file.filename
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    file.save(filepath)

    if filename.endswith('.docx'):
        text = extract_text_from_docx(filepath)
    elif filename.endswith('.pdf'):
        text = extract_text_from_pdf(filepath)
    else:
        return jsonify({'error': 'Unsupported file type'}), 400

    return jsonify({'text': text})

if __name__ == '__main__':
    app.run(debug=True)

