import { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Animated, ScrollView, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '../components/GlassCard';
import { colors, fonts, radius } from '../lib/theme';
import { initStore, getProducts, purchaseProduct, setPurchaseListener, handlePurchaseResult, restorePurchases, isCreditProduct } from '../lib/store';

type Tab = 'credits' | 'subscription';

interface CreditPack {
  id: string;
  scans: number;
  price: string;
  perScan: string;
  popular?: boolean;
}

interface SubPlan {
  id: string;
  label: string;
  price: string;
  period: string;
  detail: string;
}

export default function PaywallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('credits');
  const [selectedCredit, setSelectedCredit] = useState('com.firstimpressionai.app.credits.5');
  const [selectedSub, setSelectedSub] = useState('com.firstimpressionai.app.pro.monthly');
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const fadeIn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, []);

  const [creditPacks, setCreditPacks] = useState<CreditPack[]>([
    { id: 'com.firstimpressionai.app.credits.5', scans: 5, price: '$2.99', perScan: '$0.60' },
    { id: 'com.firstimpressionai.app.credits.15', scans: 15, price: '$6.99', perScan: '$0.47', popular: true },
    { id: 'com.firstimpressionai.app.credits.50', scans: 50, price: '$14.99', perScan: '$0.30' },
  ]);

  const [subPlans, setSubPlans] = useState<SubPlan[]>([
    { id: 'com.firstimpressionai.app.pro.weekly', label: 'Weekly', price: '$1.99', period: '/week', detail: '30 scans/week' },
    { id: 'com.firstimpressionai.app.pro.monthly', label: 'Monthly', price: '$4.99', period: '/month', detail: '100 scans/month' },
  ]);

  useEffect(() => {
    (async () => {
      try {
        await initStore();
        setPurchaseListener(async (result) => {
          if (result.acknowledged) return;
          const type = await handlePurchaseResult(result);
          setPurchasing(false);
          if (type === 'credits') {
            Alert.alert('Credits added!', 'Your scans are ready to use.', [
              { text: 'OK', onPress: () => router.back() },
            ]);
          } else {
            Alert.alert('Welcome to Pro!', 'You now have unlimited analyses.', [
              { text: 'OK', onPress: () => router.back() },
            ]);
          }
        });
        // Try loading real prices from store
        const products = await getProducts();
        if (products.length > 0) {
          const updatedCredits = creditPacks.map((pack) => {
            const product = products.find((p) => p.productId === pack.id);
            if (product) return { ...pack, price: product.price };
            return pack;
          });
          setCreditPacks(updatedCredits);
          const updatedSubs = subPlans.map((plan) => {
            const product = products.find((p) => p.productId === plan.id);
            if (product) return { ...plan, price: product.price };
            return plan;
          });
          setSubPlans(updatedSubs);
        }
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, []);

  const handlePurchase = async () => {
    const productId = tab === 'credits' ? selectedCredit : selectedSub;
    setPurchasing(true);
    const success = await purchaseProduct(productId);
    if (!success) setPurchasing(false);
  };

  const handleRestore = async () => {
    setRestoring(true);
    const restored = await restorePurchases();
    setRestoring(false);
    if (restored) {
      Alert.alert('Restored!', 'Your Pro subscription has been restored.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } else {
      Alert.alert('No purchases found', 'We couldn\'t find any active subscriptions.');
    }
  };

  return (
    <Animated.View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, opacity: fadeIn }]}>
      <Pressable onPress={() => router.back()} style={styles.closeButton}>
        <Text style={styles.closeText}>✕</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Unlock More{'\n'}Analyses</Text>
        <Text style={styles.subtitle}>Your 2 free scans are used up. Choose how you want to continue.</Text>

        {/* Tab switcher */}
        <View style={styles.tabs}>
          <Pressable onPress={() => setTab('credits')} style={[styles.tab, tab === 'credits' && styles.tabActive]}>
            <Text style={[styles.tabText, tab === 'credits' && styles.tabTextActive]}>Credit Packs</Text>
          </Pressable>
          <Pressable onPress={() => setTab('subscription')} style={[styles.tab, tab === 'subscription' && styles.tabActive]}>
            <Text style={[styles.tabText, tab === 'subscription' && styles.tabTextActive]}>Pro Plans</Text>
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={colors.indigo[500]} style={{ marginVertical: 40 }} />
        ) : tab === 'credits' ? (
          /* Credit packs */
          <View style={styles.packs}>
            {creditPacks.map((pack) => (
              <Pressable key={pack.id} onPress={() => setSelectedCredit(pack.id)} style={{ flex: 1 }}>
                <GlassCard style={[styles.packCard, selectedCredit === pack.id && styles.packSelected]}>
                  {pack.popular ? (
                    <Text style={styles.popularBadge}>Most Popular</Text>
                  ) : (
                    <View style={styles.badgeSpacer} />
                  )}
                  <Text style={styles.packScans}>{pack.scans}</Text>
                  <Text style={styles.packScansLabel}>scans</Text>
                  <Text style={styles.packPrice}>{pack.price}</Text>
                  <Text style={styles.packPerScan}>{pack.perScan}/scan</Text>
                </GlassCard>
              </Pressable>
            ))}
          </View>
        ) : (
          /* Subscription plans */
          <View style={styles.subs}>
            {subPlans.map((plan) => (
              <Pressable key={plan.id} onPress={() => setSelectedSub(plan.id)}>
                <GlassCard style={[styles.subCard, selectedSub === plan.id && styles.subSelected]}>
                  <View style={styles.subLeft}>
                    <Text style={styles.subLabel}>{plan.label}</Text>
                    <Text style={styles.subDetail}>{plan.detail}</Text>
                  </View>
                  <View style={styles.subRight}>
                    <Text style={styles.subPrice}>{plan.price}</Text>
                    <Text style={styles.subPeriod}>{plan.period}</Text>
                  </View>
                </GlassCard>
              </Pressable>
            ))}
            <Text style={styles.subNote}>Best for power users who analyze 10+ photos per week</Text>
          </View>
        )}

        {/* Purchase button */}
        <Pressable onPress={handlePurchase} disabled={purchasing || loading}>
          <LinearGradient
            colors={[colors.indigo[600], colors.purple[600]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.purchaseButton, (purchasing || loading) && { opacity: 0.5 }]}
          >
            {purchasing ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.purchaseText}>
                {tab === 'credits' ? 'Buy Credits' : 'Subscribe Now'}
              </Text>
            )}
          </LinearGradient>
        </Pressable>

        <Pressable onPress={handleRestore} disabled={restoring} style={styles.restoreButton}>
          <Text style={styles.restoreText}>{restoring ? 'Restoring...' : 'Restore Purchases'}</Text>
        </Pressable>

        <Text style={styles.legal}>
          {tab === 'credits'
            ? 'Credits never expire. One-time purchase, no subscription.'
            : 'Payment is charged to your Apple ID. Subscription auto-renews unless canceled at least 24 hours before the end of the current period. Manage in Settings.'}
        </Text>

        <View style={styles.legalLinks}>
          <Text
            style={styles.legalLink}
            onPress={() => Linking.openURL('https://ryuyajay-sketch.github.io/MyFaceScore/terms-of-use')}
          >
            Terms of Use
          </Text>
          <Text style={styles.legalSeparator}>·</Text>
          <Text
            style={styles.legalLink}
            onPress={() => Linking.openURL('https://ryuyajay-sketch.github.io/MyFaceScore/privacy-policy')}
          >
            Privacy Policy
          </Text>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  closeButton: { alignSelf: 'flex-end', padding: 8 },
  closeText: { color: colors.slate[400], fontSize: 20 },
  scroll: { paddingBottom: 20 },

  title: { color: colors.white, fontFamily: fonts.bold, fontSize: 30, textAlign: 'center', lineHeight: 38 },
  subtitle: { color: colors.slate[400], fontFamily: fonts.regular, fontSize: 15, textAlign: 'center', marginTop: 12, marginBottom: 24 },

  tabs: { flexDirection: 'row', backgroundColor: 'rgba(22,20,58,0.6)', borderRadius: radius.md, padding: 4, marginBottom: 24 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: colors.indigo[600] },
  tabText: { color: colors.slate[500], fontFamily: fonts.medium, fontSize: 14 },
  tabTextActive: { color: colors.white },

  // Credit packs
  packs: { flexDirection: 'row', gap: 10, marginBottom: 24, justifyContent: 'center' },
  packCard: { width: '100%', padding: 16, alignItems: 'center', gap: 2 },
  packSelected: { borderColor: colors.indigo[500], borderWidth: 2 },
  popularBadge: { color: colors.green[500], fontFamily: fonts.semiBold, fontSize: 10, height: 16, marginBottom: 4 },
  badgeSpacer: { height: 16, marginBottom: 4 },
  packScans: { color: colors.white, fontFamily: fonts.bold, fontSize: 32 },
  packScansLabel: { color: colors.slate[400], fontFamily: fonts.regular, fontSize: 12 },
  packPrice: { color: colors.white, fontFamily: fonts.semiBold, fontSize: 18, marginTop: 8 },
  packPerScan: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11 },

  // Subscriptions
  subs: { gap: 12, marginBottom: 24 },
  subCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
  subSelected: { borderColor: colors.indigo[500], borderWidth: 2 },
  subLeft: { gap: 4 },
  subLabel: { color: colors.white, fontFamily: fonts.semiBold, fontSize: 16 },
  subDetail: { color: colors.slate[400], fontFamily: fonts.regular, fontSize: 13 },
  subRight: { alignItems: 'flex-end' },
  subPrice: { color: colors.white, fontFamily: fonts.bold, fontSize: 22 },
  subPeriod: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12 },
  subNote: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, textAlign: 'center', marginTop: 4 },

  purchaseButton: { paddingVertical: 16, borderRadius: radius.lg, alignItems: 'center', marginBottom: 8 },
  purchaseText: { color: colors.white, fontFamily: fonts.semiBold, fontSize: 17 },

  restoreButton: { alignItems: 'center', paddingVertical: 14 },
  restoreText: { color: colors.slate[500], fontFamily: fonts.regular, fontSize: 13 },

  legal: { color: colors.textDim, fontFamily: fonts.regular, fontSize: 10, textAlign: 'center', lineHeight: 16, marginTop: 4 },

  legalLinks: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 8 },
  legalLink: { color: colors.indigo[300], fontFamily: fonts.regular, fontSize: 11, textDecorationLine: 'underline' },
  legalSeparator: { color: colors.textDim, fontFamily: fonts.regular, fontSize: 11 },
});
