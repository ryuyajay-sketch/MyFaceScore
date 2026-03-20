import { useEffect, useState, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Animated, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { colors, fonts, radius } from '../lib/theme';
import { CONTEXT_LABELS, type Context } from '../lib/constants';
import { getHistory, clearHistory, type HistoryEntry } from '../lib/store';

function FadeInView({ delay = 0, children, style }: { delay?: number; children: React.ReactNode; style?: any }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 400, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHistory().then(setHistory).finally(() => setLoading(false));
  }, []);

  const handleClear = () => {
    Alert.alert('Clear History', 'This will remove all saved results from this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => { await clearHistory(); setHistory([]); } },
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        {history.length > 0 && (
          <Pressable onPress={handleClear}>
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.title}>Your History</Text>

      {!loading && history.length === 0 ? (
        <FadeInView style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>No analyses yet</Text>
          <Text style={styles.emptySubtitle}>Your past results will appear here</Text>
          <GradientButton title="Analyze a photo" onPress={() => router.push('/upload')} style={{ marginTop: 16 }} />
        </FadeInView>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
          {history.map((entry, i) => (
            <FadeInView key={entry.id} delay={i * 60}>
              <Pressable onPress={() => router.push({ pathname: '/results/[id]', params: { id: entry.id } })}>
                <GlassCard style={styles.historyCard}>
                  <View style={styles.scoreCircle}>
                    <Text style={styles.scoreText}>{entry.overall}</Text>
                  </View>
                  <View style={styles.cardContent}>
                    <View style={styles.cardTopRow}>
                      <Text style={styles.contextLabel}>{CONTEXT_LABELS[entry.context as Context] || entry.context}</Text>
                      <Text style={styles.dateText}>{formatDate(entry.created_at)}</Text>
                    </View>
                    <Text style={styles.summaryText} numberOfLines={2}>{entry.summary}</Text>
                  </View>
                </GlassCard>
              </Pressable>
            </FadeInView>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backText: { color: colors.slate[400], fontFamily: fonts.regular, fontSize: 14 },
  clearText: { color: colors.red[400], fontFamily: fonts.medium, fontSize: 14 },
  title: { color: colors.white, fontFamily: fonts.bold, fontSize: 24, marginBottom: 20 },
  list: { gap: 12, paddingBottom: 20 },
  historyCard: { flexDirection: 'row', padding: 16, gap: 14, alignItems: 'center' },
  scoreCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(99,102,241,0.15)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)', alignItems: 'center', justifyContent: 'center' },
  scoreText: { color: colors.indigo[400], fontFamily: fonts.bold, fontSize: 18 },
  cardContent: { flex: 1, gap: 4 },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  contextLabel: { color: colors.indigo[300], fontFamily: fonts.medium, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  dateText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11 },
  summaryText: { color: colors.slate[400], fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyIcon: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { color: colors.white, fontFamily: fonts.semiBold, fontSize: 18 },
  emptySubtitle: { color: colors.slate[400], fontFamily: fonts.regular, fontSize: 14 },
});
