import re

# Fix otp.tsx
with open('app/(auth)/otp.tsx', 'r') as f:
    c = f.read()
c = c.replace("import { colors } from '@/src/theme';\n", "", 1)
with open('app/(auth)/otp.tsx', 'w') as f:
    f.write(c)

# Fix payment-methods.tsx
with open('app/(profile)/payment-methods.tsx', 'r') as f:
    c = f.read()
c = c.replace("import { colors } from '@/src/theme';\n", "", 1)
with open('app/(profile)/payment-methods.tsx', 'w') as f:
    f.write(c)

# Fix invite-landlord.tsx
with open('app/(setup)/invite-landlord.tsx', 'r') as f:
    c = f.read()
c = c.replace("import { Screen,Screen,", "import { Screen,")
with open('app/(setup)/invite-landlord.tsx', 'w') as f:
    f.write(c)

