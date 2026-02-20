import re
import os

def replace_banner_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Add AlertBanner to imports from @/src/components
    if 'AlertBanner' not in content:
        content = re.sub(
            r"(import \{[^}]+)(Screen,)([^}]+\} from '@/src/components';)",
            r"\1Screen,\2 AlertBanner,\3",
            content
        )
        if original == content:
             content = re.sub(
                 r"(import \{)([^}]+\} from '@/src/components';)",
                 r"\1 AlertBanner, \2",
                 content
             )
    
    # Replace error banner view
    error_view = re.compile(r"\{\s*apiError\s*&&\s*\(\s*<View style=\{styles\.errorBanner\}>\s*<Text style=\{styles\.errorBannerText\}>\{apiError\}</Text>\s*</View>\s*\)\s*\}")
    content = error_view.sub(r"{apiError && <AlertBanner type=\"error\" message={apiError} />}", content)
    
    # Replace error view if the condition is just `error`
    error2_view = re.compile(r"\{\s*error\s*&&\s*\(\s*<View style=\{styles\.errorBanner\}>\s*<Text style=\{styles\.errorBannerText\}>\{error\}</Text>\s*</View>\s*\)\s*\}")
    content = error2_view.sub(r"{error && <AlertBanner type=\"error\" message={error} />}", content)

    # Replace success banner view
    success_view = re.compile(r"\{\s*verificationResult\?\.verified\s*&&\s*\(\s*<View style=\{styles\.successBanner\}>\s*<Text style=\{styles\.successBannerText\}>Bank account verified successfully!</Text>\s*</View>\s*\)\s*\}")
    content = success_view.sub(r"{verificationResult?.verified && <AlertBanner type=\"success\" message=\"Bank account verified successfully!\" />}", content)

    success_view2 = re.compile(r"\{\s*successMessage\s*&&\s*\(\s*<View style=\{styles\.successBanner\}>\s*<Text style=\{styles\.successBannerText\}>\{successMessage\}</Text>\s*</View>\s*\)\s*\}")
    content = success_view2.sub(r"{successMessage && <AlertBanner type=\"success\" message={successMessage} />}", content)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

replace_banner_in_file('app/(setup)/add-bank.tsx')
replace_banner_in_file('app/(setup)/invite-landlord.tsx')
replace_banner_in_file('app/(setup)/add-utility.tsx')
