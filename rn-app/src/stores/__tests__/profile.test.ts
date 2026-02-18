import { act } from '@testing-library/react-native';
import {
  useProfileStore,
  selectActiveTab,
  selectIsEditing,
  selectProfileForm,
  selectNotificationPrefs,
  selectIsSaving,
  selectProfileError,
  selectIsFormDirty,
} from '../profile';

describe('profileStore', () => {
  beforeEach(() => {
    act(() => {
      useProfileStore.getState().reset();
    });
  });

  // ===================================================
  // INITIAL STATE
  // ===================================================

  describe('initial state', () => {
    it('has correct initial state values', () => {
      const state = useProfileStore.getState();
      expect(state.activeTab).toBe('overview');
      expect(state.isEditing).toBe(false);
      expect(state.isSaving).toBe(false);
      expect(state.error).toBeNull();
    });

    it('has correct initial form state', () => {
      const { form } = useProfileStore.getState();
      expect(form.fullName).toBe('');
      expect(form.email).toBe('');
      expect(form.avatarUri).toBeNull();
      expect(form.isDirty).toBe(false);
    });

    it('has correct initial notification preferences', () => {
      const { notificationPrefs } = useProfileStore.getState();
      expect(notificationPrefs.paymentReminders).toBe(true);
      expect(notificationPrefs.paymentConfirmations).toBe(true);
      expect(notificationPrefs.promotionalOffers).toBe(false);
      expect(notificationPrefs.appUpdates).toBe(true);
    });
  });

  // ===================================================
  // TAB NAVIGATION ACTIONS
  // ===================================================

  describe('setActiveTab', () => {
    it.each(['overview', 'payments', 'agreement', 'settings'] as const)(
      'sets active tab to %s',
      (tab) => {
        act(() => {
          useProfileStore.getState().setActiveTab(tab);
        });
        expect(useProfileStore.getState().activeTab).toBe(tab);
      }
    );

    it('allows switching between tabs', () => {
      act(() => {
        useProfileStore.getState().setActiveTab('payments');
      });
      expect(useProfileStore.getState().activeTab).toBe('payments');

      act(() => {
        useProfileStore.getState().setActiveTab('settings');
      });
      expect(useProfileStore.getState().activeTab).toBe('settings');
    });
  });

  // ===================================================
  // EDIT MODE ACTIONS
  // ===================================================

  describe('startEditing', () => {
    it('enables editing with current values', () => {
      act(() => {
        useProfileStore.getState().startEditing('John Doe', 'john@example.com');
      });
      const state = useProfileStore.getState();
      expect(state.isEditing).toBe(true);
      expect(state.form.fullName).toBe('John Doe');
      expect(state.form.email).toBe('john@example.com');
      expect(state.form.isDirty).toBe(false);
    });

    it('clears existing error', () => {
      act(() => {
        useProfileStore.getState().setError('ERR', 'Old error');
        useProfileStore.getState().startEditing('Name', 'email@test.com');
      });
      expect(useProfileStore.getState().error).toBeNull();
    });

    it('resets isDirty to false', () => {
      act(() => {
        useProfileStore.getState().startEditing('A', 'a@b.com');
        useProfileStore.getState().updateForm({ fullName: 'Changed' });
      });
      expect(useProfileStore.getState().form.isDirty).toBe(true);

      act(() => {
        useProfileStore.getState().startEditing('B', 'b@c.com');
      });
      expect(useProfileStore.getState().form.isDirty).toBe(false);
    });
  });

  describe('cancelEditing', () => {
    it('disables editing and resets form', () => {
      act(() => {
        useProfileStore.getState().startEditing('John Doe', 'john@example.com');
        useProfileStore.getState().updateForm({ fullName: 'Jane Doe' });
        useProfileStore.getState().cancelEditing();
      });
      const state = useProfileStore.getState();
      expect(state.isEditing).toBe(false);
      expect(state.form.fullName).toBe('');
      expect(state.form.email).toBe('');
      expect(state.form.avatarUri).toBeNull();
      expect(state.form.isDirty).toBe(false);
    });

    it('clears error', () => {
      act(() => {
        useProfileStore.getState().setError('ERR', 'Error during edit');
        useProfileStore.getState().cancelEditing();
      });
      expect(useProfileStore.getState().error).toBeNull();
    });
  });

  // ===================================================
  // FORM UPDATE ACTIONS
  // ===================================================

  describe('updateForm', () => {
    it('updates form fields and marks dirty', () => {
      act(() => {
        useProfileStore.getState().startEditing('John', 'john@example.com');
        useProfileStore.getState().updateForm({ fullName: 'John Updated' });
      });
      const state = useProfileStore.getState();
      expect(state.form.fullName).toBe('John Updated');
      expect(state.form.isDirty).toBe(true);
    });

    it('preserves other fields when updating one', () => {
      act(() => {
        useProfileStore.getState().startEditing('John', 'john@example.com');
        useProfileStore.getState().updateForm({ fullName: 'Jane' });
      });
      const state = useProfileStore.getState();
      expect(state.form.fullName).toBe('Jane');
      expect(state.form.email).toBe('john@example.com');
    });

    it('updates email field', () => {
      act(() => {
        useProfileStore.getState().startEditing('John', 'old@test.com');
        useProfileStore.getState().updateForm({ email: 'new@test.com' });
      });
      expect(useProfileStore.getState().form.email).toBe('new@test.com');
      expect(useProfileStore.getState().form.isDirty).toBe(true);
    });

    it('updates multiple fields at once', () => {
      act(() => {
        useProfileStore.getState().updateForm({ fullName: 'New Name', email: 'new@email.com' });
      });
      const { form } = useProfileStore.getState();
      expect(form.fullName).toBe('New Name');
      expect(form.email).toBe('new@email.com');
      expect(form.isDirty).toBe(true);
    });
  });

  describe('setAvatarUri', () => {
    it('sets avatar URI and marks form dirty', () => {
      act(() => {
        useProfileStore.getState().setAvatarUri('file:///avatar.jpg');
      });
      const state = useProfileStore.getState();
      expect(state.form.avatarUri).toBe('file:///avatar.jpg');
      expect(state.form.isDirty).toBe(true);
    });

    it('allows updating avatar URI', () => {
      act(() => {
        useProfileStore.getState().setAvatarUri('file:///old.jpg');
        useProfileStore.getState().setAvatarUri('file:///new.jpg');
      });
      expect(useProfileStore.getState().form.avatarUri).toBe('file:///new.jpg');
    });
  });

  // ===================================================
  // NOTIFICATION PREFERENCES ACTIONS
  // ===================================================

  describe('toggleNotificationPref', () => {
    it('toggles promotionalOffers from false to true', () => {
      expect(useProfileStore.getState().notificationPrefs.promotionalOffers).toBe(false);

      act(() => {
        useProfileStore.getState().toggleNotificationPref('promotionalOffers');
      });
      expect(useProfileStore.getState().notificationPrefs.promotionalOffers).toBe(true);
    });

    it('toggles paymentReminders from true to false', () => {
      expect(useProfileStore.getState().notificationPrefs.paymentReminders).toBe(true);

      act(() => {
        useProfileStore.getState().toggleNotificationPref('paymentReminders');
      });
      expect(useProfileStore.getState().notificationPrefs.paymentReminders).toBe(false);
    });

    it('toggles back and forth', () => {
      act(() => {
        useProfileStore.getState().toggleNotificationPref('promotionalOffers');
      });
      expect(useProfileStore.getState().notificationPrefs.promotionalOffers).toBe(true);

      act(() => {
        useProfileStore.getState().toggleNotificationPref('promotionalOffers');
      });
      expect(useProfileStore.getState().notificationPrefs.promotionalOffers).toBe(false);
    });

    it.each([
      'paymentReminders',
      'paymentConfirmations',
      'promotionalOffers',
      'appUpdates',
    ] as const)('toggles %s preference', (key) => {
      const initialValue = useProfileStore.getState().notificationPrefs[key];
      act(() => {
        useProfileStore.getState().toggleNotificationPref(key);
      });
      expect(useProfileStore.getState().notificationPrefs[key]).toBe(!initialValue);
    });
  });

  describe('setNotificationPrefs', () => {
    it('sets multiple preferences at once', () => {
      act(() => {
        useProfileStore.getState().setNotificationPrefs({
          paymentReminders: false,
          appUpdates: false,
        });
      });
      const prefs = useProfileStore.getState().notificationPrefs;
      expect(prefs.paymentReminders).toBe(false);
      expect(prefs.appUpdates).toBe(false);
      // Unchanged
      expect(prefs.paymentConfirmations).toBe(true);
      expect(prefs.promotionalOffers).toBe(false);
    });

    it('sets a single preference', () => {
      act(() => {
        useProfileStore.getState().setNotificationPrefs({ promotionalOffers: true });
      });
      expect(useProfileStore.getState().notificationPrefs.promotionalOffers).toBe(true);
    });

    it('overwrites all preferences', () => {
      act(() => {
        useProfileStore.getState().setNotificationPrefs({
          paymentReminders: false,
          paymentConfirmations: false,
          promotionalOffers: true,
          appUpdates: false,
        });
      });
      const prefs = useProfileStore.getState().notificationPrefs;
      expect(prefs.paymentReminders).toBe(false);
      expect(prefs.paymentConfirmations).toBe(false);
      expect(prefs.promotionalOffers).toBe(true);
      expect(prefs.appUpdates).toBe(false);
    });
  });

  // ===================================================
  // SAVING STATE ACTIONS
  // ===================================================

  describe('setSaving', () => {
    it('sets saving to true', () => {
      act(() => {
        useProfileStore.getState().setSaving(true);
      });
      expect(useProfileStore.getState().isSaving).toBe(true);
    });

    it('sets saving to false', () => {
      act(() => {
        useProfileStore.getState().setSaving(true);
        useProfileStore.getState().setSaving(false);
      });
      expect(useProfileStore.getState().isSaving).toBe(false);
    });

    it('clears error when saving starts (true)', () => {
      act(() => {
        useProfileStore.getState().setError('NETWORK', 'Failed');
        useProfileStore.getState().setSaving(true);
      });
      expect(useProfileStore.getState().error).toBeNull();
    });

    it('does NOT clear error when saving stops (false)', () => {
      act(() => {
        useProfileStore.getState().setError('NETWORK', 'Failed');
      });
      // setSaving(false) should not clear the error
      act(() => {
        useProfileStore.getState().setSaving(false);
      });
      expect(useProfileStore.getState().error).toEqual({
        code: 'NETWORK',
        message: 'Failed',
      });
    });
  });

  // ===================================================
  // ERROR HANDLING ACTIONS
  // ===================================================

  describe('setError', () => {
    it('sets error and stops saving', () => {
      act(() => {
        useProfileStore.getState().setSaving(true);
        useProfileStore.getState().setError('VALIDATION', 'Name is required');
      });
      const state = useProfileStore.getState();
      expect(state.error).toEqual({ code: 'VALIDATION', message: 'Name is required' });
      expect(state.isSaving).toBe(false);
    });

    it('overwrites previous error', () => {
      act(() => {
        useProfileStore.getState().setError('ERR_1', 'First');
        useProfileStore.getState().setError('ERR_2', 'Second');
      });
      expect(useProfileStore.getState().error).toEqual({ code: 'ERR_2', message: 'Second' });
    });
  });

  describe('clearError', () => {
    it('clears the error', () => {
      act(() => {
        useProfileStore.getState().setError('ERR', 'Error');
        useProfileStore.getState().clearError();
      });
      expect(useProfileStore.getState().error).toBeNull();
    });

    it('is safe to call when no error exists', () => {
      act(() => {
        useProfileStore.getState().clearError();
      });
      expect(useProfileStore.getState().error).toBeNull();
    });
  });

  // ===================================================
  // RESET ACTION
  // ===================================================

  describe('reset', () => {
    it('resets all state to initial values', () => {
      act(() => {
        useProfileStore.getState().setActiveTab('settings');
        useProfileStore.getState().startEditing('Test User', 'test@example.com');
        useProfileStore.getState().updateForm({ fullName: 'Changed' });
        useProfileStore.getState().setAvatarUri('file:///pic.jpg');
        useProfileStore.getState().toggleNotificationPref('promotionalOffers');
        useProfileStore.getState().setSaving(true);
        useProfileStore.getState().setError('ERR', 'Error');
      });

      act(() => {
        useProfileStore.getState().reset();
      });

      const state = useProfileStore.getState();
      expect(state.activeTab).toBe('overview');
      expect(state.isEditing).toBe(false);
      expect(state.form.fullName).toBe('');
      expect(state.form.email).toBe('');
      expect(state.form.avatarUri).toBeNull();
      expect(state.form.isDirty).toBe(false);
      expect(state.notificationPrefs.paymentReminders).toBe(true);
      expect(state.notificationPrefs.paymentConfirmations).toBe(true);
      expect(state.notificationPrefs.promotionalOffers).toBe(false);
      expect(state.notificationPrefs.appUpdates).toBe(true);
      expect(state.isSaving).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  // ===================================================
  // SELECTORS
  // ===================================================

  describe('selectors', () => {
    it('selectActiveTab returns current active tab', () => {
      expect(selectActiveTab(useProfileStore.getState())).toBe('overview');

      act(() => {
        useProfileStore.getState().setActiveTab('payments');
      });
      expect(selectActiveTab(useProfileStore.getState())).toBe('payments');
    });

    it('selectIsEditing returns editing state', () => {
      expect(selectIsEditing(useProfileStore.getState())).toBe(false);

      act(() => {
        useProfileStore.getState().startEditing('N', 'e@e.com');
      });
      expect(selectIsEditing(useProfileStore.getState())).toBe(true);
    });

    it('selectProfileForm returns form state', () => {
      const form = selectProfileForm(useProfileStore.getState());
      expect(form.fullName).toBe('');
      expect(form.isDirty).toBe(false);

      act(() => {
        useProfileStore.getState().updateForm({ fullName: 'Updated' });
      });
      const updated = selectProfileForm(useProfileStore.getState());
      expect(updated.fullName).toBe('Updated');
      expect(updated.isDirty).toBe(true);
    });

    it('selectNotificationPrefs returns notification preferences', () => {
      const prefs = selectNotificationPrefs(useProfileStore.getState());
      expect(prefs.paymentReminders).toBe(true);
      expect(prefs.promotionalOffers).toBe(false);

      act(() => {
        useProfileStore.getState().toggleNotificationPref('paymentReminders');
      });
      expect(selectNotificationPrefs(useProfileStore.getState()).paymentReminders).toBe(false);
    });

    it('selectIsSaving returns saving state', () => {
      expect(selectIsSaving(useProfileStore.getState())).toBe(false);

      act(() => {
        useProfileStore.getState().setSaving(true);
      });
      expect(selectIsSaving(useProfileStore.getState())).toBe(true);
    });

    it('selectProfileError returns null when no error', () => {
      expect(selectProfileError(useProfileStore.getState())).toBeNull();
    });

    it('selectProfileError returns error when set', () => {
      act(() => {
        useProfileStore.getState().setError('TEST', 'Test');
      });
      expect(selectProfileError(useProfileStore.getState())).toEqual({
        code: 'TEST',
        message: 'Test',
      });
    });

    describe('selectIsFormDirty', () => {
      it('returns false when form is not dirty', () => {
        expect(selectIsFormDirty(useProfileStore.getState())).toBe(false);
      });

      it('returns true after updateForm', () => {
        act(() => {
          useProfileStore.getState().updateForm({ fullName: 'Changed' });
        });
        expect(selectIsFormDirty(useProfileStore.getState())).toBe(true);
      });

      it('returns true after setAvatarUri', () => {
        act(() => {
          useProfileStore.getState().setAvatarUri('file:///pic.jpg');
        });
        expect(selectIsFormDirty(useProfileStore.getState())).toBe(true);
      });

      it('returns false after startEditing (resets dirty)', () => {
        act(() => {
          useProfileStore.getState().updateForm({ fullName: 'Dirty' });
        });
        expect(selectIsFormDirty(useProfileStore.getState())).toBe(true);

        act(() => {
          useProfileStore.getState().startEditing('Clean', 'clean@test.com');
        });
        expect(selectIsFormDirty(useProfileStore.getState())).toBe(false);
      });

      it('returns false after cancelEditing', () => {
        act(() => {
          useProfileStore.getState().updateForm({ fullName: 'Dirty' });
          useProfileStore.getState().cancelEditing();
        });
        expect(selectIsFormDirty(useProfileStore.getState())).toBe(false);
      });
    });
  });

  // ===================================================
  // INTEGRATION: EDIT PROFILE FLOW
  // ===================================================

  describe('edit profile flow integration', () => {
    it('handles edit -> save -> success flow', () => {
      // Start editing
      act(() => {
        useProfileStore.getState().startEditing('Original Name', 'original@email.com');
      });
      expect(useProfileStore.getState().isEditing).toBe(true);
      expect(selectIsFormDirty(useProfileStore.getState())).toBe(false);

      // Update fields
      act(() => {
        useProfileStore.getState().updateForm({ fullName: 'Updated Name' });
        useProfileStore.getState().setAvatarUri('file:///new-avatar.jpg');
      });
      expect(selectIsFormDirty(useProfileStore.getState())).toBe(true);

      // Start saving
      act(() => {
        useProfileStore.getState().setSaving(true);
      });
      expect(useProfileStore.getState().isSaving).toBe(true);

      // Saving finishes successfully
      act(() => {
        useProfileStore.getState().setSaving(false);
      });
      expect(useProfileStore.getState().isSaving).toBe(false);
      expect(useProfileStore.getState().error).toBeNull();
    });

    it('handles edit -> save -> failure flow', () => {
      act(() => {
        useProfileStore.getState().startEditing('Name', 'email@test.com');
        useProfileStore.getState().updateForm({ fullName: 'New' });
        useProfileStore.getState().setSaving(true);
      });
      expect(useProfileStore.getState().isSaving).toBe(true);

      // Save fails
      act(() => {
        useProfileStore.getState().setError('SERVER_ERROR', 'Failed to save');
      });
      expect(useProfileStore.getState().isSaving).toBe(false);
      expect(useProfileStore.getState().error).toEqual({
        code: 'SERVER_ERROR',
        message: 'Failed to save',
      });
      // Still in editing mode
      expect(useProfileStore.getState().isEditing).toBe(true);
    });
  });
});
