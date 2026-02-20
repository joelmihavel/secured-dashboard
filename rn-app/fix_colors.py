import os
import re

color_map = {
    '#000000': 'colors.black[900]',
    '#0D0D0D': 'colors.black[800]',
    '#131313': 'colors.black[700]',
    '#1A1A1A': 'colors.black[600]',
    '#202020': 'colors.black[500]',
    '#4D4D4D': 'colors.black[400]',
    '#656565': 'colors.black[350]',
    '#797979': 'colors.black[300]',
    '#A6A6A6': 'colors.black[200]',
    '#EEEEEE': 'colors.neutral[100]',
    '#DDDDDD': 'colors.neutral[200]',
    '#CBCBCB': 'colors.neutral[300]',
    '#BABABA': 'colors.neutral[400]',
    '#A9A9A9': 'colors.neutral[500]',
    '#878787': 'colors.neutral[600]',
    '#444444': 'colors.neutral[800]',
    '#222222': 'colors.neutral[900]',
    '#FFCC8A': 'colors.brand[300]',
    '#FFAE8A': 'colors.brand[400]',
    '#FF9A6D': 'colors.brand[500]',
    '#CC7B57': 'colors.brand[600]',
    '#F06321': 'colors.brand[700]',
    '#E9661C': 'colors.brand[800]',
    '#70BF73': 'colors.success.default',
    '#06C270': 'colors.success.approved',
    '#27803B': 'colors.success.dark',
    '#4CAF50': 'colors.success.material',
    '#46A758': 'colors.success.material', # approximate mapping for add-bank.tsx #46A758
    '#FF8080': 'colors.error.default',
    '#E5484D': 'colors.error.radix',
    '#AE282E': 'colors.error.dark',
    '#FFFFFF': 'colors.white',
}

def walk_dir(directory):
    for root, dirs, files in os.walk(directory):
        if '__tests__' in root: continue
        for file in files:
            if file.endswith('.tsx') or file.endswith('.ts'):
                path = os.path.join(root, file)
                process_file(path)

def process_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    needed_import = False
    
    for hex_code, token in color_map.items():
        # Match case insensitive hex
        pattern = re.compile(rf"(?i)'{hex_code}'")
        if pattern.search(content):
            needed_import = True
            content = pattern.sub(token, content)

    if needed_import and original_content != content:
        # ensure import is added if colors is not imported
        if 'import { colors } from' not in content and 'import {colors} from' not in content:
            # find last import
            last_import = content.rfind("import ")
            end_of_last_import = content.find(";\n", last_import)
            if end_of_last_import != -1:
                insert_pos = end_of_last_import + 2
                content = content[:insert_pos] + "import { colors } from '@/src/theme';\n" + content[insert_pos:]
            else:
                content = "import { colors } from '@/src/theme';\n" + content

        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {path}")

walk_dir('app')
