for id in 243-4258 243-4462 243-4666 243-3170 243-3378 243-3586 243-4870 243-5074; do
  echo "Extracting $id..."
  npx tsx figma-1on1parity/extract-screen.ts HZaVuwWn6B6jOjrmxZ7Kzv $id > /dev/null 2>&1
done
