import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Lazy load IAP — safely handles both Expo Go (no native module) and production builds
let _iap: any = null;
let _iapChecked = false;

function getIAP() {
  if (_iapChecked) return _iap;
  _iapChecked = true;
  try {
    // Guard: require() can throw a fatal error in Expo Go even inside try/catch
    // if the native module is missing. Check Platform first.
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return _iap;
    const mod = require('expo-in-app-purchases');
    // Verify the native module is actually linked (not just a JS stub)
    if (mod && typeof mod.connectAsync === 'function') {
      // Test that the native bridge is present by checking for the native module
      const hasNative = mod.default || mod.connectAsync;
      if (hasNative) _iap = mod;
    }
  } catch (e: any) {
    // Silently swallow — expected in Expo Go where native IAP module isn't available
    _iap = null;
  }
  return _iap;
}

// --- Product IDs ---
const CREDIT_PRODUCT_IDS = [
  'com.firstimpressionai.app.credits.5',
  'com.firstimpressionai.app.credits.15',
  'com.firstimpressionai.app.credits.50',
];

const SUB_PRODUCT_IDS = [
  'com.firstimpressionai.app.pro.weekly',
  'com.firstimpressionai.app.pro.monthly',
];

const ALL_PRODUCT_IDS = [...CREDIT_PRODUCT_IDS, ...SUB_PRODUCT_IDS];

// --- Storage keys ---
const CREDITS_KEY = '@myfacescore_credits';
const FREE_USED_KEY = '@myfacescore_free_used';
const PRO_STATUS_KEY = '@myfacescore_pro';
const PRO_PLAN_KEY = '@myfacescore_pro_plan';
const PERIOD_COUNT_KEY = '@myfacescore_period_count';
const PERIOD_START_KEY = '@myfacescore_period_start';
const AI_CONSENT_KEY = '@myfacescore_ai_consent';

const FREE_LIMIT = 2;
const CHAT_COUNT_PREFIX = '@myfacescore_chat_';

// Credit packs: productId -> credits granted
const CREDIT_PACKS: Record<string, number> = {
  'com.firstimpressionai.app.credits.5': 5,
  'com.firstimpressionai.app.credits.15': 15,
  'com.firstimpressionai.app.credits.50': 50,
};

// Pro rate limits
const PLAN_LIMITS: Record<string, { limit: number; periodDays: number }> = {
  'com.firstimpressionai.app.pro.weekly':  { limit: 30, periodDays: 7 },
  'com.firstimpressionai.app.pro.monthly': { limit: 100, periodDays: 30 },
};

// --- Credits ---

export async function getCredits(): Promise<number> {
  const val = await AsyncStorage.getItem(CREDITS_KEY);
  return val ? parseInt(val, 10) : 0;
}

export async function addCredits(amount: number): Promise<number> {
  const current = await getCredits();
  const updated = current + amount;
  await AsyncStorage.setItem(CREDITS_KEY, updated.toString());
  return updated;
}

async function useCredit(): Promise<void> {
  const current = await getCredits();
  await AsyncStorage.setItem(CREDITS_KEY, Math.max(0, current - 1).toString());
}

// --- Free tier ---

export async function getFreeUsed(): Promise<number> {
  const val = await AsyncStorage.getItem(FREE_USED_KEY);
  return val ? parseInt(val, 10) : 0;
}

async function incrementFreeUsed(): Promise<void> {
  const used = await getFreeUsed();
  await AsyncStorage.setItem(FREE_USED_KEY, (used + 1).toString());
}

export async function getRemainingFree(): Promise<number> {
  const used = await getFreeUsed();
  return Math.max(0, FREE_LIMIT - used);
}

// --- Pro status ---

export async function getProStatus(): Promise<boolean> {
  const val = await AsyncStorage.getItem(PRO_STATUS_KEY);
  return val === 'true';
}

export async function setProStatus(active: boolean, planId?: string): Promise<void> {
  await AsyncStorage.setItem(PRO_STATUS_KEY, active ? 'true' : 'false');
  if (planId) {
    await AsyncStorage.setItem(PRO_PLAN_KEY, planId);
    await AsyncStorage.setItem(PERIOD_COUNT_KEY, '0');
    await AsyncStorage.setItem(PERIOD_START_KEY, Date.now().toString());
  }
}

// --- AI Consent ---

export async function hasAIConsent(): Promise<boolean> {
  return (await AsyncStorage.getItem(AI_CONSENT_KEY)) === 'true';
}

export async function setAIConsent(): Promise<void> {
  await AsyncStorage.setItem(AI_CONSENT_KEY, 'true');
}

// --- Pro rate limiting ---

async function getPeriodCount(): Promise<number> {
  const val = await AsyncStorage.getItem(PERIOD_COUNT_KEY);
  return val ? parseInt(val, 10) : 0;
}

async function incrementPeriodCount(): Promise<void> {
  const count = await getPeriodCount();
  await AsyncStorage.setItem(PERIOD_COUNT_KEY, (count + 1).toString());
}

async function resetPeriodIfNeeded(): Promise<void> {
  const plan = await AsyncStorage.getItem(PRO_PLAN_KEY);
  if (!plan) return;
  const config = PLAN_LIMITS[plan];
  if (!config) return;
  const startStr = await AsyncStorage.getItem(PERIOD_START_KEY);
  const start = startStr ? parseInt(startStr, 10) : Date.now();
  const elapsed = Date.now() - start;
  if (elapsed >= config.periodDays * 86400000) {
    await AsyncStorage.setItem(PERIOD_COUNT_KEY, '0');
    await AsyncStorage.setItem(PERIOD_START_KEY, Date.now().toString());
  }
}

async function getProRemaining(): Promise<number> {
  const plan = await AsyncStorage.getItem(PRO_PLAN_KEY);
  if (!plan) return 0;
  const config = PLAN_LIMITS[plan];
  if (!config) return 999;
  await resetPeriodIfNeeded();
  const used = await getPeriodCount();
  return Math.max(0, config.limit - used);
}

// --- Combined access check ---

export type AnalysisStatus = {
  allowed: boolean;
  reason: 'free' | 'credits' | 'pro' | 'paywall' | 'pro_limit';
  remaining?: number;
};

export async function checkAccess(): Promise<AnalysisStatus> {
  // Dev/owner unlimited bypass via secret flag
  const devFlag = await AsyncStorage.getItem('@myfacescore_dev_unlimited');
  if (devFlag === 'true') return { allowed: true, reason: 'pro', remaining: 999 };

  // 1. Pro subscriber
  const isPro = await getProStatus();
  if (isPro) {
    const remaining = await getProRemaining();
    if (remaining > 0) return { allowed: true, reason: 'pro', remaining };
    return { allowed: false, reason: 'pro_limit', remaining: 0 };
  }

  // 2. Has credits
  const credits = await getCredits();
  if (credits > 0) return { allowed: true, reason: 'credits', remaining: credits };

  // 3. Free tier
  const freeUsed = await getFreeUsed();
  if (freeUsed < FREE_LIMIT) return { allowed: true, reason: 'free', remaining: FREE_LIMIT - freeUsed };

  // 4. Paywall
  return { allowed: false, reason: 'paywall' };
}

export async function consumeAnalysis(): Promise<void> {
  const { reason } = await checkAccess();
  if (reason === 'free') {
    await incrementFreeUsed();
  } else if (reason === 'credits') {
    await useCredit();
  } else if (reason === 'pro') {
    await incrementPeriodCount();
  }
}

// --- History ---

const HISTORY_KEY = '@myfacescore_history';

export interface HistoryEntry {
  id: string;
  context: string;
  overall: number;
  summary: string;
  image_url?: string;
  created_at: string;
}

export async function getHistory(): Promise<HistoryEntry[]> {
  const raw = await AsyncStorage.getItem(HISTORY_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function addToHistory(entry: HistoryEntry): Promise<void> {
  const history = await getHistory();
  // Prepend new entry, keep max 50
  const updated = [entry, ...history.filter(h => h.id !== entry.id)].slice(0, 50);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}

export async function clearHistory(): Promise<void> {
  await AsyncStorage.removeItem(HISTORY_KEY);
}

// --- Store / IAP ---

export async function initStore(): Promise<void> {
  const iap = getIAP();
  if (!iap) return;
  try {
    await iap.connectAsync();
  } catch {
    // Already connected or not available
  }
}

export async function getProducts(): Promise<any[]> {
  const iap = getIAP();
  if (!iap) return [];
  try {
    const { results } = await iap.getProductsAsync(ALL_PRODUCT_IDS);
    return results || [];
  } catch {
    return [];
  }
}

export async function purchaseProduct(productId: string): Promise<boolean> {
  const iap = getIAP();
  if (!iap) return false;
  try {
    await iap.purchaseItemAsync(productId);
    return true;
  } catch {
    return false;
  }
}

export function setPurchaseListener(
  onPurchase: (result: any) => void
): void {
  const iap = getIAP();
  if (!iap) return;
  iap.setPurchaseListener(({ responseCode, results }: any) => {
    if (responseCode === iap.IAPResponseCode.OK && results) {
      for (const result of results) {
        onPurchase(result);
      }
    }
  });
}

export async function handlePurchaseResult(result: any): Promise<'credits' | 'subscription'> {
  const iap = getIAP();
  const productId = result.productId;

  if (productId in CREDIT_PACKS) {
    await addCredits(CREDIT_PACKS[productId]);
    if (iap) await iap.finishTransactionAsync(result.purchaseToken || '', true);
    return 'credits';
  } else {
    await setProStatus(true, productId);
    if (iap) await iap.finishTransactionAsync(result.purchaseToken || '', true);
    return 'subscription';
  }
}

export async function restorePurchases(): Promise<boolean> {
  const iap = getIAP();
  if (!iap) return false;
  try {
    const { results } = await iap.getPurchaseHistoryAsync();
    if (results && results.length > 0) {
      for (const r of results) {
        if (SUB_PRODUCT_IDS.includes(r.productId)) {
          await setProStatus(true, r.productId);
          return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

// --- Chat limits ---

export async function getChatCount(jobId: string): Promise<number> {
  const val = await AsyncStorage.getItem(`${CHAT_COUNT_PREFIX}${jobId}`);
  return val ? parseInt(val, 10) : 0;
}

export async function incrementChatCount(jobId: string): Promise<number> {
  const count = await getChatCount(jobId) + 1;
  await AsyncStorage.setItem(`${CHAT_COUNT_PREFIX}${jobId}`, count.toString());
  return count;
}

export async function getChatLimit(): Promise<number> {
  const devFlag = await AsyncStorage.getItem('@myfacescore_dev_unlimited');
  if (devFlag === 'true') return 999;

  const isPro = await getProStatus();
  if (isPro) return 999;

  const credits = await getCredits();
  if (credits > 0) return 5;

  return 2;
}

// --- Dev/owner unlimited ---

export async function activateDevUnlimited(): Promise<void> {
  await AsyncStorage.setItem('@myfacescore_dev_unlimited', 'true');
}

export async function deactivateDevUnlimited(): Promise<void> {
  await AsyncStorage.removeItem('@myfacescore_dev_unlimited');
}

export async function isDevUnlimited(): Promise<boolean> {
  return (await AsyncStorage.getItem('@myfacescore_dev_unlimited')) === 'true';
}

// --- Product helpers ---

export function isCreditProduct(productId: string): boolean {
  return productId in CREDIT_PACKS;
}

export function isSubProduct(productId: string): boolean {
  return SUB_PRODUCT_IDS.includes(productId);
}
