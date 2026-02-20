import re

filepath = 'app/(setup)/invite-landlord.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

pattern = re.compile(r"\{\s*inviteSent\s*&&\s*\(\s*<View style=\{styles\.successBanner\}>\s*<Text style=\{styles\.successBannerText\}>\s*Invite sent successfully\s*</Text>\s*</View>\s*\)\s*\}")
content = pattern.sub(r"{inviteSent && <AlertBanner type=\"success\" message=\"Invite sent successfully\" />}", content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
