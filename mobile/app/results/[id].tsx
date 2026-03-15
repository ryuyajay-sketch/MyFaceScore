import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, Alert, Animated } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { GlassCard } from '../../components/GlassCard';
import { colors, fonts, radius } from '../../lib/theme';
import { DIMENSION_CONFIG, CONTEXT_LABELS, percentileLabel, type Context } from '../../lib/constants';
import { getResults, type ResultsResponse, type DimensionResult } from '../../lib/api';

const CATEGORY_LABELS: Record<string, string> = {
  expression: 'Expression', lighting: 'Lighting', pose: 'Pose', grooming: 'Grooming',
  framing: 'Framing', background: 'Background', gaze: 'Eye Contact', angle: 'Camera Angle',
};

function FadeInView({ delay = 0, children, style }: { delay?: number; children: React.ReactNode; style?: any }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 500, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

function ScoreBar({ score, color, delay }: { score: number; color: string; delay: number }) {
  const width = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(width, { toValue: score, duration: 1200, delay: delay * 1000, useNativeDriver: false }).start();
  }, []);
  const barWidth = width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  return (
    <View style={styles.barTrack}>
      <Animated.View style={[styles.barFill, { width: barWidth, backgroundColor: color }]} />
    </View>
  );
}

function DimensionCard({ config, data, index }: { config: typeof DIMENSION_CONFIG[number]; data: DimensionResult; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const delay = 300 + index * 120;

  return (
    <FadeInView delay={delay}>
      <View style={[styles.dimCard, { backgroundColor: config.bgColor, borderColor: config.borderColor }]}>
        <View style={styles.dimHeader}>
          <View style={styles.dimLabelRow}>
            <Text style={styles.dimIcon}>{config.icon}</Text>
            <View>
              <Text style={styles.dimLabel}>{config.label}</Text>
              <Text style={[styles.dimPercentile, { color: config.color }]}>{percentileLabel(data.percentile)}</Text>
            </View>
          </View>
          <View style={styles.dimScoreCol}>
            <Text style={styles.dimScore}>{data.score}</Text>
            <Text style={styles.dimScoreMax}>/ 100</Text>
          </View>
        </View>

        <ScoreBar score={data.score} color={config.color} delay={(delay + 200) / 1000} />
        <Text style={styles.dimAnalysis}>{data.analysis}</Text>

        {data.tips.length > 0 && (
          <View>
            <Pressable onPress={() => setExpanded(e => !e)} style={styles.tipsToggle}>
              <Text style={[styles.tipsToggleText, { color: config.color }]}>
                {expanded ? '▾ Hide tips' : `▸ ${data.tips.length} improvement tip${data.tips.length > 1 ? 's' : ''}`}
              </Text>
            </Pressable>
            {expanded && (
              <View style={styles.tipsList}>
                {data.tips.map((tip, i) => {
                  const tipText = typeof tip === 'string' ? tip : tip.text;
                  const tipCategory = typeof tip === 'string' ? 'expression' : (tip.category || 'expression');
                  return (
                    <View key={i} style={[styles.tipItem, { borderColor: `${config.color}30` }]}>
                      <Text style={[styles.tipCategory, { color: config.color }]}>{CATEGORY_LABELS[tipCategory] || tipCategory}</Text>
                      <Text style={styles.tipText}>{tipText}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
        <Text style={styles.dimResearch}>ℹ️ {config.research}</Text>
      </View>
    </FadeInView>
  );
}

export default function ResultsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<ResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<View>(null);

  useEffect(() => {
    if (!id) return;
    getResults(id).then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [id]);

  const handleShare = async () => {
    if (!cardRef.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your First Impression score' });
    } catch { Alert.alert('Share failed', 'Could not capture the results card.'); }
    finally { setSharing(false); }
  };

  if (loading) return (
    <View style={[styles.centered, { paddingTop: insets.top }]}>
      <ActivityIndicator size="large" color={colors.indigo[500]} />
      <Text style={styles.loadingText}>Loading results...</Text>
    </View>
  );

  if (error || !data) return (
    <View style={[styles.centered, { paddingTop: insets.top }]}>
      <GlassCard style={styles.errorCard}>
        <Text style={styles.errorText}>{error || 'Results not found.'}</Text>
        <Pressable onPress={() => router.replace('/upload')}><Text style={styles.errorLink}>Try again →</Text></Pressable>
      </GlassCard>
    </View>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.replace('/')}><Text style={styles.navBack}>← Home</Text></Pressable>
        <Pressable onPress={handleShare} disabled={sharing} style={styles.shareButton}>
          <Text style={styles.shareText}>{sharing ? '...' : '📤 Share'}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <FadeInView style={styles.header}>
          <Text style={styles.contextBadge}>Context: {CONTEXT_LABELS[data.context]}</Text>
          <Text style={styles.headerTitle}>Your First Impression</Text>
          <Text style={styles.headerSummary}>{data.summary}</Text>
        </FadeInView>

        <FadeInView delay={150}>
          <GlassCard style={styles.overallCard}>
            <View ref={cardRef} collapsable={false} style={styles.overallInner}>
              <View style={styles.overallScoreRow}>
                <Text style={styles.overallScore}>{data.overall}</Text>
                <Text style={styles.overallMax}>/100</Text>
              </View>
              <Text style={styles.overallLabel}>Overall · {percentileLabel(data.overall_percentile)}</Text>
              <View style={styles.miniGrid}>
                {DIMENSION_CONFIG.map((c) => (
                  <View key={c.key} style={styles.miniItem}>
                    <Text style={styles.miniIcon}>{c.icon}</Text>
                    <Text style={styles.miniScore}>{data[c.key].score}</Text>
                    <Text style={styles.miniLabel}>{c.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </GlassCard>
        </FadeInView>

        <View style={styles.dimensions}>
          {DIMENSION_CONFIG.map((config, i) => (
            <DimensionCard key={config.key} config={config} data={data[config.key]} index={i} />
          ))}
        </View>

        <FadeInView delay={1000}>
          <GlassCard style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>
              <Text style={styles.disclaimerBold}>Important: </Text>
              These scores reflect how your photo may be perceived by others — not who you are as a person. First-impression judgments are automatic and can embed social biases. Based on research by Todorov et al. (2005–2008).
            </Text>
          </GlassCard>
        </FadeInView>

        <Pressable onPress={() => router.push('/upload')} style={styles.tryAgain}>
          <Text style={styles.tryAgainText}>Try another photo</Text>
        </Pressable>
        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.slate[400], fontFamily: fonts.regular, fontSize: 14 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  navBack: { color: colors.slate[400], fontFamily: fonts.regular, fontSize: 14 },
  shareButton: { backgroundColor: colors.indigo[600], paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.sm },
  shareText: { color: colors.white, fontFamily: fonts.medium, fontSize: 14 },
  scrollContent: { paddingHorizontal: 20, gap: 20 },
  header: { alignItems: 'center', gap: 8 },
  contextBadge: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12 },
  headerTitle: { color: colors.white, fontFamily: fonts.bold, fontSize: 28 },
  headerSummary: { color: colors.slate[400], fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', lineHeight: 22, maxWidth: 320 },
  overallCard: { overflow: 'hidden' },
  overallInner: { padding: 24, alignItems: 'center', backgroundColor: colors.card, borderRadius: radius['2xl'] },
  overallScoreRow: { flexDirection: 'row', alignItems: 'baseline' },
  overallScore: { color: colors.indigo[400], fontFamily: fonts.bold, fontSize: 56 },
  overallMax: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 20, marginLeft: 4 },
  overallLabel: { color: colors.slate[400], fontFamily: fonts.regular, fontSize: 14, marginTop: 4 },
  miniGrid: { flexDirection: 'row', marginTop: 20, gap: 8 },
  miniItem: { flex: 1, alignItems: 'center', gap: 4 },
  miniIcon: { fontSize: 18 },
  miniScore: { color: colors.white, fontFamily: fonts.semiBold, fontSize: 14 },
  miniLabel: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 10, textAlign: 'center' },
  dimensions: { gap: 16 },
  dimCard: { borderWidth: 1, borderRadius: radius['2xl'], padding: 20, gap: 12 },
  dimHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  dimLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dimIcon: { fontSize: 22 },
  dimLabel: { color: colors.white, fontFamily: fonts.semiBold, fontSize: 14 },
  dimPercentile: { fontFamily: fonts.regular, fontSize: 12, marginTop: 2 },
  dimScoreCol: { alignItems: 'flex-end' },
  dimScore: { color: colors.white, fontFamily: fonts.bold, fontSize: 28 },
  dimScoreMax: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12 },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  dimAnalysis: { color: colors.slate[300], fontFamily: fonts.regular, fontSize: 13, lineHeight: 20 },
  dimResearch: { color: colors.textDim, fontFamily: fonts.regular, fontSize: 11 },
  tipsToggle: { paddingVertical: 4 },
  tipsToggleText: { fontFamily: fonts.medium, fontSize: 12 },
  tipsList: { gap: 8, marginTop: 8 },
  tipItem: { borderWidth: 1, borderRadius: radius.md, padding: 12, gap: 4 },
  tipCategory: { fontFamily: fonts.semiBold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  tipText: { color: colors.slate[300], fontFamily: fonts.regular, fontSize: 13, lineHeight: 20 },
  disclaimer: { padding: 16 },
  disclaimerText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 20 },
  disclaimerBold: { color: colors.slate[400], fontFamily: fonts.semiBold },
  errorCard: { padding: 32, alignItems: 'center', gap: 16, marginHorizontal: 20 },
  errorText: { color: colors.slate[400], fontFamily: fonts.regular, fontSize: 14, textAlign: 'center' },
  errorLink: { color: colors.indigo[400], fontFamily: fonts.medium, fontSize: 14 },
  tryAgain: { alignItems: 'center', paddingVertical: 8 },
  tryAgainText: { color: colors.slate[400], fontFamily: fonts.regular, fontSize: 14 },
});
