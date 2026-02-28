const fs = require('fs');

// Fix index.tsx parameter types
const idxPath = './rn-app/app/(main)/index.tsx';
if (fs.existsSync(idxPath)) {
  let idxCode = fs.readFileSync(idxPath, 'utf8');
  idxCode = idxCode.replace(/const paymentMethodRenderer = useCallback\(\(method\)/g, 'const paymentMethodRenderer = useCallback((method: any)');
  idxCode = idxCode.replace(/renderItem=\{useCallback\(\(\{ item: p \}\)/g, 'renderItem={useCallback(({ item: p }: { item: any })');
  
  // Fix yearlyStamps typing issue
  idxCode = idxCode.replace(/status: 'paid', \/\/ For verified tenants we act like we've seen it paid\n\s*yearlyStamps: \['paid', 'paid', 'paid'\],/g, `status: 'paid',
              yearlyStamps: ['paid' as const, 'paid' as const, 'paid' as const],`);
  idxCode = idxCode.replace(/status: 'paid',\n\s*yearlyStamps: \['paid'\],/g, `status: 'paid',
              yearlyStamps: ['paid' as const],`);
              
  idxCode = idxCode.replace(/status: 'upcoming',\n\s*yearlyStamps: \['paid', 'upcoming', 'missed', 'upcoming', 'upcoming'\],/g, `status: 'upcoming' as const,
              yearlyStamps: ['paid' as const, 'upcoming' as const, 'missed' as const, 'upcoming' as const, 'upcoming' as const],`);
  idxCode = idxCode.replace(/status: 'paid',\n\s*yearlyStamps: \['paid', 'paid', 'paid'\],/g, `status: 'paid' as const,
              yearlyStamps: ['paid' as const, 'paid' as const, 'paid' as const],`);
  idxCode = idxCode.replace(/status: 'missed',\n\s*yearlyStamps: \['missed', 'late', 'missed'\],/g, `status: 'missed' as const,
              yearlyStamps: ['missed' as const, 'late' as const, 'missed' as const],`);

  fs.writeFileSync(idxPath, idxCode);
}

// Fix edit-payment-method.tsx parameter types
const editPath = './rn-app/app/(profile)/edit-payment-method.tsx';
if (fs.existsSync(editPath)) {
  let editCode = fs.readFileSync(editPath, 'utf8');
  editCode = editCode.replace(/\(m\) => m\.id === instrument\.id/g, '(m: any) => m.id === instrument.id');
  editCode = editCode.replace(/\(m\) => m\.id === method\.id/g, '(m: any) => m.id === method.id');
  fs.writeFileSync(editPath, editCode);
}

// Fix profile/index.tsx parameter types
const profPath = './rn-app/app/(profile)/index.tsx';
if (fs.existsSync(profPath)) {
  let profCode = fs.readFileSync(profPath, 'utf8');
  profCode = profCode.replace(/\(m\) => m\.type === 'upi'/g, '(m: any) => m.type === \'upi\'');
  profCode = profCode.replace(/\(m\) => m\.type === 'card'/g, '(m: any) => m.type === \'card\'');
  profCode = profCode.replace(/\(m\) => m\.type === 'debit_card'/g, '(m: any) => m.type === \'debit_card\'');
  profCode = profCode.replace(/\(m\) => m\.type === 'netbanking'/g, '(m: any) => m.type === \'netbanking\'');
  profCode = profCode.replace(/\(m\) => \(\n\s*<View key=\{m\.id\} style=\{s\.detailCard\}\>/g, '(m: any) => (\n                      <View key={m.id} style={s.detailCard}>');
  fs.writeFileSync(profPath, profCode);
}
