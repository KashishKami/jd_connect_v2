import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAuthToken, setAuthToken, clearAuthToken, setUserPermissions, hasPermission, isAuthenticated } from '../src/lib/auth';
import { renderNavbar } from '../src/components/navbar';
import { renderButton } from '../src/components/button';
import { showToast } from '../src/components/toast';

describe('Portal Unit Tests (W-1006, W-1007, W-1008)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '';
  });

  describe('W-1007 Auth State & Permissions', () => {
    it('manages auth token in localStorage', () => {
      expect(isAuthenticated()).toBe(false);
      setAuthToken('test-jwt-token');
      expect(getAuthToken()).toBe('test-jwt-token');
      expect(isAuthenticated()).toBe(true);

      clearAuthToken();
      expect(getAuthToken()).toBeNull();
      expect(isAuthenticated()).toBe(false);
    });

    it('evaluates permissions accurately with hasPermission', () => {
      setUserPermissions(['portal.attendance', 'employees.view', 'attendance.view_own']);
      expect(hasPermission('portal.attendance')).toBe(true);
      expect(hasPermission('employees.view')).toBe(true);
      expect(hasPermission('employees.create')).toBe(false);
      expect(hasPermission('portal.permissions')).toBe(false);
    });
  });

  describe('W-1006 UI Components', () => {
    it('renders a button component with click handler and classes', () => {
      const handleClick = vi.fn();
      const btn = renderButton({ text: 'Submit', variant: 'primary', onClick: handleClick });

      expect(btn.tagName).toBe('BUTTON');
      expect(btn.textContent).toBe('Submit');
      expect(btn.classList.contains('btn-primary')).toBe(true);

      btn.click();
      expect(handleClick).toHaveBeenCalled();
    });

    it('shows toast notification element in document body', () => {
      showToast('Operation successful', 'success');
      const toast = document.querySelector('.toast');
      expect(toast).not.toBeNull();
      expect(toast?.textContent).toContain('Operation successful');
    });
  });

  describe('W-1008 Navigation Bar Dynamic Link Rendering', () => {
    it('renders navbar links based on caller permissions', () => {
      // Employee permissions (only portal.attendance)
      setUserPermissions(['portal.attendance']);
      const navEmployee = renderNavbar();
      expect(navEmployee.querySelector('a[href="/"]')).not.toBeNull();
      expect(navEmployee.querySelector('a[href="/employees"]')).toBeNull();
      expect(navEmployee.querySelector('a[href="/permissions"]')).toBeNull();

      // Admin permissions (portal.attendance, portal.employees, portal.permissions)
      setUserPermissions(['portal.attendance', 'portal.employees', 'portal.permissions']);
      const navAdmin = renderNavbar();
      expect(navAdmin.querySelector('a[href="/"]')).not.toBeNull();
      expect(navAdmin.querySelector('a[href="/employees"]')).not.toBeNull();
      expect(navAdmin.querySelector('a[href="/permissions"]')).not.toBeNull();
    });
  });
});
