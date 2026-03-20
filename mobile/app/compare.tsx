import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ActivityIndicator, Alert, Animated, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { colors, fonts, radius } from '../lib/theme';
import { CONTEXTS, type Context } from '../lib/constants';
import { compareImages, type CompareResponse } from '../lib/api';
import { checkAccess, consumeAnalysis } from '../lib/store';

type CompareState = 'picking' | 'comparing' | 'results';

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

export default function CompareScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<CompareState>('picking');
  const [photoA, setPhotoA] = useState<string | null>(null);
  const [photoB, setPhotoB] = useState<string | null>(null);
  const [context, setContext] = useState<Context>('professional');
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pickPhoto = async (setter: (uri: string) => void) => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permission needed', 'Please allow photo library access.');
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, quality: 0.9 });
      if (res.canceled) return;
      const manipulated = await ImageManipulator.manipulateAsync(
        res.assets[0].uri,
        [{ resize: { width: 512 } }],
        { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG }
      );
      setter(manipulated.uri);
    } catch {
      Alert.alert('Error', 'Failed to pick photo.');
    }
  };

  const handleCompare = async () => {
    if (!photoA || !photoB) return;

    const { allowed, reason } = await checkAccess();
    if (!allowed) {
      if (reason === 'paywall') router.push('/paywall');
      else Alert.alert('Limit reached', 'You\'ve hit your analysis limit.');
      return;
    }

    setState('comparing');
    setError(null);
    try {
      const res = await compareImages(photoA, photoB, context);
      await consumeAnalysis();
      setResult(res);
      setState('results');
    } catch (err: any) {
      setError(err.message || 'Comparison failed.');
      setState('picking');
    }
  };

  const handleReset = () => {
    setPhotoA(null);
    setPhotoB(null);
    setResult(null);
    setState('picking');
    setError(null);
  };

  const dimensions = ['trustworthiness', 'competence', 'approachability', 'attractiveness'] as const;
  const dimColors: Record<string, string> = {
    trustworthiness: '#06b6d4',
    competence: '#6366f1',
    approachability: '#22c55e',
    attractiveness: '#a855f7',
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </View>

      {state === 'comparing' && (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={colors.indigo[500]} />
          <Text style={styles.loadingText}>Comparing photos...</Text>
          <Text style={styles.loadingSubtext}>This takes about 10-15 seconds</Text>
        </View>
      )}

      {state === 'picking' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPadding}>
          <FadeInView>
            <Text style={styles.title}>Compare Photos</Text>
            <Text style={styles.subtitle}>Which photo makes a better first impression?</Text>
          </FadeInView>

          <FadeInView delay={100}>
            <View style={styles.photoRow}>
              <Pressable style={styles.photoSlot} onPress={() => pickPhoto(setPhotoA)}>
                {photoA ? (
                  <Image source={{ uri: photoA }} style={styles.photoImage} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.photoPlaceholderLabel}>A</Text>
                    <Text style={styles.photoPlaceholderText}>Tap to add</Text>
                  </View>
                )}
              </Pressable>

              <Text style={styles.vsText}>VS</Text>

              <Pressable style={styles.photoSlot} onPress={() => pickPhoto(setPhotoB)}>
                {photoB ? (
                  <Image source={{ uri: photoB }} style={styles.photoImage} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Text style={styles.photoPlaceholderLabel}>B</Text>
                    <Text style={styles.photoPlaceholderText}>Tap to add</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </FadeInView>

          <FadeInView delay={200}>
            <Text style={styles.sectionLabel}>Context</Text>
            <View style={styles.contextRow}>
              {CONTEXTS.map((c) => (
                <Pressable key={c.id} onPress={() => setContext(c.id)} style={[styles.contextChip, context === c.id && styles.contextChipActive]}>
                  <Text style={[styles.contextChipText, context === c.id && styles.contextChipTextActive]}>{c.label}</Text>
                </Pressable>
              ))}
            </View>
          </FadeInView>

          {error && (
            <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>
          )}

          <FadeInView delay={300}>
            <GradientButton
              title="Compare →"
              onPress={handleCompare}
              disabled={!photoA || !photoB}
              style={{ marginTop: 24 }}
            />
          </FadeInView>
        </ScrollView>
      )}

      {state === 'results' && result && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollPadding}>
          <FadeInView>
            <Text style={styles.title}>Results</Text>
            <Text style={styles.verdictText}>{result.verdict}</Text>
          </FadeInView>

          <FadeInView delay={100}>
            <View style={styles.photoRow}>
              <View style={styles.resultPhotoWrap}>
                {photoA && <Image source={{ uri: photoA }} style={styles.resultPhoto} />}
                <View style={[styles.resultBadge, result.winner === 'A' && styles.winnerBadge]}>
                  <Text style={styles.resultBadgeText}>{result.photo_a.overall}</Text>
                </View>
                {result.winner === 'A' && <Text style={styles.winnerLabel}>Winner</Text>}
              </View>

              <Text style={styles.vsText}>VS</Text>

              <View style={styles.resultPhotoWrap}>
                {photoB && <Image source={{ uri: photoB }} style={styles.resultPhoto} />}
                <View style={[styles.resultBadge, result.winner === 'B' && styles.winnerBadge]}>
                  <Text style={styles.resultBadgeText}>{result.photo_b.overall}</Text>
                </View>
                {result.winner === 'B' && <Text style={styles.winnerLabel}>Winner</Text>}
              </View>
            </View>
          </FadeInView>

          <FadeInView delay={200}>
            <GlassCard style={styles.breakdownCard}>
              <Text style={styles.breakdownTitle}>Score Breakdown</Text>
              {dimensions.map((dim) => (
                <View key={dim} style={styles.breakdownRow}>
                  <Text style={[styles.breakdownLabel, { color: dimColors[dim] }]}>
                    {dim.charAt(0).toUpperCase() + dim.slice(1)}
                  </Text>
                  <Text style={styles.breakdownScore}>{result.photo_a[dim]}</Text>
                  <View style={styles.breakdownBarWrap}>
                    <View style={[styles.breakdownBarA, { width: `${result.photo_a[dim]}%`, backgroundColor: dimColors[dim] }]} />
                  </View>
                  <View style={styles.breakdownBarWrap}>
                    <View style={[styles.breakdownBarB, { width: `${result.photo_b[dim]}%`, backgroundColor: dimColors[dim], opacity: 0.5 }]} />
                  </View>
                  <Text style={styles.breakdownScore}>{result.photo_b[dim]}</Text>
                </View>
              ))}
              <View style={styles.breakdownLegend}>
                <Text style={styles.legendItem}>Photo A</Text>
                <Text style={styles.legendItem}>Photo B</Text>
              </View>
            </GlassCard>
          </FadeInView>

          <FadeInView delay={300}>
            <View style={styles.prosConsRow}>
              <GlassCard style={styles.prosConsCard}>
                <Text style={styles.prosConsTitle}>Photo A</Text>
                {result.photo_a.strengths?.map((s, i) => (
                  <Text key={i} style={styles.proText}>+ {s}</Text>
                ))}
                {result.photo_a.weaknesses?.map((w, i) => (
                  <Text key={i} style={styles.conText}>- {w}</Text>
                ))}
              </GlassCard>
              <GlassCard style={styles.prosConsCard}>
                <Text style={styles.prosConsTitle}>Photo B</Text>
                {result.photo_b.strengths?.map((s, i) => (
                  <Text key={i} style={styles.proText}>+ {s}</Text>
                ))}
                {result.photo_b.weaknesses?.map((w, i) => (
                  <Text key={i} style={styles.conText}>- {w}</Text>
                ))}
              </GlassCard>
            </View>
          </FadeInView>

          <FadeInView delay={400}>
            <Pressable onPress={handleReset} style={styles.resetButton}>
              <Text style={styles.resetText}>Compare different photos</Text>
            </Pressable>
          </FadeInView>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backText: { color: colors.slate[400], fontFamily: fonts.regular, fontSize: 14 },
  scrollPadding: { paddingBottom: 40 },
  title: { color: colors.white, fontFamily: fonts.bold, fontSize: 24, textAlign: 'center', marginBottom: 8 },
  subtitle: { color: colors.slate[400], fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', marginBottom: 24 },
  verdictText: { color: colors.slate[300], fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 20 },

  photoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 24 },
  photoSlot: { flex: 1, aspectRatio: 0.8, borderRadius: radius.lg, overflow: 'hidden' },
  photoImage: { width: '100%', height: '100%', borderRadius: radius.lg },
  photoPlaceholder: { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 4 },
  photoPlaceholderLabel: { color: colors.indigo[400], fontFamily: fonts.bold, fontSize: 24 },
  photoPlaceholderText: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12 },
  vsText: { color: colors.slate[400], fontFamily: fonts.bold, fontSize: 16 },

  sectionLabel: { color: colors.slate[400], fontFamily: fonts.medium, fontSize: 13, marginBottom: 8 },
  contextRow: { flexDirection: 'row', gap: 8 },
  contextChip: { flex: 1, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  contextChipActive: { backgroundColor: colors.indigo[600], borderColor: colors.indigo[500] },
  contextChipText: { color: colors.slate[400], fontFamily: fonts.medium, fontSize: 13 },
  contextChipTextActive: { color: colors.white },

  errorBox: { marginTop: 16, backgroundColor: 'rgba(127,29,29,0.2)', borderWidth: 1, borderColor: 'rgba(153,27,27,0.4)', borderRadius: radius.lg, padding: 14 },
  errorText: { color: '#fca5a5', fontFamily: fonts.regular, fontSize: 13 },

  loadingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: colors.white, fontFamily: fonts.medium, fontSize: 16 },
  loadingSubtext: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },

  resultPhotoWrap: { flex: 1, alignItems: 'center', gap: 6 },
  resultPhoto: { width: '100%', aspectRatio: 0.8, borderRadius: radius.lg },
  resultBadge: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginTop: -16 },
  winnerBadge: { backgroundColor: colors.indigo[600], borderColor: colors.indigo[500] },
  resultBadgeText: { color: colors.white, fontFamily: fonts.bold, fontSize: 16 },
  winnerLabel: { color: colors.green[500], fontFamily: fonts.semiBold, fontSize: 12 },

  breakdownCard: { padding: 20, gap: 12 },
  breakdownTitle: { color: colors.white, fontFamily: fonts.semiBold, fontSize: 16, marginBottom: 4 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  breakdownLabel: { fontFamily: fonts.medium, fontSize: 11, width: 100 },
  breakdownScore: { color: colors.white, fontFamily: fonts.semiBold, fontSize: 13, width: 28, textAlign: 'center' },
  breakdownBarWrap: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  breakdownBarA: { height: '100%', borderRadius: 3 },
  breakdownBarB: { height: '100%', borderRadius: 3 },
  breakdownLegend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  legendItem: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11 },

  prosConsRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  prosConsCard: { flex: 1, padding: 14, gap: 6 },
  prosConsTitle: { color: colors.white, fontFamily: fonts.semiBold, fontSize: 14, marginBottom: 4 },
  proText: { color: colors.green[500], fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
  conText: { color: colors.red[400], fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },

  resetButton: { alignItems: 'center', paddingVertical: 16, marginTop: 8 },
  resetText: { color: colors.slate[400], fontFamily: fonts.regular, fontSize: 14 },
});
