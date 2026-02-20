import re

files = ['app/(setup)/add-bank.tsx', 'app/(setup)/invite-landlord.tsx', 'app/(setup)/add-utility.tsx']

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Remove error banner blocks
    content = re.sub(r"\s*// Error banner\s*errorBanner:\s*\{[^}]+\},", "", content)
    content = re.sub(r"\s*errorBannerText:\s*\{[^}]+\},", "", content)

    # Remove success banner blocks
    content = re.sub(r"\s*// Success banner\s*successBanner:\s*\{[^}]+\},", "", content)
    content = re.sub(r"\s*successBannerText:\s*\{[^}]+\},?", "", content)

    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)

