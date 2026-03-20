import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator, Alert, Animated, Image, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { GlassCard } from '../../components/GlassCard';
import { colors, fonts, radius } from '../../lib/theme';
import { DIMENSION_CONFIG, CONTEXT_LABELS, percentileLabel, type Context } from '../../lib/constants';
import { getResults, chatWithAI, BASE_URL, type ResultsResponse, type DimensionResult } from '../../lib/api';
import { getChatCount, incrementChatCount, getChatLimit, addToHistory } from '../../lib/store';

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
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatLimit, setChatLimit] = useState(2);
  const [chatCount, setChatCount] = useState(0);
  const chatLocked = chatCount >= chatLimit;
  const scrollRef = useRef<ScrollView>(null);
  const cardRef = useRef<View>(null);

  useEffect(() => {
    if (!id) return;
    getResults(id).then((result) => {
      setData(result);
      addToHistory({
        id: id!,
        context: result.context,
        overall: result.overall,
        summary: result.summary,
        image_url: result.image_url,
        created_at: result.created_at || new Date().toISOString(),
      });
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
    getChatCount(id).then(setChatCount);
    getChatLimit().then(setChatLimit);
  }, [id]);

  const handleChat = async () => {
    const msg = chatInput.trim();
    if (!msg || !id || chatLoading || chatLocked) return;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: msg }]);
    setChatLoading(true);
    try {
      const { reply } = await chatWithAI(id, msg);
      setChatMessages(prev => [...prev, { role: 'ai', text: reply }]);
      const newCount = await incrementChatCount(id);
      setChatCount(newCount);
    } catch {
      setChatMessages(prev => [...prev, { role: 'ai', text: 'Sorry, something went wrong. Try again.' }]);
    } finally {
      setChatLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleShare = async () => {
    if (!cardRef.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your AI impression' });
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
    <KeyboardAvoidingView style={[styles.screen, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.nav}>
        <Pressable onPress={() => router.replace('/')}><Text style={styles.navBack}>← Home</Text></Pressable>
        <Pressable onPress={handleShare} disabled={sharing} style={styles.shareButton}>
          <Text style={styles.shareText}>{sharing ? '...' : 'Share'}</Text>
        </Pressable>
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <FadeInView style={styles.header}>
          <Text style={styles.contextBadge}>Context: {CONTEXT_LABELS[data.context]}</Text>
          <Text style={styles.headerTitle}>Your AI Impression</Text>
          <Text style={styles.headerSummary}>{data.summary}</Text>
        </FadeInView>

        <FadeInView delay={150}>
          <GlassCard style={styles.overallCard}>
            <View ref={cardRef} collapsable={false} style={styles.overallInner}>
              {data.image_url && (
                <Image
                  source={{ uri: `${BASE_URL}${data.image_url}` }}
                  style={styles.resultPhoto}
                />
              )}
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

        <FadeInView delay={200}>
          <GlassCard style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>
              <Text style={styles.disclaimerBold}>Important: </Text>
              These are AI-generated impressions based on your photo — not scientific measurements. They reflect how an AI interprets visual cues, not objective truth. Results are subjective and may not reflect how real people perceive you.
            </Text>
          </GlassCard>
        </FadeInView>

        <View style={styles.dimensions}>
          {DIMENSION_CONFIG.map((config, i) => (
            <DimensionCard key={config.key} config={config} data={data[config.key]} index={i} />
          ))}
        </View>

        <FadeInView delay={1100}>
          <GlassCard style={styles.chatSection}>
            <Text style={styles.chatTitle}>Ask the AI</Text>
            <Text style={styles.chatSubtitle}>Get personalized tips about your photo</Text>

            {chatMessages.map((msg, i) => (
              <View key={i} style={msg.role === 'user' ? styles.chatBubbleUser : styles.chatBubbleAI}>
                <Text style={msg.role === 'user' ? styles.chatTextUser : styles.chatTextAI}>{msg.text}</Text>
              </View>
            ))}
            {chatLoading && (
              <View style={styles.chatBubbleAI}>
                <ActivityIndicator size="small" color={colors.indigo[400]} />
              </View>
            )}

            {chatLocked ? (
              <Pressable style={styles.chatPaywall} onPress={() => router.push('/paywall')}>
                <Text style={styles.chatPaywallText}>Unlock unlimited AI chat</Text>
                <Text style={styles.chatPaywallSub}>Upgrade to Pro or buy credits for more questions</Text>
              </Pressable>
            ) : (
              <>
                {chatLimit < 999 && (
                  <Text style={styles.chatRemaining}>{chatLimit - chatCount} message{chatLimit - chatCount !== 1 ? 's' : ''} remaining</Text>
                )}
                <View style={styles.chatInputRow}>
                  <TextInput
                    style={styles.chatInput}
                    placeholder="e.g. How can I look more approachable?"
                    placeholderTextColor={colors.textMuted}
                    value={chatInput}
                    onChangeText={setChatInput}
                    onSubmitEditing={handleChat}
                    returnKeyType="send"
                    editable={!chatLoading}
                  />
                  <Pressable style={[styles.chatSend, chatLoading && styles.disabled]} onPress={handleChat} disabled={chatLoading}>
                    <Text style={styles.chatSendText}>→</Text>
                  </Pressable>
                </View>
              </>
            )}
          </GlassCard>
        </FadeInView>

        <Pressable onPress={() => router.push('/upload')} style={styles.tryAgain}>
          <Text style={styles.tryAgainText}>Try another photo</Text>
        </Pressable>
        <View style={{ height: insets.bottom + 20 }} />
      </ScrollView>
    </KeyboardAvoidingView>
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
  resultPhoto: { width: 100, height: 100, borderRadius: 50, marginBottom: 16, borderWidth: 2, borderColor: colors.border },
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
  chatSection: { padding: 20, gap: 12 },
  chatTitle: { color: colors.white, fontFamily: fonts.semiBold, fontSize: 16 },
  chatSubtitle: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, marginTop: -4 },
  chatBubbleUser: { alignSelf: 'flex-end', backgroundColor: colors.indigo[600], borderRadius: radius.lg, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '85%' },
  chatBubbleAI: { alignSelf: 'flex-start', backgroundColor: 'rgba(99,102,241,0.1)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)', borderRadius: radius.lg, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10, maxWidth: '85%' },
  chatTextUser: { color: colors.white, fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  chatTextAI: { color: colors.slate[300], fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  chatRemaining: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11, textAlign: 'right' },
  chatPaywall: { backgroundColor: 'rgba(99,102,241,0.1)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)', borderRadius: radius.md, padding: 16, alignItems: 'center', gap: 4 },
  chatPaywallText: { color: colors.indigo[300], fontFamily: fonts.semiBold, fontSize: 14 },
  chatPaywallSub: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12 },
  chatInputRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  chatInput: { flex: 1, backgroundColor: 'rgba(22,20,58,0.6)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, color: colors.white, fontFamily: fonts.regular, fontSize: 14 },
  chatSend: { backgroundColor: colors.indigo[600], borderRadius: radius.md, width: 44, alignItems: 'center', justifyContent: 'center' },
  chatSendText: { color: colors.white, fontFamily: fonts.bold, fontSize: 18 },
  disabled: { opacity: 0.4 },
  tryAgain: { alignItems: 'center', paddingVertical: 8 },
  tryAgainText: { color: colors.slate[400], fontFamily: fonts.regular, fontSize: 14 },
});
