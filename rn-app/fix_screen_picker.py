import re

file = 'app/(dev)/screen-picker.tsx'
with open(file, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace fontWeight with fontFamily equivalents
replacements = [
    (r"fontWeight: '700'", r"fontFamily: 'PlusJakartaSans-Bold'"),
    (r"fontWeight: '600'", r"fontFamily: 'PlusJakartaSans-SemiBold'"),
    (r"fontWeight: '300'", r"fontFamily: 'PlusJakartaSans-Light'"),
    (r"fontWeight: '500'", r"fontFamily: 'PlusJakartaSans-Medium'"),
]

for old, new in replacements:
    content = re.sub(old, new, content)

with open(file, 'w', encoding='utf-8') as f:
    f.write(content)
