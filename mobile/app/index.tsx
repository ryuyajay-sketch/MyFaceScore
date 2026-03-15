import { useEffect, useRef } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { colors, fonts, radius } from '../lib/theme';
import { DIMENSIONS } from '../lib/constants';

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
      <Text style={styles.demoBarIcon}>{dimension.icon}</Text>
      <View style={styles.demoBarContent}>
        <View style={styles.demoBarHeader}>
          <Text style={styles.demoBarLabel}>{dimension.label}</Text>
          <Text style={styles.demoBarValue}>{dimension.value}</Text>
        </View>
        <View style={styles.demoBarTrack}>
          <Animated.View style={[styles.demoBarFill, { width: barWidth, backgroundColor: dimension.color }]} />
        </View>
      </View>
    </View>
  );
}

const FEATURES = [
  { icon: '\u26A1', title: 'Instant AI Analysis', desc: 'Results in under 5 seconds using a vision model trained on Todorov-aligned perception research.' },
  { icon: '\uD83D\uDCD6', title: 'Science-Backed Dimensions', desc: 'Scores on Trustworthiness, Competence, Approachability & Attractiveness.' },
  { icon: '\uD83D\uDD12', title: 'Photo Deleted Instantly', desc: 'Your image is processed server-side and deleted immediately. Nothing is stored.' },
];

export default function LandingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
    >
      <FadeInView delay={0} style={styles.nav}>
        <Text style={styles.logo}>My<Text style={styles.logoAccent}>FaceScore</Text></Text>
        <Pressable onPress={() => router.push('/upload')} style={styles.navButton}>
          <Text style={styles.navButtonText}>Try free →</Text>
        </Pressable>
      </FadeInView>

      <View style={styles.hero}>
        <FadeInView delay={100}><Text style={styles.heroBadge}>Based on Todorov lab research</Text></FadeInView>
        <FadeInView delay={200}>
          <Text style={styles.heroTitle}>How does your photo <Text style={styles.heroTitleGradient}>make people feel?</Text></Text>
        </FadeInView>
        <FadeInView delay={300}>
          <Text style={styles.heroSubtitle}>Upload a portrait. Get instant AI scores on the four dimensions that shape first impressions — plus actionable tips to improve them.</Text>
        </FadeInView>
        <FadeInView delay={400} style={styles.heroCTA}>
          <GradientButton title="Analyze My Photo  →" onPress={() => router.push('/upload')} />
        </FadeInView>

        <FadeInView delay={500}>
          <GlassCard style={styles.demoCard}>
            <Text style={styles.demoLabel}>Sample result — Professional context</Text>
            {DIMENSIONS.map((d, i) => <DemoBar key={d.label} dimension={d} index={i} />)}
            <Text style={styles.demoDisclaimer}>Scores reflect how your photo may be perceived, not who you are.</Text>
          </GlassCard>
        </FadeInView>
      </View>

      <View style={styles.features}>
        {FEATURES.map((f, i) => (
          <FadeInView key={f.title} delay={600 + i * 100}>
            <GlassCard style={styles.featureCard}>
              <View style={styles.featureIcon}><Text style={styles.featureIconText}>{f.icon}</Text></View>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </GlassCard>
          </FadeInView>
        ))}
      </View>

      <FadeInView delay={900}>
        <GlassCard style={styles.ctaCard}>
          <Text style={styles.ctaTitle}>See your scores in seconds</Text>
          <Text style={styles.ctaSubtitle}>Free · No account needed · Photo deleted immediately</Text>
          <GradientButton title="Get My Score  →" onPress={() => router.push('/upload')} style={{ marginTop: 20 }} />
        </GlassCard>
      </FadeInView>

      <Text style={styles.footer}>MyFaceScore · Scores reflect social perception, not character · Based on published social psychology research</Text>
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
  hero: { alignItems: 'center', marginBottom: 40 },
  heroBadge: { color: colors.indigo[300], fontFamily: fonts.regular, fontSize: 13, marginBottom: 16, textAlign: 'center' },
  heroTitle: { color: colors.white, fontFamily: fonts.bold, fontSize: 36, textAlign: 'center', lineHeight: 44 },
  heroTitleGradient: { color: colors.indigo[400] },
  heroSubtitle: { color: colors.slate[400], fontFamily: fonts.regular, fontSize: 16, textAlign: 'center', lineHeight: 24, marginTop: 16, maxWidth: 340 },
  heroCTA: { marginTop: 28, marginBottom: 32 },
  demoCard: { padding: 20, width: '100%', gap: 12 },
  demoLabel: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  demoDisclaimer: { color: colors.textDim, fontFamily: fonts.regular, fontSize: 11, marginTop: 4 },
  demoBarRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  demoBarIcon: { fontSize: 16, width: 24, textAlign: 'center' },
  demoBarContent: { flex: 1 },
  demoBarHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  demoBarLabel: { color: colors.slate[300], fontFamily: fonts.regular, fontSize: 12 },
  demoBarValue: { color: colors.white, fontFamily: fonts.semiBold, fontSize: 12 },
  demoBarTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  demoBarFill: { height: '100%', borderRadius: 3 },
  features: { gap: 12, marginBottom: 32 },
  featureCard: { padding: 20, gap: 8 },
  featureIcon: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: 'rgba(30,27,75,0.5)', alignItems: 'center', justifyContent: 'center' },
  featureIconText: { fontSize: 18 },
  featureTitle: { color: colors.white, fontFamily: fonts.semiBold, fontSize: 14 },
  featureDesc: { color: colors.slate[400], fontFamily: fonts.regular, fontSize: 13, lineHeight: 20 },
  ctaCard: { padding: 32, alignItems: 'center' },
  ctaTitle: { color: colors.white, fontFamily: fonts.bold, fontSize: 22, textAlign: 'center' },
  ctaSubtitle: { color: colors.slate[400], fontFamily: fonts.regular, fontSize: 13, textAlign: 'center', marginTop: 8 },
  footer: { color: colors.textDim, fontFamily: fonts.regular, fontSize: 11, textAlign: 'center', marginTop: 32, lineHeight: 18 },
});
