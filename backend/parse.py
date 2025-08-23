import pdfplumber
import json
import sys

def parse_pdf_to_json(filepath):
    try:
        pdf_data = {}
        with pdfplumber.open(filepath) as pdf:
            for page_num, page in enumerate(pdf.pages, start=1):
                page_text = page.extract_text()
                if page_text:  
                    pdf_data[page_num] = page_text.strip()
                else:
                    pdf_data[page_num] = ""  
        

        print(json.dumps(pdf_data, ensure_ascii=False))
    
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    pdf_path = sys.argv[1]
    parse_pdf_to_json(pdf_path)
