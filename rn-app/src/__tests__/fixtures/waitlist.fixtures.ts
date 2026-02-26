/**
 * Test fixtures for Waitlist Screens
 * Source: app/(waitlist)/index.tsx (main screen) and app/(waitlist)/approved.tsx (approved screen)
 * Figma Nodes: 41-11206 (pending), 41-11506 (pending_long), 41-11410 (rejected), 41-11313 (approved)
 * Routes: /(waitlist)/ and /(waitlist)/approved
 *
 * The Waitlist screens handle multiple states:
 *   - loading: Initial skeleton while fetching status
 *   - pending: Position in queue with timeline and referral input
 *   - pending_long: Extended wait state with additional messaging
 *   - approved: Celebration screen with "Step Inside" CTA
 *   - rejected: Rejection messaging with reasons and countdown
 *   - error: Error display with retry button
 */

// --- Text content from Figma blueprints ---
export const EXPECTED_TEXT = {
  // Main waitlist screen (pending)
  welcomePrefix: 'Welcome,',
  defaultName: 'Rishabh Agnihotri',
  pendingSubtitle: 'Your application is in review',
  pendingLongSubtitle: 'Taking a bit longer than usual. Hang tight!',
  timelineApplicationSent: 'Application Sent',
  timelineInReview: 'In Review',
  timelineAccountStatus: 'Account Status',
  timelinePendingValue: 'Pending',
  inviteLabel: 'Have an Invite Code?',
  inviteDescription: 'Get priority access to the platform if you use a referral code',
  inviteButton: 'Enter Invite Code',

  // Pending long state
  pendingLongTitle: 'setting\nthings up',
  pendingLongDescription: 'Taking a bit longer than usual. Hang tight!',

  // Rejected state
  rejectedTitle: 'We can\'t approve you right now',
  rejectedSubtitle: 'We\'re opening access in batches. Stay tuned.',
  rejectedTimelineValue: 'Rejected',
  rejectionCardTitle: 'Why was I Rejected?',
  rejectionReason1: "You're renting outside Bangalore",
  rejectionReason2: 'You did not use an invite code.',
  contactSupport: 'Contact support',
  countdownPrefix: 'You can try again in next batch, applications open in',

  // Approved screen
  approvedPrefix: 'you\'re all set.',
  approvedSubtitle: 'Welcome to the right side of renting.',
  approvedTimelineValue: 'Accepted',
  stepInsideButton: 'Step Inside',

  // Error state
  errorTitle: 'Oops,',
  errorTitleSuffix: 'something\nwent wrong.',
  errorDefaultMessage: 'We could not load your waitlist status. Please try again.',
  retryButton: 'Try Again',

  // Referral errors
  referralErrorInvalid: 'Invalid referral code',
  referralErrorRequired: 'Please enter a valid referral code (4-10 characters)',
} as const;

// --- Navigation targets ---
export const EXPECTED_NAVIGATION = {
  onApproved: '/(waitlist)/approved',
  onStepInside: '/(setup)',
} as const;

// --- testIDs found in screen code ---
export const TEST_IDS = {
  // Main waitlist screen
  approvedTimeline: 'approved-timeline',
  approvedBenefits: 'approved-benefits',
  stepInsideButton: 'step-inside-button',
} as const;

// --- Mock waitlist data for various states ---
export const MOCK_WAITLIST_DATA = {
  pending: {
    position: 4217,
    submissionDate: 'Dec 12, 2025',
    estimatedReviewTime: 'Approximately 2-3 hrs',
    currentOnboarded: 89,
    totalMemberSlots: 150,
    state: 'pending' as const,
    rejectionReasons: [],
    nextApplicationCountdown: 0,
  },
  pendingLong: {
    position: 4217,
    submissionDate: 'Dec 12, 2025',
    estimatedReviewTime: 'Approximately 24-48 hrs',
    currentOnboarded: 89,
    totalMemberSlots: 150,
    state: 'pending_long' as const,
    rejectionReasons: [],
    nextApplicationCountdown: 0,
  },
  approved: {
    position: null,
    submissionDate: 'Dec 12, 2025',
    estimatedReviewTime: 'Completed in 2 hrs',
    currentOnboarded: 89,
    totalMemberSlots: 150,
    state: 'approved' as const,
    rejectionReasons: [],
    nextApplicationCountdown: 0,
  },
  rejected: {
    position: null,
    submissionDate: 'Dec 12, 2025',
    estimatedReviewTime: 'Reviewed in 3 hrs',
    currentOnboarded: 89,
    totalMemberSlots: 150,
    state: 'rejected' as const,
    rejectionReasons: [
      'Your profile does not meet our current criteria',
      'We are prioritizing certain user segments',
    ],
    nextApplicationCountdown: 102264, // 28:24:24 in seconds
  },
} as const;

// --- Screen metadata ---
export const SCREEN_METADATA = {
  mainScreen: {
    screenId: '41-11206',
    route: '/(waitlist)/',
    hasDataFetching: true,
    hasLoadingState: true,
    hasErrorState: true,
    hasEmptyState: false,
    states: ['loading', 'pending', 'pending_long', 'rejected', 'error'],
    interactiveElements: ['referral-input', 'invite-button', 'refresh-control', 'contact-support'],
    exitPoints: ['/(waitlist)/approved', 'back'],
  },
  approvedScreen: {
    screenId: '41-11313',
    route: '/(waitlist)/approved',
    hasDataFetching: false,
    hasLoadingState: false,
    hasErrorState: false,
    hasEmptyState: false,
    states: ['approved'],
    interactiveElements: ['step-inside-button'],
    exitPoints: ['/(agreement)/upload'],
  },
} as const;

// --- useWaitlist hook mock return shapes ---
export const WAITLIST_HOOK_LOADING = {
  userName: 'Rishabh Agnihotri',
  viewState: 'loading' as const,
  status: null,
  isLoading: true,
  isRefetching: false,
  error: null,
  referralCode: ['', '', '', ''],
  isReferralComplete: false,
  isApplyingReferral: false,
  referralApplied: false,
  referralError: null,
  isReferralExpanded: false,
  showConfetti: false,
  countdownText: '',
  joinWaitlist: jest.fn(),
  isJoiningWaitlist: false,
  applyReferral: jest.fn(),
  refresh: jest.fn(),
  setReferralCharacter: jest.fn(),
  toggleReferralExpanded: jest.fn(),
  setReferralExpanded: jest.fn(),
  clearReferralCode: jest.fn(),
  setUserName: jest.fn(),
  reset: jest.fn(),
  myReferralCode: null,
  isLoadingMyCode: false,
  inviteCodeClaimed: false,
  claimInviteCode: jest.fn(),
  isClaimingInviteCode: false,
};

export const WAITLIST_HOOK_PENDING = {
  ...WAITLIST_HOOK_LOADING,
  viewState: 'pending' as const,
  status: MOCK_WAITLIST_DATA.pending,
  isLoading: false,
};

export const WAITLIST_HOOK_PENDING_LONG = {
  ...WAITLIST_HOOK_LOADING,
  viewState: 'pending_long' as const,
  status: MOCK_WAITLIST_DATA.pendingLong,
  isLoading: false,
};

export const WAITLIST_HOOK_APPROVED = {
  ...WAITLIST_HOOK_LOADING,
  viewState: 'approved' as const,
  status: MOCK_WAITLIST_DATA.approved,
  isLoading: false,
  showConfetti: true,
};

export const WAITLIST_HOOK_REJECTED = {
  ...WAITLIST_HOOK_LOADING,
  viewState: 'rejected' as const,
  status: MOCK_WAITLIST_DATA.rejected,
  isLoading: false,
  countdownText: '1d: 4h',
};

export const WAITLIST_HOOK_ERROR = {
  ...WAITLIST_HOOK_LOADING,
  viewState: 'error' as const,
  isLoading: false,
  error: {
    code: 'FETCH_ERROR',
    message: 'Network error occurred',
  },
};

export const WAITLIST_HOOK_REFERRAL_ERROR = {
  ...WAITLIST_HOOK_PENDING,
  referralCode: ['F', 'L', 'N', 'T'],
  isReferralComplete: true,
  referralError: 'Invalid referral code',
};

export const WAITLIST_HOOK_APPLYING_REFERRAL = {
  ...WAITLIST_HOOK_PENDING,
  referralCode: ['F', 'L', 'N', 'T'],
  isReferralComplete: true,
  isApplyingReferral: true,
  isClaimingInviteCode: true,
};

export const WAITLIST_HOOK_REFETCHING = {
  ...WAITLIST_HOOK_PENDING,
  isRefetching: true,
};
