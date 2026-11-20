/**
 * Phone Number Normalization & WhatsApp Utilities
 * Engineered for Fatani Traders Textile ERP
 */

export interface NormalizedPhoneResult {
  isValid: boolean;
  normalized: string;
  display: string;
  error?: string;
}

/**
 * Normalizes customer phone numbers for WhatsApp sharing.
 * Correctly handles Pakistani numbers (03XXXXXXXXX -> 923XXXXXXXXX, +92..., 0092...)
 * and international numbers with country codes.
 */
export function normalizeWhatsAppNumber(rawPhone?: string | null): NormalizedPhoneResult {
  if (!rawPhone || !rawPhone.trim()) {
    return {
      isValid: false,
      normalized: '',
      display: 'Not provided',
      error: 'No phone number is saved for this customer. Please edit the customer profile to add a WhatsApp mobile number.',
    };
  }

  // Strip all non-digit characters except leading plus
  let cleaned = rawPhone.trim().replace(/[\s\-\(\)\.\,\/]/g, '');

  // Strip leading '+'
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // Strip international exit prefix '00' (e.g. 0092 -> 92)
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }

  // Remove any remaining non-digit characters
  cleaned = cleaned.replace(/[^0-9]/g, '');

  if (!cleaned) {
    return {
      isValid: false,
      normalized: '',
      display: rawPhone,
      error: 'The saved phone number does not contain valid digits.',
    };
  }

  // Pakistani standard mobile normalization
  // Case A: 11 digits starting with '03' (e.g. 03001234567) -> 923001234567
  if (/^03[0-9]{9}$/.test(cleaned)) {
    cleaned = '92' + cleaned.substring(1);
  }
  // Case B: 10 digits starting with '3' (e.g. 3001234567) -> 923001234567
  else if (/^3[0-9]{9}$/.test(cleaned)) {
    cleaned = '92' + cleaned;
  }
  // Case C: Already starts with '923' and 12 digits (e.g. 923001234567) -> perfect
  else if (/^923[0-9]{9}$/.test(cleaned)) {
    // Keep as is
  }
  // Case D: Other Pakistani landline/local starting with '0' (e.g. 021...) -> 9221...
  else if (/^0[1-9][0-9]{7,9}$/.test(cleaned)) {
    cleaned = '92' + cleaned.substring(1);
  }

  // Validate E.164 length (between 8 and 15 digits)
  if (cleaned.length < 8 || cleaned.length > 15) {
    return {
      isValid: false,
      normalized: cleaned,
      display: rawPhone,
      error: `Phone number "${rawPhone}" has an unusual length (${cleaned.length} digits). Please verify the country code.`,
    };
  }

  // Format display nicely
  let displayFormatted = `+${cleaned}`;
  if (cleaned.startsWith('923') && cleaned.length === 12) {
    // Format Pakistani mobile: +92 300 1234567
    displayFormatted = `+92 ${cleaned.substring(2, 5)} ${cleaned.substring(5)}`;
  }

  return {
    isValid: true,
    normalized: cleaned,
    display: displayFormatted,
  };
}

/**
 * Builds a direct wa.me link with encoded text message.
 */
export function buildWhatsAppLink(normalizedPhone: string, text: string): string {
  const encodedText = encodeURIComponent(text);
  if (normalizedPhone) {
    return `https://wa.me/${normalizedPhone}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}
