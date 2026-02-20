with open('app/(setup)/invite-landlord.tsx', 'r') as f:
    c = f.read()
c = c.replace(r'type=\"success\" message=\"Invite sent successfully\"', 'type="success" message="Invite sent successfully"')
with open('app/(setup)/invite-landlord.tsx', 'w') as f:
    f.write(c)
