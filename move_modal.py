import re

with open('e:/outputs/Antigravity/Wolfhome/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Extract the modal inner content
modal_pattern = re.compile(r'<div id="settings-modal".*?<div class="settings-container">(.*?)</div>\s*<!-- Footer -->\s*(<div class="p-6 border-t.*?)</div>\s*</div>\s*</div>', re.DOTALL)
match = modal_pattern.search(html)
if not match:
    print('Modal not found')
    exit(1)

inner_container = match.group(1)
footer = match.group(2)

new_settings_content = f'''                <div id="settings-content" class="glass rounded-[2rem] flex flex-col h-[780px] overflow-hidden hidden">
                    <div class="settings-container flex-1">{inner_container}</div>
                    <!-- Footer -->
                    {footer}</div>
                </div>'''

# Remove the old modal
html = html[:match.start()] + html[match.end():]

# Insert after news-content
# Find end of news-content
news_end_pattern = re.compile(r'<div id="news-content".*?</div>\s*</div>\s*</div>', re.DOTALL)
news_match = news_end_pattern.search(html)
if not news_match:
    print('News content not found')
    exit(1)

html = html[:news_match.end()] + '\n\n' + new_settings_content + html[news_match.end():]

with open('e:/outputs/Antigravity/Wolfhome/index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('Success')
