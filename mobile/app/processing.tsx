import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius } from '../lib/theme';
import { STEP_LABELS } from '../lib/constants';
import { pollResults } from '../lib/api';

export default function ProcessingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState('queued');
  const [failed, setFailed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fakeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const serverProgress = useRef(0);

  // Smooth fake progress — gradually fills to ~95% so it never feels stuck
  useEffect(() => {
    fakeRef.current = setInterval(() => {
      setProgress((prev) => {
        // Never go past 95 on fake progress — leave room for real "done"
        if (prev >= 95) return prev;
        // Slow down as we get higher — fast at start, crawls near end
        const speed = prev < 30 ? 3 : prev < 60 ? 1.5 : prev < 80 ? 0.7 : 0.3;
        // Don't go below server progress
        const next = Math.max(serverProgress.current, prev + speed);
        return Math.min(95, next);
      });
    }, 500);
    return () => { if (fakeRef.current) clearInterval(fakeRef.current); };
  }, []);

  const outerRotation = useRef(new Animated.Value(0)).current;
  const innerRotation = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const scanTop = useRef(new Animated.Value(0)).current;
  const barWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.timing(outerRotation, { toValue: 1, duration: 8000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.timing(innerRotation, { toValue: 1, duration: 5000, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.sequence([
      Animated.timing(pulseScale, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
      Animated.timing(pulseScale, { toValue: 1, duration: 1000, useNativeDriver: true }),
    ])).start();
    Animated.loop(Animated.sequence([
      Animated.timing(scanTop, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
      Animated.timing(scanTop, { toValue: 0, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: false }),
    ])).start();
  }, []);

  useEffect(() => {
    Animated.timing(barWidth, { toValue: progress, duration: 300, useNativeDriver: false }).start();
  }, [progress]);

  const outerSpin = outerRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const innerSpin = innerRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-360deg'] });
  const scanTopInterp = scanTop.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const barWidthInterp = barWidth.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const poll = async () => {
      if (cancelled) return;
      try {
        const result = await pollResults(id);
        if (cancelled) return;
        if (result.progress != null) serverProgress.current = result.progress;
        if (result.step) setStep(result.step);
        if (result.status === 'ready') {
          if (fakeRef.current) clearInterval(fakeRef.current);
          setProgress(100);
          setStep('finalizing');
          setTimeout(() => router.replace({ pathname: '/results/[id]', params: { id } }), 800);
          return;
        }
        if (result.status === 'failed') { setFailed(true); return; }
        pollRef.current = setTimeout(poll, 1000);
      } catch {
        if (!cancelled) pollRef.current = setTimeout(poll, 2000);
      }
    };
    pollRef.current = setTimeout(poll, 500);
    return () => { cancelled = true; if (pollRef.current) clearTimeout(pollRef.current); };
  }, [id, router]);

  if (!id) { router.replace('/upload'); return null; }

  const stepLabel = STEP_LABELS[step] ?? STEP_LABELS['queued'];

  if (failed) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.center}>
          <View style={styles.failIcon}><Text style={styles.failX}>✕</Text></View>
          <Text style={styles.failTitle}>Analysis Failed</Text>
          <Text style={styles.failSubtitle}>Something went wrong. Please try again with a clear, front-facing portrait.</Text>
          <Pressable onPress={() => router.replace('/upload')} style={styles.retryButton}>
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.center}>
        <View style={styles.scanContainer}>
          <Animated.View style={[styles.outerRing, { transform: [{ rotate: outerSpin }] }]} />
          <Animated.View style={[styles.innerRing, { transform: [{ rotate: innerSpin }] }]} />
          <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseScale }] }]} />
          <View style={styles.faceIconWrap}><Text style={styles.faceIconText}>?</Text></View>
          <View style={styles.scanOverflow}>
            <Animated.View style={[styles.scanLine, { top: scanTopInterp }]} />
          </View>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.percentRow}>
            <Text style={styles.percentText}>{Math.round(progress)}</Text>
            <Text style={styles.percentSign}>%</Text>
          </View>
          <View style={styles.barTrack}>
            <Animated.View style={[styles.barFill, { width: barWidthInterp }]} />
          </View>
          <Text style={styles.stepLabel}>{stepLabel}</Text>
        </View>
        <Text style={styles.timeEstimate}>Usually takes 5–10 seconds</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 40 },
  scanContainer: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center' },
  outerRing: { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 2, borderColor: 'rgba(99,102,241,0.3)' },
  innerRing: { position: 'absolute', width: 128, height: 128, borderRadius: 64, borderWidth: 1, borderColor: 'rgba(168,85,247,0.4)' },
  pulseCircle: { position: 'absolute', width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(30,27,75,0.4)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.2)' },
  faceIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(99,102,241,0.3)', alignItems: 'center' as const, justifyContent: 'center' as const, zIndex: 2 },
  faceIconText: { color: colors.indigo[400], fontSize: 28, fontFamily: fonts.bold },
  scanOverflow: { position: 'absolute', width: 160, height: 160, borderRadius: 80, overflow: 'hidden' },
  scanLine: { position: 'absolute', left: 0, right: 0, height: 2, backgroundColor: colors.cyan[400] },
  progressSection: { width: '100%', alignItems: 'center', gap: 16 },
  percentRow: { flexDirection: 'row', alignItems: 'baseline' },
  percentText: { color: colors.white, fontFamily: fonts.bold, fontSize: 48, fontVariant: ['tabular-nums'] },
  percentSign: { color: colors.slate[400], fontFamily: fonts.regular, fontSize: 20, marginLeft: 2 },
  barTrack: { width: '100%', height: 8, borderRadius: 4, backgroundColor: colors.slate[800], overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4, backgroundColor: colors.indigo[500] },
  stepLabel: { color: colors.slate[400], fontFamily: fonts.regular, fontSize: 14 },
  timeEstimate: { color: colors.textDim, fontFamily: fonts.regular, fontSize: 12 },
  failIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.red[900], borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', alignItems: 'center', justifyContent: 'center' },
  failX: { color: colors.red[400], fontSize: 28 },
  failTitle: { color: colors.white, fontFamily: fonts.bold, fontSize: 20 },
  failSubtitle: { color: colors.slate[400], fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', maxWidth: 280 },
  retryButton: { backgroundColor: colors.indigo[600], paddingHorizontal: 24, paddingVertical: 12, borderRadius: radius.lg },
  retryText: { color: colors.white, fontFamily: fonts.medium, fontSize: 14 },
});
