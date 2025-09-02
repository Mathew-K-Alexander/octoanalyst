import os
import re
import string
import sys
import unidecode
import json
from pdfminer.pdfdocument import PDFDocument
from pdfminer.pdfpage import PDFPage
from pdfminer.pdfparser import PDFParser
from pdfminer.pdfinterp import PDFResourceManager, PDFPageInterpreter
from pdfminer.converter import PDFPageAggregator
from pdfminer.layout import LAParams, LTChar, LTTextBox, LTTextLine

MIN_CHARS = 6
MAX_WORDS = 20
MAX_CHARS = MAX_WORDS * 10
TOLERANCE = 1e-6


def sanitize(text):
    words = text.split()
    text = ' '.join(words[:MAX_WORDS])
    if len(text) > MAX_CHARS:
        text = text[:MAX_CHARS]
    try:
        text = unidecode.unidecode(text.encode('utf-8').decode('utf-8'))
    except UnicodeDecodeError:
        pass
    text = re.sub(r',', ' ', text)
    text = re.sub(r': ', ' - ', text)
    text = re.sub(r'\.pdf(\.pdf)*$', '', text)
    text = re.sub(r'[ \t][ \t]*', ' ', text)
    valid_chars = "-_.() %s%s" % (string.ascii_letters, string.digits)
    return ''.join(c for c in text if c in valid_chars)


def empty_str(s):
    return len(s.strip()) == 0


def is_close(a, b, rel_tol=TOLERANCE):
    return abs(a - b) <= rel_tol * max(abs(a), abs(b))


def update_largest_text(line, y0, size, largest_text):
    line = re.sub(r'\n$', ' ', line)
    if (size == largest_text['size'] == 0) and (y0 - largest_text['y0'] < -TOLERANCE):
        return largest_text
    if (size - largest_text['size'] > TOLERANCE):
        return {'contents': line, 'y0': y0, 'size': size}
    elif is_close(size, largest_text['size']):
        largest_text['contents'] += line
        largest_text['y0'] = y0
    return largest_text


def extract_largest_text(obj, largest_text):
    for i, child in enumerate(obj):
        if isinstance(child, LTTextLine):
            for j, child2 in enumerate(child):
                if j > 1 and isinstance(child2, LTChar):
                    largest_text = update_largest_text(child.get_text(), child2.y0, child2.size, largest_text)
                    break
        elif i > 1 and isinstance(child, LTChar):
            largest_text = update_largest_text(obj.get_text(), child.y0, child.size, largest_text)
            break
    return largest_text


def junk_line(line):
    line = line.strip()
    too_small = len(line) < MIN_CHARS
    is_placeholder = bool(re.search(r'^[0-9 \t-]*(abstract|introduction)?\s*$|^(abstract|title|untitled):?$', line.lower()))
    is_junk = bool(re.search(r'paper\s+title|technical\s+report|proceedings|symposium|transactions|downloaded\s+from', line.lower()))
    ascii_ratio = len(''.join(c for c in line if c in string.ascii_letters)) / max(1, len(line.replace(' ', '')))
    return too_small or is_placeholder or is_junk or ascii_ratio < 0.5


def valid_title(title):
    return not empty_str(title) and not junk_line(title) and empty_str(os.path.splitext(title)[1])


def extract_pdf_to_json(filename):
    with open(filename, 'rb') as fp:
        parser = PDFParser(fp)
        doc = PDFDocument(parser)
        parser.set_document(doc)
        rsrcmgr = PDFResourceManager()
        laparams = LAParams()
        device = PDFPageAggregator(rsrcmgr, laparams=laparams)
        interpreter = PDFPageInterpreter(rsrcmgr, device)

        result = {}
        for page_number, page in enumerate(PDFPage.create_pages(doc), 1):
            interpreter.process_page(page)
            layout = device.get_result()
            largest_text = {'contents': '', 'y0': 0, 'size': 0}
            page_text_parts = []

            for lt_obj in layout:
                if isinstance(lt_obj, (LTTextBox, LTTextLine)):
                    text = lt_obj.get_text().strip()
                    if text:
                        page_text_parts.append(text)
                    stripped = re.sub(r'[ \t\n]', '', text)
                    if len(stripped) > MAX_CHARS * 2:
                        continue
                    largest_text = extract_largest_text(lt_obj, largest_text)

            title = largest_text['contents'].strip()
            title = re.sub(r'\.', '', title)
            title = re.sub(r'[\t\n]', '', title)
            clean_title = sanitize(title) if valid_title(title) else f"{os.path.splitext(os.path.basename(filename))[0]}_Page{page_number}"

            result[f"Page {page_number}"] = {
                "title": clean_title,
                "content": " ".join(page_text_parts)
            }
        return result


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(f"Usage: python {sys.argv[0]} yourfile.pdf")
        sys.exit(1)

    filename = sys.argv[1]
    data = extract_pdf_to_json(filename)
    print(json.dumps(data, indent=2, ensure_ascii=False))
