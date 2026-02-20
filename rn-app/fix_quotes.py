import os
for file in ['app/(setup)/add-bank.tsx', 'app/(setup)/invite-landlord.tsx', 'app/(setup)/add-utility.tsx']:
    with open(file, 'r') as f:
        content = f.read()
    content = content.replace('type=\\"error\\"', 'type="error"').replace('type=\\"success\\"', 'type="success"')
    content = content.replace('message=\\"', 'message="').replace('\\" />}', '" />}')
    with open(file, 'w') as f:
        f.write(content)
