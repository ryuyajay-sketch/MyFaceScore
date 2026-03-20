import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Animated, Image, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { colors, fonts, radius } from '../lib/theme';
import { DIMENSIONS } from '../lib/constants';
import { activateDevUnlimited, isDevUnlimited, getHistory } from '../lib/store';

function FadeInView({ delay = 0, children, style }: { delay?: number; children: React.ReactNode; style?: any }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 500, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 500, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

function DemoBar({ dimension, index }: { dimension: typeof DIMENSIONS[number]; index: number }) {
  const width = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(width, { toValue: dimension.value, duration: 1000, delay: 700 + index * 120, useNativeDriver: false }).start();
  }, []);

  const barWidth = width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.demoBarRow}>
      <View style={styles.demoBarContent}>
        <View style={styles.demoBarHeader}>
          <Text style={styles.demoBarLabel}>{dimension.label}</Text>
          <Text style={[styles.demoBarValue, { color: dimension.color }]}>{dimension.value}</Text>
        </View>
        <View style={styles.demoBarTrack}>
          <Animated.View style={[styles.demoBarFill, { width: barWidth, backgroundColor: dimension.color }]} />
        </View>
        <Text style={styles.demoBarPreview}>{dimension.preview}</Text>
      </View>
    </View>
  );
}


export default function LandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogoTap = async () => {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 2000);
    if (tapCount.current >= 7) {
      tapCount.current = 0;
      await activateDevUnlimited();
      Alert.alert('Unlocked', 'Unlimited scans activated.');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      <FadeInView delay={0} style={styles.nav}>
        <Pressable onPress={handleLogoTap}>
          <Text style={styles.logo}>My<Text style={styles.logoAccent}>FaceScore</Text></Text>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => router.push('/history')} style={styles.navButtonOutline}>
            <Text style={styles.navButtonOutlineText}>History</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/upload')} style={styles.navButton}>
            <Text style={styles.navButtonText}>Try free →</Text>
          </Pressable>
        </View>
      </FadeInView>

      <View style={styles.hero}>
        <FadeInView delay={200}>
          <Text style={styles.heroTitle}>You have{'\n'}<Text style={styles.heroTitleGradient}>0.1 seconds.</Text></Text>
        </FadeInView>
        <FadeInView delay={300}>
          <Text style={styles.heroSubtitle}>That's how fast people judge your face. Find out what they're thinking — and what to fix.</Text>
        </FadeInView>
        <FadeInView delay={400} style={styles.heroCTA}>
          <GradientButton title="Score my face" onPress={() => router.push('/upload')} />
          <Pressable onPress={() => router.push('/compare')} style={styles.compareLink}>
            <Text style={styles.compareLinkText}>Or compare two photos →</Text>
          </Pressable>
        </FadeInView>

        <FadeInView delay={500}>
          <GlassCard style={styles.demoCard}>
            {/* Mock result preview */}
            <View style={styles.mockResultTop}>
              <Image source={require('../assets/sample-face.png')} style={styles.mockAvatar} />
              <View style={styles.mockScoreSection}>
                <Text style={styles.mockScore}>82</Text>
                <Text style={styles.mockScoreLabel}>/100 · Top 25%</Text>
              </View>
            </View>
            <Text style={styles.mockQuote}>"Your smile reads genuine but the overhead lighting is casting shadows under your eyes — makes you look 3 years older than you are. Tilt your chin down slightly and use natural window light. That alone would push you from an 82 to a 90+."</Text>
            <View style={styles.mockDivider} />
            {DIMENSIONS.map((d, i) => <DemoBar key={d.label} dimension={d} index={i} />)}
          </GlassCard>
        </FadeInView>
      </View>

      {/* How it works */}
      <FadeInView delay={600}>
        <Text style={styles.sectionTitle}>How it works</Text>
      </FadeInView>
      <View style={styles.steps}>
        <FadeInView delay={650}>
          <View style={styles.stepRow}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
            <Text style={styles.stepText}>Upload any selfie or headshot</Text>
          </View>
        </FadeInView>
        <FadeInView delay={700}>
          <View style={styles.stepRow}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
            <Text style={styles.stepText}>AI scores you on trust, competence, approachability & attractiveness</Text>
          </View>
        </FadeInView>
        <FadeInView delay={750}>
          <View style={styles.stepRow}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
            <Text style={styles.stepText}>Get brutally honest feedback + tips to actually improve</Text>
          </View>
        </FadeInView>
      </View>

      {/* Social proof / credibility */}
      <FadeInView delay={800}>
        <GlassCard style={styles.credCard}>
          <Text style={styles.credQuote}>"People decide if they trust you before you even open your mouth."</Text>
          <Text style={styles.credSource}>— Social perception research</Text>
        </GlassCard>
      </FadeInView>

      {/* Features as quick bullets, not cards */}
      <FadeInView delay={850}>
        <View style={styles.bulletSection}>
          <View style={styles.bulletRow}><Text style={[styles.bulletDot, { color: '#818cf8' }]}>{'\u2022'}</Text><Text style={styles.bulletText}>Results in 5 seconds</Text></View>
          <View style={styles.bulletRow}><Text style={[styles.bulletDot, { color: '#22c55e' }]}>{'\u2022'}</Text><Text style={styles.bulletText}>Based on real perception science</Text></View>
          <View style={styles.bulletRow}><Text style={[styles.bulletDot, { color: '#06b6d4' }]}>{'\u2022'}</Text><Text style={styles.bulletText}>Your photo is deleted immediately</Text></View>
          <View style={styles.bulletRow}><Text style={[styles.bulletDot, { color: '#a855f7' }]}>{'\u2022'}</Text><Text style={styles.bulletText}>No account needed</Text></View>
        </View>
      </FadeInView>

      <FadeInView delay={900}>
        <GradientButton title="Try it free" onPress={() => router.push('/upload')} style={{ marginTop: 8 }} />
      </FadeInView>

      <Text style={styles.footer}>2 free scans · no sign up · photo deleted after scoring</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20 },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 },
  logo: { color: colors.white, fontFamily: fonts.semiBold, fontSize: 16 },
  logoAccent: { color: colors.indigo[400] },
  navButton: { backgroundColor: colors.indigo[600], paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.sm },
  navButtonText: { color: colors.white, fontFamily: fonts.medium, fontSize: 14 },
  navButtonOutline: { borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm },
  navButtonOutlineText: { color: colors.slate[400], fontFamily: fonts.medium, fontSize: 14 },
  hero: { alignItems: 'center', marginBottom: 32 },
  heroTitle: { color: colors.white, fontFamily: fonts.bold, fontSize: 40, lineHeight: 48, textAlign: 'center' },
  heroTitleGradient: { color: colors.indigo[400] },
  heroSubtitle: { color: colors.slate[400], fontFamily: fonts.regular, fontSize: 17, lineHeight: 26, marginTop: 12, textAlign: 'center' },
  heroCTA: { marginTop: 24, marginBottom: 28 },
  demoCard: { padding: 20, width: '100%', gap: 12, overflow: 'hidden' },
  mockResultTop: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 4 },
  mockAvatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, borderColor: 'rgba(99,102,241,0.3)' },
  mockScoreSection: { flex: 1 },
  mockScore: { color: colors.white, fontFamily: fonts.bold, fontSize: 36 },
  mockScoreLabel: { color: colors.slate[500], fontFamily: fonts.regular, fontSize: 13 },
  mockQuote: { color: colors.slate[300], fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, fontStyle: 'italic' },
  mockDivider: { height: 1, backgroundColor: 'rgba(99,102,241,0.1)', marginVertical: 4 },
  demoBarRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  demoBarIcon: { fontSize: 16, width: 24, textAlign: 'center' },
  demoBarContent: { flex: 1 },
  demoBarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  demoBarLabel: { color: colors.slate[300], fontFamily: fonts.regular, fontSize: 12 },
  demoBarValue: { color: colors.white, fontFamily: fonts.semiBold, fontSize: 12 },
  demoBarTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  demoBarFill: { height: '100%', borderRadius: 3 },
  demoBarPreview: { color: colors.slate[500], fontFamily: fonts.regular, fontSize: 11, lineHeight: 16, marginTop: 4 },
  sectionTitle: { color: colors.white, fontFamily: fonts.bold, fontSize: 20, marginBottom: 16, textAlign: 'center' },
  steps: { gap: 14, marginBottom: 28 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepNumber: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.indigo[600], alignItems: 'center', justifyContent: 'center' },
  stepNumberText: { color: colors.white, fontFamily: fonts.bold, fontSize: 14 },
  stepText: { color: colors.slate[300], fontFamily: fonts.regular, fontSize: 15, flex: 1, lineHeight: 22 },
  credCard: { padding: 24, marginBottom: 24 },
  credQuote: { color: colors.slate[300], fontFamily: fonts.medium, fontSize: 16, lineHeight: 24, fontStyle: 'italic' },
  credSource: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 12, marginTop: 10 },
  bulletSection: { gap: 10, marginBottom: 20 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bulletDot: { fontSize: 18, fontFamily: fonts.bold },
  bulletText: { color: colors.slate[400], fontFamily: fonts.regular, fontSize: 14 },
  compareLink: { alignItems: 'center', paddingVertical: 10 },
  compareLinkText: { color: colors.slate[500], fontFamily: fonts.regular, fontSize: 14, textDecorationLine: 'underline' },
  footer: { color: colors.textDim, fontFamily: fonts.regular, fontSize: 11, textAlign: 'center', marginTop: 24, marginBottom: 8, lineHeight: 18 },
});
