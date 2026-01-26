import { describe, it, expect } from 'vitest';

describe('Campaign Status Transitions', () => {
  const validTransitions: Record<string, string[]> = {
    draft: ['scheduled', 'running', 'cancelled'],
    scheduled: ['running', 'cancelled'],
    running: ['paused', 'completed', 'cancelled'],
    paused: ['running', 'cancelled'],
    completed: [],
    cancelled: [],
  };

  it('should allow valid transitions from draft', () => {
    expect(validTransitions.draft).toContain('scheduled');
    expect(validTransitions.draft).toContain('running');
    expect(validTransitions.draft).toContain('cancelled');
  });

  it('should allow valid transitions from running', () => {
    expect(validTransitions.running).toContain('paused');
    expect(validTransitions.running).toContain('completed');
    expect(validTransitions.running).toContain('cancelled');
  });

  it('should not allow transitions from completed', () => {
    expect(validTransitions.completed).toHaveLength(0);
  });

  it('should not allow transitions from cancelled', () => {
    expect(validTransitions.cancelled).toHaveLength(0);
  });
});

describe('Campaign Delivery Rate Calculation', () => {
  const calculateDeliveryRate = (delivered: number, sent: number) => {
    if (sent === 0) return 0;
    return Math.round((delivered / sent) * 100);
  };

  it('should return 0 when no messages sent', () => {
    expect(calculateDeliveryRate(0, 0)).toBe(0);
  });

  it('should calculate correct delivery rate', () => {
    expect(calculateDeliveryRate(90, 100)).toBe(90);
    expect(calculateDeliveryRate(50, 100)).toBe(50);
    expect(calculateDeliveryRate(100, 100)).toBe(100);
  });

  it('should round to nearest integer', () => {
    expect(calculateDeliveryRate(33, 100)).toBe(33);
    expect(calculateDeliveryRate(66, 100)).toBe(66);
    expect(calculateDeliveryRate(1, 3)).toBe(33);
  });
});

describe('Campaign Progress Calculation', () => {
  const calculateProgress = (sent: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((sent / total) * 100);
  };

  it('should return 0 when no recipients', () => {
    expect(calculateProgress(0, 0)).toBe(0);
  });

  it('should calculate correct progress', () => {
    expect(calculateProgress(50, 100)).toBe(50);
    expect(calculateProgress(100, 100)).toBe(100);
    expect(calculateProgress(0, 100)).toBe(0);
  });

  it('should handle partial progress', () => {
    expect(calculateProgress(25, 100)).toBe(25);
    expect(calculateProgress(75, 100)).toBe(75);
  });
});

describe('Campaign Message Validation', () => {
  const validateMessage = (message: string) => {
    if (!message || message.trim().length === 0) {
      return { valid: false, error: 'Message is required' };
    }
    if (message.length > 4096) {
      return { valid: false, error: 'Message too long (max 4096 characters)' };
    }
    return { valid: true, error: null };
  };

  it('should reject empty messages', () => {
    expect(validateMessage('')).toEqual({ valid: false, error: 'Message is required' });
    expect(validateMessage('   ')).toEqual({ valid: false, error: 'Message is required' });
  });

  it('should accept valid messages', () => {
    expect(validateMessage('Hello!')).toEqual({ valid: true, error: null });
    expect(validateMessage('Test message')).toEqual({ valid: true, error: null });
  });

  it('should reject messages that are too long', () => {
    const longMessage = 'a'.repeat(4097);
    expect(validateMessage(longMessage)).toEqual({ 
      valid: false, 
      error: 'Message too long (max 4096 characters)' 
    });
  });
});
