import { FidelisCustomerProfile, SaleTicket } from '../types';

export const FIDELIS_STORAGE_KEY = 'jhojan_pos_fidelis_v1';
export const FIDELIS_STAMPS_GOAL = 10;
export const FIDELIS_HIGH_VALUE_THRESHOLD = 18.0; // USD
export const FIDELIS_HIGH_VALUE_GOAL = 4;

/**
 * Normalizes customer credentials to generate an unequivocal unique ID.
 * Priority: Cédula/RIF -> Phone -> Clean Full Name.
 */
export function normalizeCustomerId(cedula?: string, phone?: string, name?: string): string {
  const cleanCedula = (cedula || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (cleanCedula.length >= 4 && cleanCedula !== 'V00000000' && cleanCedula !== 'V0') {
    return `CI:${cleanCedula}`;
  }

  const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
  if (cleanPhone.length >= 7) {
    return `TEL:${cleanPhone}`;
  }

  const cleanName = (name || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');

  if (cleanName.length > 2 && cleanName !== 'consumidorfinal') {
    return `NAME:${cleanName}`;
  }

  return '';
}

/**
 * Loads Fidelis profiles from localStorage.
 * If empty, automatically bootstraps from existing historical sales tickets!
 */
export function loadFidelisProfiles(existingTickets?: SaleTicket[]): Record<string, FidelisCustomerProfile> {
  try {
    const raw = localStorage.getItem(FIDELIS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Error loading Fidelis profiles from localStorage', e);
  }

  // Bootstrap from historical tickets if available
  if (existingTickets && existingTickets.length > 0) {
    const bootstrapped = bootstrapFidelisFromTickets(existingTickets);
    saveFidelisProfiles(bootstrapped);
    return bootstrapped;
  }

  return {};
}

/**
 * Saves Fidelis profiles to localStorage and notifies other modules.
 */
export function saveFidelisProfiles(profiles: Record<string, FidelisCustomerProfile>): void {
  try {
    localStorage.setItem(FIDELIS_STORAGE_KEY, JSON.stringify(profiles));
    window.dispatchEvent(new CustomEvent('jhojan_pos_sync', { detail: { type: 'fidelis' } }));
  } catch (e) {
    console.error('Error saving Fidelis profiles', e);
  }
}

/**
 * Searches for a customer profile by cédula, phone, or name.
 */
export function findFidelisProfile(
  identifier: { cedula?: string; phone?: string; name?: string },
  profiles: Record<string, FidelisCustomerProfile>
): FidelisCustomerProfile | null {
  const directKey = normalizeCustomerId(identifier.cedula, identifier.phone, identifier.name);
  if (directKey && profiles[directKey]) {
    return profiles[directKey];
  }

  const values = Object.values(profiles);
  const targetCedula = (identifier.cedula || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const targetPhone = (identifier.phone || '').replace(/[^0-9]/g, '');
  const targetName = (identifier.name || '').trim().toLowerCase();

  // 1. Search by Cédula
  if (targetCedula && targetCedula !== 'V00000000' && targetCedula !== 'V0') {
    const match = values.find((p) => {
      const c = p.customerCedula.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      return c === targetCedula;
    });
    if (match) return match;

    // Also compare without leading V/J/E/G prefix
    const pureDigitsCedula = targetCedula.replace(/^[VJEG]/, '');
    if (pureDigitsCedula.length >= 5) {
      const pureMatch = values.find((p) => {
        const c = p.customerCedula.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().replace(/^[VJEG]/, '');
        return c === pureDigitsCedula;
      });
      if (pureMatch) return pureMatch;
    }
  }

  // 2. Search by Phone
  if (targetPhone && targetPhone.length >= 7) {
    const match = values.find((p) => {
      const ph = p.customerPhone.replace(/[^0-9]/g, '');
      return ph.includes(targetPhone) || targetPhone.includes(ph);
    });
    if (match) return match;
  }

  // 3. Search by Name
  if (targetName && targetName !== 'consumidor final') {
    const match = values.find((p) => p.customerName.trim().toLowerCase() === targetName);
    if (match) return match;
  }

  return null;
}

/**
 * Registers a completed sale ticket into the customer's Fidelis profile.
 * Increments stamps (Sistema Base) and evaluated high value transactions (≥$18 USD).
 */
export function recordFidelisSale(
  ticket: SaleTicket,
  currentProfiles: Record<string, FidelisCustomerProfile>
): {
  updatedProfiles: Record<string, FidelisCustomerProfile>;
  updatedProfile: FidelisCustomerProfile | null;
  earnedStamp: boolean;
  earnedHighValue: boolean;
  unlockedStampsReward: boolean;
  unlockedHighValueReward: boolean;
} {
  // If ticket is voided, ignore
  if (ticket.isVoided) {
    return {
      updatedProfiles: currentProfiles,
      updatedProfile: null,
      earnedStamp: false,
      earnedHighValue: false,
      unlockedStampsReward: false,
      unlockedHighValueReward: false,
    };
  }

  const customerId = normalizeCustomerId(ticket.customerCedula, ticket.customerPhone, ticket.customerName);
  if (!customerId) {
    return {
      updatedProfiles: currentProfiles,
      updatedProfile: null,
      earnedStamp: false,
      earnedHighValue: false,
      unlockedStampsReward: false,
      unlockedHighValueReward: false,
    };
  }

  const existing = currentProfiles[customerId];
  const now = new Date().toISOString();

  const isHighValue = ticket.totalUSD >= FIDELIS_HIGH_VALUE_THRESHOLD;

  let currentStamps = existing ? existing.stampsCount : 0;
  let currentHighValue = existing ? existing.highValueCount : 0;
  let stampsCycles = existing ? existing.stampsCycles : 0;
  let highValueCycles = existing ? existing.highValueCycles : 0;

  // Add 1 stamp
  currentStamps += 1;
  const unlockedStampsReward = currentStamps >= FIDELIS_STAMPS_GOAL;
  if (unlockedStampsReward) {
    stampsCycles += 1;
  }

  // Add 1 high value if total >= $18 USD
  let unlockedHighValueReward = false;
  if (isHighValue) {
    currentHighValue += 1;
    if (currentHighValue >= FIDELIS_HIGH_VALUE_GOAL) {
      unlockedHighValueReward = true;
      highValueCycles += 1;
    }
  }

  const profile: FidelisCustomerProfile = {
    id: customerId,
    customerName: ticket.customerName || existing?.customerName || 'Cliente Fidelis',
    customerCedula: ticket.customerCedula || existing?.customerCedula || '',
    customerPhone: ticket.customerPhone || existing?.customerPhone || '',
    stampsCount: currentStamps,
    stampsGoal: FIDELIS_STAMPS_GOAL,
    stampsCycles,
    stampsClaimed: existing?.stampsClaimed || 0,
    highValueCount: currentHighValue,
    highValueGoal: FIDELIS_HIGH_VALUE_GOAL,
    highValueThresholdUSD: FIDELIS_HIGH_VALUE_THRESHOLD,
    highValueCycles,
    highValueClaimed: existing?.highValueClaimed || 0,
    totalSpentUSD: Math.round(((existing?.totalSpentUSD || 0) + ticket.totalUSD) * 100) / 100,
    totalTransactions: (existing?.totalTransactions || 0) + 1,
    lastPurchaseDate: ticket.date || now,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const updatedProfiles = {
    ...currentProfiles,
    [customerId]: profile,
  };

  saveFidelisProfiles(updatedProfiles);

  return {
    updatedProfiles,
    updatedProfile: profile,
    earnedStamp: true,
    earnedHighValue: isHighValue,
    unlockedStampsReward,
    unlockedHighValueReward,
  };
}

/**
 * Claims a reward for a customer (either standard 10-stamp reward or 4-high-value VIP reward).
 * Deducts the completed goal from the active count and logs the claim.
 */
export function claimFidelisReward(
  customerId: string,
  rewardType: 'stamps' | 'highValue',
  currentProfiles: Record<string, FidelisCustomerProfile>
): {
  updatedProfiles: Record<string, FidelisCustomerProfile>;
  claimedProfile: FidelisCustomerProfile | null;
  success: boolean;
} {
  const existing = currentProfiles[customerId];
  if (!existing) {
    return { updatedProfiles: currentProfiles, claimedProfile: null, success: false };
  }

  const now = new Date().toISOString();
  let updated: FidelisCustomerProfile;

  if (rewardType === 'stamps') {
    if (existing.stampsCount < FIDELIS_STAMPS_GOAL) {
      return { updatedProfiles: currentProfiles, claimedProfile: null, success: false };
    }
    updated = {
      ...existing,
      stampsCount: Math.max(0, existing.stampsCount - FIDELIS_STAMPS_GOAL),
      stampsClaimed: existing.stampsClaimed + 1,
      updatedAt: now,
    };
  } else {
    if (existing.highValueCount < FIDELIS_HIGH_VALUE_GOAL) {
      return { updatedProfiles: currentProfiles, claimedProfile: null, success: false };
    }
    updated = {
      ...existing,
      highValueCount: Math.max(0, existing.highValueCount - FIDELIS_HIGH_VALUE_GOAL),
      highValueClaimed: existing.highValueClaimed + 1,
      updatedAt: now,
    };
  }

  const updatedProfiles = {
    ...currentProfiles,
    [customerId]: updated,
  };

  saveFidelisProfiles(updatedProfiles);

  return {
    updatedProfiles,
    claimedProfile: updated,
    success: true,
  };
}

/**
 * Bootstraps Fidelis profiles by reprocessing historical valid sale tickets.
 */
function bootstrapFidelisFromTickets(tickets: SaleTicket[]): Record<string, FidelisCustomerProfile> {
  const result = syncAndSumTicketsToFidelis(tickets, {}, { resetBeforeSync: true });
  return result.updatedProfiles;
}

/**
 * Reverts a sale when a ticket is voided or deleted.
 * Subtracts 1 stamp from the customer's Fidelis profile,
 * and if the ticket was >= $18 USD, subtracts 1 high-value transaction.
 * Also adjusts totalSpentUSD and totalTransactions.
 */
export function revertFidelisSale(
  ticket: SaleTicket,
  currentProfiles: Record<string, FidelisCustomerProfile>
): {
  updatedProfiles: Record<string, FidelisCustomerProfile>;
  updatedProfile: FidelisCustomerProfile | null;
  removedStamp: boolean;
  removedHighValue: boolean;
} {
  // If ticket was already voided, do not revert again
  if (ticket.isVoided) {
    return {
      updatedProfiles: currentProfiles,
      updatedProfile: null,
      removedStamp: false,
      removedHighValue: false,
    };
  }

  const existing = findFidelisProfile(
    { cedula: ticket.customerCedula, phone: ticket.customerPhone, name: ticket.customerName },
    currentProfiles
  );

  if (!existing) {
    return {
      updatedProfiles: currentProfiles,
      updatedProfile: null,
      removedStamp: false,
      removedHighValue: false,
    };
  }

  const isHighValue = ticket.totalUSD >= FIDELIS_HIGH_VALUE_THRESHOLD;
  const now = new Date().toISOString();

  // Decrement stamps safely
  let newStamps = existing.stampsCount;
  let newStampsCycles = existing.stampsCycles;
  if (newStamps > 0) {
    newStamps -= 1;
  } else if (newStampsCycles > 0) {
    newStampsCycles -= 1;
    newStamps = FIDELIS_STAMPS_GOAL - 1;
  }

  // Decrement high value safely
  let newHighValue = existing.highValueCount;
  let newHighValueCycles = existing.highValueCycles;
  if (isHighValue) {
    if (newHighValue > 0) {
      newHighValue -= 1;
    } else if (newHighValueCycles > 0) {
      newHighValueCycles -= 1;
      newHighValue = FIDELIS_HIGH_VALUE_GOAL - 1;
    }
  }

  const updated: FidelisCustomerProfile = {
    ...existing,
    stampsCount: newStamps,
    stampsCycles: newStampsCycles,
    highValueCount: newHighValue,
    highValueCycles: newHighValueCycles,
    totalSpentUSD: Math.max(0, Math.round(((existing.totalSpentUSD || 0) - ticket.totalUSD) * 100) / 100),
    totalTransactions: Math.max(0, (existing.totalTransactions || 0) - 1),
    updatedAt: now,
  };

  const updatedProfiles = {
    ...currentProfiles,
    [existing.id]: updated,
  };

  saveFidelisProfiles(updatedProfiles);

  return {
    updatedProfiles,
    updatedProfile: updated,
    removedStamp: true,
    removedHighValue: isHighValue,
  };
}

/**
 * Updates an existing Fidelis customer profile or creates a new one manually.
 * Handles key re-indexing if customer credentials changed.
 */
export function updateFidelisCustomerProfile(
  oldId: string,
  updatedData: Partial<FidelisCustomerProfile> & {
    customerName: string;
    customerCedula?: string;
    customerPhone?: string;
  },
  currentProfiles: Record<string, FidelisCustomerProfile>
): {
  updatedProfiles: Record<string, FidelisCustomerProfile>;
  updatedProfile: FidelisCustomerProfile;
} {
  const existing = currentProfiles[oldId];
  const now = new Date().toISOString();

  const newId =
    normalizeCustomerId(updatedData.customerCedula, updatedData.customerPhone, updatedData.customerName) ||
    oldId ||
    `CLI-${Date.now()}`;

  const updated: FidelisCustomerProfile = {
    id: newId,
    customerName: (updatedData.customerName || '').trim() || 'Cliente Fidelis',
    customerCedula: (updatedData.customerCedula || '').trim(),
    customerPhone: (updatedData.customerPhone || '').trim(),
    stampsCount: Math.max(0, updatedData.stampsCount ?? (existing?.stampsCount || 0)),
    stampsGoal: FIDELIS_STAMPS_GOAL,
    stampsCycles: Math.max(0, updatedData.stampsCycles ?? (existing?.stampsCycles || 0)),
    stampsClaimed: Math.max(0, updatedData.stampsClaimed ?? (existing?.stampsClaimed || 0)),
    highValueCount: Math.max(0, updatedData.highValueCount ?? (existing?.highValueCount || 0)),
    highValueGoal: FIDELIS_HIGH_VALUE_GOAL,
    highValueThresholdUSD: FIDELIS_HIGH_VALUE_THRESHOLD,
    highValueCycles: Math.max(0, updatedData.highValueCycles ?? (existing?.highValueCycles || 0)),
    highValueClaimed: Math.max(0, updatedData.highValueClaimed ?? (existing?.highValueClaimed || 0)),
    totalSpentUSD: Math.max(0, Math.round((updatedData.totalSpentUSD ?? (existing?.totalSpentUSD || 0)) * 100) / 100),
    totalTransactions: Math.max(0, updatedData.totalTransactions ?? (existing?.totalTransactions || 0)),
    lastPurchaseDate: updatedData.lastPurchaseDate || existing?.lastPurchaseDate || now,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  const newProfiles = { ...currentProfiles };
  if (oldId && oldId !== newId) {
    delete newProfiles[oldId];
  }
  newProfiles[newId] = updated;

  saveFidelisProfiles(newProfiles);

  return {
    updatedProfiles: newProfiles,
    updatedProfile: updated,
  };
}

/**
 * Deletes a customer profile from Fidelis directory.
 */
export function deleteFidelisCustomerProfile(
  customerId: string,
  currentProfiles: Record<string, FidelisCustomerProfile>
): Record<string, FidelisCustomerProfile> {
  const newProfiles = { ...currentProfiles };
  delete newProfiles[customerId];
  saveFidelisProfiles(newProfiles);
  return newProfiles;
}

/**
 * Processes a batch of tickets (e.g. during invoice loading / import),
 * matches which customer corresponds to each purchase, and adds their loyalty stamps!
 */
export function syncAndSumTicketsToFidelis(
  ticketsToProcess: SaleTicket[],
  currentProfiles: Record<string, FidelisCustomerProfile> = {},
  options: { resetBeforeSync?: boolean } = {}
): {
  updatedProfiles: Record<string, FidelisCustomerProfile>;
  processedTicketsCount: number;
  matchedCustomersCount: number;
  totalStampsAdded: number;
  totalHighValueAdded: number;
  newCustomersCreatedCount: number;
} {
  const profiles: Record<string, FidelisCustomerProfile> = options.resetBeforeSync
    ? {}
    : { ...currentProfiles };

  let totalStampsAdded = 0;
  let totalHighValueAdded = 0;
  let processedTicketsCount = 0;
  let newCustomersCreatedCount = 0;
  const touchedCustomers = new Set<string>();

  // Filter out voided tickets and sort chronologically
  const validTickets = ticketsToProcess
    .filter((t) => !t.isVoided)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  for (const t of validTickets) {
    processedTicketsCount++;

    // Find who this purchase corresponds to
    const existingMatch = findFidelisProfile(
      { cedula: t.customerCedula, phone: t.customerPhone, name: t.customerName },
      profiles
    );

    let customerId = existingMatch
      ? existingMatch.id
      : normalizeCustomerId(t.customerCedula, t.customerPhone, t.customerName);

    if (!customerId) {
      if (t.customerName && t.customerName.trim().toLowerCase() !== 'consumidor final') {
        customerId = `NAME:${t.customerName.trim().toLowerCase().replace(/[^a-z0-9]/g, '')}`;
      } else {
        continue; // Anonymous walk-in
      }
    }

    const existing = profiles[customerId];
    if (!existing) {
      newCustomersCreatedCount++;
    }

    const isHighValue = t.totalUSD >= FIDELIS_HIGH_VALUE_THRESHOLD;

    const currentStamps = (existing ? existing.stampsCount : 0) + 1;
    const currentHighValue = (existing ? existing.highValueCount : 0) + (isHighValue ? 1 : 0);

    let stampsCycles = existing ? existing.stampsCycles : 0;
    if (currentStamps >= FIDELIS_STAMPS_GOAL) {
      stampsCycles += 1;
    }

    let highValueCycles = existing ? existing.highValueCycles : 0;
    if (isHighValue && currentHighValue >= FIDELIS_HIGH_VALUE_GOAL) {
      highValueCycles += 1;
    }

    const now = new Date().toISOString();

    const updatedProfile: FidelisCustomerProfile = {
      id: customerId,
      customerName: t.customerName || existing?.customerName || 'Cliente Fidelis',
      customerCedula: t.customerCedula || existing?.customerCedula || '',
      customerPhone: t.customerPhone || existing?.customerPhone || '',
      stampsCount: currentStamps,
      stampsGoal: FIDELIS_STAMPS_GOAL,
      stampsCycles,
      stampsClaimed: existing?.stampsClaimed || 0,
      highValueCount: currentHighValue,
      highValueGoal: FIDELIS_HIGH_VALUE_GOAL,
      highValueThresholdUSD: FIDELIS_HIGH_VALUE_THRESHOLD,
      highValueCycles,
      highValueClaimed: existing?.highValueClaimed || 0,
      totalSpentUSD: Math.round(((existing?.totalSpentUSD || 0) + t.totalUSD) * 100) / 100,
      totalTransactions: (existing?.totalTransactions || 0) + 1,
      lastPurchaseDate: t.date || now,
      createdAt: existing?.createdAt || t.date || now,
      updatedAt: now,
    };

    profiles[customerId] = updatedProfile;
    touchedCustomers.add(customerId);
    totalStampsAdded += 1;
    if (isHighValue) totalHighValueAdded += 1;
  }

  saveFidelisProfiles(profiles);

  return {
    updatedProfiles: profiles,
    processedTicketsCount,
    matchedCustomersCount: touchedCustomers.size,
    totalStampsAdded,
    totalHighValueAdded,
    newCustomersCreatedCount,
  };
}
