import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateMobileNumber,
  validateEmail,
  validatePassword,
  validateEnglishName,
  validateArabicName,
  validateDateOfBirth,
} from './validationUtils';

describe('validateMobileNumber', () => {
  it('should accept valid Egyptian mobile numbers', () => {
    expect(validateMobileNumber('01012345678').isValid).toBe(true);
    expect(validateMobileNumber('01112345678').isValid).toBe(true);
    expect(validateMobileNumber('01212345678').isValid).toBe(true);
    expect(validateMobileNumber('01512345678').isValid).toBe(true);
  });

  it('should reject numbers with country code (requires local format)', () => {
    // Current implementation only accepts local format (01xxxxxxxxx)
    expect(validateMobileNumber('+201012345678').isValid).toBe(false);
  });

  it('should reject invalid numbers', () => {
    expect(validateMobileNumber('123456').isValid).toBe(false);
    expect(validateMobileNumber('02012345678').isValid).toBe(false);
    expect(validateMobileNumber('0101234567').isValid).toBe(false); // Too short
  });

  it('should accept empty or optional phone', () => {
    expect(validateMobileNumber('').isValid).toBe(true);
  });
});

describe('validateEmail', () => {
  it('should accept valid email addresses', () => {
    expect(validateEmail('test@example.com').isValid).toBe(true);
    expect(validateEmail('user.name@domain.co.uk').isValid).toBe(true);
  });

  it('should reject invalid email addresses', () => {
    expect(validateEmail('invalid').isValid).toBe(false);
    expect(validateEmail('no@domain').isValid).toBe(false);
    expect(validateEmail('@nodomain.com').isValid).toBe(false);
  });

  it('should reject empty email', () => {
    expect(validateEmail('').isValid).toBe(false);
  });
});

describe('validatePassword', () => {
  it('should accept valid passwords', () => {
    const result = validatePassword('SecurePass123!');
    expect(result.isValid).toBe(true);
    expect(result.hasMinLength).toBe(true);
    expect(result.hasUppercase).toBe(true);
    expect(result.hasLowercase).toBe(true);
    expect(result.hasNumber).toBe(true);
    expect(result.hasSpecial).toBe(true);
  });

  it('should reject passwords without uppercase', () => {
    const result = validatePassword('securepass123!');
    expect(result.isValid).toBe(false);
    expect(result.hasUppercase).toBe(false);
  });

  it('should reject passwords without numbers', () => {
    const result = validatePassword('SecurePass!');
    expect(result.isValid).toBe(false);
    expect(result.hasNumber).toBe(false);
  });

  it('should reject passwords without special characters', () => {
    const result = validatePassword('SecurePass123');
    expect(result.isValid).toBe(false);
    expect(result.hasSpecial).toBe(false);
  });

  it('should reject short passwords', () => {
    const result = validatePassword('Pa1!');
    expect(result.isValid).toBe(false);
    expect(result.hasMinLength).toBe(false);
  });
});

describe('validateEnglishName', () => {
  it('should accept valid English names', () => {
    expect(validateEnglishName('John Doe').isValid).toBe(true);
    expect(validateEnglishName('Mary Jane Watson').isValid).toBe(true);
  });

  it('should reject names with Arabic characters', () => {
    expect(validateEnglishName('محمد').isValid).toBe(false);
  });

  it('should reject empty names', () => {
    expect(validateEnglishName('').isValid).toBe(false);
  });

  it('should reject names that are too short', () => {
    expect(validateEnglishName('J').isValid).toBe(false);
  });
});

describe('validateArabicName', () => {
  it('should accept valid Arabic names', () => {
    expect(validateArabicName('محمد أحمد').isValid).toBe(true);
    expect(validateArabicName('عبد الله').isValid).toBe(true);
  });

  it('should reject names with only English characters', () => {
    expect(validateArabicName('John Doe').isValid).toBe(false);
  });

  it('should accept empty Arabic name (optional)', () => {
    expect(validateArabicName('').isValid).toBe(true);
  });
});

describe('validateDateOfBirth', () => {
  it('should accept valid birth dates', () => {
    expect(validateDateOfBirth('2010-05-15').isValid).toBe(true);
    expect(validateDateOfBirth('2015-01-01').isValid).toBe(true);
  });

  it('should reject future dates', () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    expect(validateDateOfBirth(futureDate.toISOString().split('T')[0]).isValid).toBe(false);
  });

  it('should accept empty date (optional)', () => {
    expect(validateDateOfBirth('').isValid).toBe(true);
  });

  it('should reject very old dates', () => {
    expect(validateDateOfBirth('1800-01-01').isValid).toBe(false);
  });
});
