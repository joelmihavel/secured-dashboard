import re
import os

filepath = 'app/(setup)/add-bank.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

success_view = re.compile(r"\{\s*verificationResult\?\.verified\s*&&\s*\(\s*<View style=\{styles\.successBanner\}>\s*<Text style=\{styles\.successBannerText\}>\s*Bank verified\{verificationResult\.bankName \? ` - \$\{verificationResult\.bankName\}` : ''\}\s*\{verificationResult\.branch \? `, \$\{verificationResult\.branch\}` : ''\}\s*</Text>\s*</View>\s*\)\s*\}")

replacement = r"""{verificationResult?.verified && (
            <AlertBanner 
              type="success" 
              message={`Bank verified${verificationResult.bankName ? ` - ${verificationResult.bankName}` : ''}${verificationResult.branch ? `, ${verificationResult.branch}` : ''}`} 
            />
          )}"""

content = success_view.sub(replacement, content)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
