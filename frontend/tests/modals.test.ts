import React from 'react';
import { HelpCenterModal } from '../src/components/modals/HelpCenterModal';
import { ContactSupportModal } from '../src/components/modals/ContactSupportModal';
import { PrivacyConsentModal } from '../src/components/modals/PrivacyConsentModal';
import { TermsModal } from '../src/components/modals/TermsModal';
import { LifeLinkChatbot } from '../src/components/chatbot/LifeLinkChatbot';

describe('Shared Platform Modals and Components', () => {
  it('should export all modals as React components', () => {
    expect(typeof HelpCenterModal).toBe('function');
    expect(typeof ContactSupportModal).toBe('function');
    expect(typeof PrivacyConsentModal).toBe('function');
    expect(typeof TermsModal).toBe('function');
    expect(typeof LifeLinkChatbot).toBe('function');
  });
});
