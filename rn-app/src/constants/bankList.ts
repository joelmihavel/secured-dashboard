/**
 * PayU Net Banking Bank List
 *
 * Static list of banks with their PayU bank codes.
 * Top banks marked with isPopular for the horizontal picker section.
 *
 * Bank codes from PayU documentation:
 * https://docs.payu.in/reference/net-banking-codes
 */

export interface BankInfo {
  code: string;
  name: string;
  shortName?: string;
  isPopular: boolean;
}

export const BANK_LIST: BankInfo[] = [
  // Popular banks (shown in horizontal section)
  { code: 'SBIB', name: 'State Bank of India', shortName: 'SBI', isPopular: true },
  { code: 'HDFB', name: 'HDFC Bank', shortName: 'HDFC', isPopular: true },
  { code: 'ICIB', name: 'ICICI Bank', shortName: 'ICICI', isPopular: true },
  { code: 'AXIB', name: 'Axis Bank', shortName: 'Axis', isPopular: true },
  { code: 'KTKB', name: 'Kotak Mahindra Bank', shortName: 'Kotak', isPopular: true },

  // Full list (alphabetical)
  { code: 'ALLA', name: 'Allahabad Bank', isPopular: false },
  { code: 'ANDB', name: 'Andhra Bank', isPopular: false },
  { code: 'BBKM', name: 'Bank of Baroda', isPopular: false },
  { code: 'BKID', name: 'Bank of India', isPopular: false },
  { code: 'MAHB', name: 'Bank of Maharashtra', isPopular: false },
  { code: 'CNRB', name: 'Canara Bank', isPopular: false },
  { code: 'CSBK', name: 'Catholic Syrian Bank', isPopular: false },
  { code: 'CIUB', name: 'City Union Bank', isPopular: false },
  { code: 'DCBB', name: 'DCB Bank', isPopular: false },
  { code: 'DLXB', name: 'Dhanlaxmi Bank', isPopular: false },
  { code: 'FDRL', name: 'Federal Bank', isPopular: false },
  { code: 'IDBIB', name: 'IDBI Bank', isPopular: false },
  { code: 'IDFC', name: 'IDFC First Bank', isPopular: false },
  { code: 'INDB', name: 'IndusInd Bank', isPopular: false },
  { code: 'IOBA', name: 'Indian Overseas Bank', isPopular: false },
  { code: 'JAKA', name: 'Jammu & Kashmir Bank', isPopular: false },
  { code: 'KRVB', name: 'Karur Vysya Bank', isPopular: false },
  { code: 'LAVB', name: 'Lakshmi Vilas Bank', isPopular: false },
  { code: 'OBCB', name: 'Oriental Bank of Commerce', isPopular: false },
  { code: 'PNBB', name: 'Punjab National Bank', isPopular: false },
  { code: 'PSBB', name: 'Punjab & Sind Bank', isPopular: false },
  { code: 'RATN', name: 'RBL Bank', isPopular: false },
  { code: 'SRCB', name: 'Saraswat Co-op Bank', isPopular: false },
  { code: 'SVCB', name: 'Shamrao Vithal Co-op Bank', isPopular: false },
  { code: 'SOIB', name: 'South Indian Bank', isPopular: false },
  { code: 'TMBB', name: 'Tamilnad Mercantile Bank', isPopular: false },
  { code: 'UCOB', name: 'UCO Bank', isPopular: false },
  { code: 'UNIB', name: 'Union Bank of India', isPopular: false },
  { code: 'UBIN', name: 'United Bank of India', isPopular: false },
  { code: 'YESB', name: 'Yes Bank', isPopular: false },
];

export const POPULAR_BANKS = BANK_LIST.filter((b) => b.isPopular);

/**
 * Search banks by name or code (case-insensitive substring match).
 */
export function searchBanks(query: string): BankInfo[] {
  if (!query.trim()) return BANK_LIST;
  const lower = query.toLowerCase().trim();
  return BANK_LIST.filter(
    (b) =>
      b.name.toLowerCase().includes(lower) ||
      b.code.toLowerCase().includes(lower) ||
      (b.shortName && b.shortName.toLowerCase().includes(lower)),
  );
}
