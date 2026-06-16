import os
import urllib.request
import xml.etree.ElementTree as ET
import re
from datetime import datetime
from html.parser import HTMLParser
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# Cache for updates
_cache = {
    "updates": [],
    "last_fetched": None
}

class ReleaseNotesParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.updates = []
        self.current_type = None
        self.current_html_chunks = []
        self.current_text_chunks = []
        self.in_h3 = False
        self.temp_h3_text = ""
        
    def handle_starttag(self, tag, attrs):
        if tag == 'h3':
            self._save_current_update()
            self.in_h3 = True
            self.temp_h3_text = ""
        else:
            # Reconstruct HTML tag with attributes
            attr_parts = []
            for k, v in attrs:
                if v is not None:
                    # Clean/ensure safe attribute value
                    v_esc = v.replace('"', '&quot;')
                    attr_parts.append(f'{k}="{v_esc}"')
                else:
                    attr_parts.append(k)
            attr_str = " " + " ".join(attr_parts) if attr_parts else ""
            self.current_html_chunks.append(f"<{tag}{attr_str}>")

    def handle_endtag(self, tag):
        if tag == 'h3':
            self.in_h3 = False
            self.current_type = self.temp_h3_text.strip()
        else:
            self.current_html_chunks.append(f"</{tag}>")

    def handle_data(self, data):
        if self.in_h3:
            self.temp_h3_text += data
        else:
            self.current_html_chunks.append(data)
            self.current_text_chunks.append(data)
            
    def _save_current_update(self):
        # Only save if we have parsed html or a type
        if self.current_type or self.current_html_chunks:
            html_content = "".join(self.current_html_chunks).strip()
            # Clean up whitespace in text content
            text_content = re.sub(r'\s+', ' ', "".join(self.current_text_chunks)).strip()
            
            # Default type to 'Update' if h3 wasn't present yet
            update_type = self.current_type if self.current_type else "Update"
            
            self.updates.append({
                'type': update_type,
                'html': html_content,
                'text': text_content
            })
            
            self.current_html_chunks = []
            self.current_text_chunks = []
            
    def parse_content(self, html_content):
        self.updates = []
        self.current_type = None
        self.current_html_chunks = []
        self.current_text_chunks = []
        self.in_h3 = False
        self.feed(html_content)
        self._save_current_update() # save last remaining item
        return self.updates

def fetch_and_parse_feed(force=False):
    global _cache
    
    # If cache exists and we are not forcing a refresh, return it
    if not force and _cache["updates"] and _cache["last_fetched"]:
        return _cache["updates"], _cache["last_fetched"], None
        
    url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    try:
        # Set a header to look like a friendly user agent
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) BigQueryReleaseNotesFetcher/1.0'}
        )
        with urllib.request.urlopen(req, timeout=15) as response:
            xml_data = response.read()
            
        root = ET.fromstring(xml_data)
        
        # Detect namespace
        ns = ""
        if root.tag.startswith("{"):
            ns = root.tag.split("}")[0] + "}"
            
        entries = root.findall(f"{ns}entry")
        parser = ReleaseNotesParser()
        all_updates = []
        
        for entry in entries:
            title_elem = entry.find(f"{ns}title")
            date_str = title_elem.text.strip() if title_elem is not None else "Unknown Date"
            
            updated_elem = entry.find(f"{ns}updated")
            updated_iso = updated_elem.text.strip() if updated_elem is not None else ""
            
            link_elem = entry.find(f"{ns}link")
            link = link_elem.attrib.get('href', '').strip() if link_elem is not None else ""
            
            content_elem = entry.find(f"{ns}content")
            content_html = content_elem.text if content_elem is not None else ""
            
            # Split the entry's html content into individual updates
            individual_notes = parser.parse_content(content_html)
            for idx, note in enumerate(individual_notes):
                # Unique ID for UI selection & actions
                # Constructed using the date, type, and index
                safe_date = re.sub(r'[^a-zA-Z0-9]', '_', date_str)
                safe_type = re.sub(r'[^a-zA-Z0-9]', '_', note['type'])
                note_id = f"upd_{safe_date}_{safe_type}_{idx}"
                
                all_updates.append({
                    'id': note_id,
                    'date': date_str,
                    'updated_iso': updated_iso,
                    'link': link,
                    'type': note['type'],
                    'html': note['html'],
                    'text': note['text']
                })
                
        # Update cache
        _cache["updates"] = all_updates
        _cache["last_fetched"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return _cache["updates"], _cache["last_fetched"], None
        
    except Exception as e:
        # Return error and previous cache if exists
        return _cache["updates"], _cache["last_fetched"], str(e)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/updates')
def get_updates():
    # Allow force refreshing via query param ?refresh=true
    force = request.args.get('refresh', 'false').lower() == 'true'
    updates, last_fetched, error = fetch_and_parse_feed(force=force)
    
    response_data = {
        "updates": updates,
        "last_fetched": last_fetched,
        "success": error is None
    }
    if error:
        response_data["error"] = error
        
    return jsonify(response_data)

if __name__ == '__main__':
    # Listen on port 8080
    app.run(debug=True, host='0.0.0.0', port=8080)
