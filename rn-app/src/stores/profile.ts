/**
 * Profile Store
 *
 * Zustand store for profile screen UI state.
 * Manages editing mode, form data, and notification preferences.
 * Server data (profile info, methods) is handled by React Query hooks.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

// ==============================================
// TYPES
// ==============================================

export type ProfileTab = 'overview' | 'payments' | 'agreement' | 'settings';

interface ProfileFormState {
  fullName: string;
  email: string;
  isDirty: boolean;
}

interface NotificationPreferences {
  paymentReminders: boolean;
  paymentConfirmations: boolean;
  promotionalOffers: boolean;
  appUpdates: boolean;
}

interface ProfileState {
  activeTab: ProfileTab;
  isEditing: boolean;
  form: ProfileFormState;
  notificationPrefs: NotificationPreferences;
  isSaving: boolean;
  error: {
    code: string;
    message: string;
  } | null;
}

interface ProfileActions {
  // Tab navigation
  setActiveTab: (tab: ProfileTab) => void;

  // Edit mode
  startEditing: (currentName: string, currentEmail: string) => void;
  cancelEditing: () => void;

  // Form updates
  updateForm: (fields: Partial<ProfileFormState>) => void;

  // Notification preferences
  toggleNotificationPref: (key: keyof NotificationPreferences) => void;
  setNotificationPrefs: (prefs: Partial<NotificationPreferences>) => void;

  // Save state
  setSaving: (saving: boolean) => void;

  // Error handling
  setError: (code: string, message: string) => void;
  clearError: () => void;

  // Reset
  reset: () => void;
}

type ProfileStore = ProfileState & ProfileActions;

// ==============================================
// INITIAL STATE
// ==============================================

const initialForm: ProfileFormState = {
  fullName: '',
  email: '',
  isDirty: false,
};

const initialNotificationPrefs: NotificationPreferences = {
  paymentReminders: true,
  paymentConfirmations: true,
  promotionalOffers: false,
  appUpdates: true,
};

const initialState: ProfileState = {
  activeTab: 'overview',
  isEditing: false,
  form: initialForm,
  notificationPrefs: initialNotificationPrefs,
  isSaving: false,
  error: null,
};

// ==============================================
// STORE
// ==============================================

export const useProfileStore = create<ProfileStore>()(
  immer((set) => ({
    ...initialState,

    setActiveTab: (tab) =>
      set((state) => {
        state.activeTab = tab;
      }),

    startEditing: (currentName, currentEmail) =>
      set((state) => {
        state.isEditing = true;
        state.form.fullName = currentName;
        state.form.email = currentEmail;
        state.form.isDirty = false;
        state.error = null;
      }),

    cancelEditing: () =>
      set((state) => {
        state.isEditing = false;
        state.form = initialForm;
        state.error = null;
      }),

    updateForm: (fields) =>
      set((state) => {
        Object.assign(state.form, fields);
        state.form.isDirty = true;
      }),

    toggleNotificationPref: (key) =>
      set((state) => {
        state.notificationPrefs[key] = !state.notificationPrefs[key];
      }),

    setNotificationPrefs: (prefs) =>
      set((state) => {
        Object.assign(state.notificationPrefs, prefs);
      }),

    setSaving: (saving) =>
      set((state) => {
        state.isSaving = saving;
        if (saving) state.error = null;
      }),

    setError: (code, message) =>
      set((state) => {
        state.error = { code, message };
        state.isSaving = false;
      }),

    clearError: () =>
      set((state) => {
        state.error = null;
      }),

    reset: () => set(initialState),
  }))
);

// ==============================================
// SELECTORS
// ==============================================

export const selectActiveTab = (state: ProfileStore) => state.activeTab;
export const selectIsEditing = (state: ProfileStore) => state.isEditing;
export const selectProfileForm = (state: ProfileStore) => state.form;
export const selectNotificationPrefs = (state: ProfileStore) => state.notificationPrefs;
export const selectIsSaving = (state: ProfileStore) => state.isSaving;
export const selectProfileError = (state: ProfileStore) => state.error;
export const selectIsFormDirty = (state: ProfileStore) => state.form.isDirty;
