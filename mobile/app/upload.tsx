import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ActivityIndicator, Alert, Animated, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { colors, fonts, radius } from '../lib/theme';
import { CONTEXTS, Context, PURPOSE_SUGGESTIONS } from '../lib/constants';
import { analyzeImage } from '../lib/api';
import { checkAccess, consumeAnalysis, getProStatus, getCredits, getRemainingFree } from '../lib/store';

type UploadState = 'context' | 'idle' | 'preview' | 'uploading';

function FadeInView({ children, style }: { children: React.ReactNode; style?: any }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

export default function UploadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<UploadState>('context');
  const [context, setContext] = useState<Context | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [purpose, setPurpose] = useState<string>('');
  const [expandedContext, setExpandedContext] = useState<Context | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusLabel, setStatusLabel] = useState('');

  // Load account status
  useEffect(() => {
    (async () => {
      const isPro = await getProStatus();
      if (isPro) {
        setStatusLabel('Pro');
        return;
      }
      const credits = await getCredits();
      if (credits > 0) {
        setStatusLabel(`${credits} credit${credits !== 1 ? 's' : ''}`);
        return;
      }
      const free = await getRemainingFree();
      setStatusLabel(`${free} free scan${free !== 1 ? 's' : ''}`);
    })();
  }, [state]); // refresh when state changes (e.g. after analysis)

  const handleContextSelect = (c: Context, selectedPurpose: string = '') => {
    setContext(c);
    setPurpose(selectedPurpose);
    setExpandedContext(null);
    setState('idle');
  };

  const pickImage = async (useCamera: boolean) => {
    try {
      const permission = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', `Please allow ${useCamera ? 'camera' : 'photo library'} access to continue.`);
        return;
      }
      const launcher = useCamera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
      const result = await launcher({ mediaTypes: ['images'], allowsEditing: false, quality: 0.9 });
      if (result.canceled) return;
      const asset = result.assets[0];
      const manipulated = await ImageManipulator.manipulateAsync(asset.uri, [{ resize: { width: 512 } }], { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG });
      setImageUri(manipulated.uri);
      setState('preview');
      setError(null);
    } catch { setError('Failed to pick image. Please try again.'); }
  };

  const handleAnalyze = async () => {
    if (!imageUri || !context) return;

    const { allowed, reason } = await checkAccess();
    if (!allowed) {
      if (reason === 'paywall') {
        router.push('/paywall');
      } else {
        Alert.alert('Limit reached', 'You\'ve hit your analysis limit for this period. It\'ll reset soon!');
      }
      return;
    }

    setState('uploading');
    setError(null);
    try {
      const { id } = await analyzeImage(imageUri, context, purpose);
      await consumeAnalysis();
      router.push({ pathname: '/processing', params: { id } });
    } catch (err: any) {
      setError(err.message || 'Upload failed. Please try again.');
      setState('preview');
    }
  };

  const handleReset = () => { setImageUri(null); setState('idle'); setError(null); };
  const handleBackToContext = () => { setState('context'); setPurpose(''); setExpandedContext(null); };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => state === 'context' ? router.back() : handleBackToContext()}>
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/paywall')} style={styles.statusBadge}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {state === 'context' && (
          <FadeInView>
            <Text style={styles.title}>What's this photo for?</Text>
            <Text style={styles.subtitle}>Scoring is optimised per context.</Text>
            <View style={styles.contextList}>
              {CONTEXTS.map((c) => (
                <View key={c.id}>
                  <Pressable onPress={() => setExpandedContext(expandedContext === c.id ? null : c.id)}>
                    <GlassCard style={[styles.contextCard, expandedContext === c.id && styles.contextCardExpanded]}>
                      <View style={[styles.contextBadge, { backgroundColor: c.id === 'professional' ? '#4f46e5' : c.id === 'dating' ? '#e11d48' : '#06b6d4' }]}>
                        <Text style={styles.contextBadgeText}>{c.emoji}</Text>
                      </View>
                      <View style={styles.contextInfo}>
                        <Text style={styles.contextLabel}>{c.label}</Text>
                        <Text style={styles.contextDesc}>{c.desc}</Text>
                      </View>
                      <Text style={styles.contextArrow}>{expandedContext === c.id ? '‹' : '›'}</Text>
                    </GlassCard>
                  </Pressable>
                  {expandedContext === c.id && (
                    <View style={styles.expandedContent}>
                      <TextInput
                        style={styles.purposeInput}
                        placeholder="What do you want to know? e.g. &quot;How do others see me?&quot;"
                        placeholderTextColor={colors.textMuted}
                        value={purpose}
                        onChangeText={setPurpose}
                        multiline
                      />
                      <View style={styles.chipRow}>
                        {PURPOSE_SUGGESTIONS[c.id].map((s) => (
                          <Pressable key={s} onPress={() => handleContextSelect(c.id, s)}>
                            <View style={styles.chip}>
                              <Text style={styles.chipText}>{s}</Text>
                            </View>
                          </Pressable>
                        ))}
                      </View>
                      <Pressable style={styles.continueButton} onPress={() => handleContextSelect(c.id, purpose)}>
                        <Text style={styles.continueText}>Continue →</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </FadeInView>
        )}

        {state === 'idle' && (
          <FadeInView>
            <Pressable onPress={handleBackToContext}>
              <Text style={styles.changeContext}>← Change context · <Text style={styles.contextHighlight}>{context}</Text>{purpose ? <Text style={styles.contextHighlight}> · {purpose}</Text> : null}</Text>
            </Pressable>
            <Text style={styles.title}>Upload your photo</Text>
            <Text style={styles.subtitle}>Clear, front-facing portrait · good lighting · one person</Text>
            <Pressable onPress={() => pickImage(false)}>
              <GlassCard style={styles.uploadCard}>
                <View style={styles.uploadIconWrap}><Text style={styles.uploadIconText}>+</Text></View>
                <Text style={styles.uploadText}>Tap to choose a photo</Text>
                <Text style={styles.uploadHint}>JPEG or PNG · max 10MB</Text>
              </GlassCard>
            </Pressable>
            <Pressable onPress={() => pickImage(true)} style={styles.cameraLink}>
              <Text style={styles.cameraLinkText}>Or take a photo</Text>
            </Pressable>
          </FadeInView>
        )}

        {(state === 'preview' || state === 'uploading') && imageUri && (
          <FadeInView>
            <GlassCard style={styles.previewCard}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
              {state === 'uploading' && (
                <View style={styles.uploadingOverlay}>
                  <ActivityIndicator size="large" color={colors.indigo[500]} />
                  <Text style={styles.uploadingText}>Uploading...</Text>
                </View>
              )}
            </GlassCard>
            <View style={styles.previewActions}>
              <Pressable onPress={handleReset} disabled={state === 'uploading'} style={[styles.secondaryButton, state === 'uploading' && styles.disabled]}>
                <Text style={styles.secondaryButtonText}>Change Photo</Text>
              </Pressable>
              <GradientButton title="Analyze →" onPress={handleAnalyze} disabled={state === 'uploading'} style={{ flex: 1.5 }} />
            </View>
          </FadeInView>
        )}

        {error && (
          <View style={styles.errorBox}><Text style={styles.errorText}>⚠️ {error}</Text></View>
        )}
        <Text style={styles.privacy}>Photo is deleted immediately after analysis. We never store your image.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: 20 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  backButtonText: { color: colors.slate[400], fontFamily: fonts.regular, fontSize: 14 },
  statusBadge: { backgroundColor: 'rgba(99,102,241,0.15)', borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  statusText: { color: colors.indigo[400], fontFamily: fonts.medium, fontSize: 12 },
  content: { flex: 1, justifyContent: 'center' },
  title: { color: colors.white, fontFamily: fonts.bold, fontSize: 24, textAlign: 'center', marginBottom: 8 },
  subtitle: { color: colors.slate[400], fontFamily: fonts.regular, fontSize: 14, textAlign: 'center', marginBottom: 24 },
  contextList: { gap: 12 },
  contextCard: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16 },
  contextBadge: { width: 44, height: 44, borderRadius: 12, alignItems: 'center' as const, justifyContent: 'center' as const },
  contextBadgeText: { color: '#ffffff', fontFamily: fonts.bold, fontSize: 18 },
  contextInfo: { flex: 1 },
  contextLabel: { color: colors.white, fontFamily: fonts.semiBold, fontSize: 16 },
  contextDesc: { color: colors.slate[400], fontFamily: fonts.regular, fontSize: 13, marginTop: 2 },
  contextCardExpanded: { borderColor: colors.indigo[500] },
  contextArrow: { color: colors.textMuted, fontSize: 24 },
  expandedContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: 'rgba(99,102,241,0.12)', borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  chipText: { color: colors.indigo[300], fontFamily: fonts.medium, fontSize: 13 },
  purposeInput: { backgroundColor: 'rgba(22,20,58,0.6)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, color: colors.white, fontFamily: fonts.regular, fontSize: 14, minHeight: 44 },
  continueButton: { backgroundColor: colors.indigo[600], borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  continueText: { color: colors.white, fontFamily: fonts.semiBold, fontSize: 14 },
  changeContext: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, marginBottom: 16 },
  contextHighlight: { color: colors.indigo[300], textTransform: 'capitalize' },
  uploadCard: { padding: 32, alignItems: 'center', gap: 12 },
  uploadIconWrap: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(99,102,241,0.2)', alignItems: 'center' as const, justifyContent: 'center' as const },
  uploadIconText: { color: colors.indigo[400], fontSize: 32, fontFamily: fonts.bold },
  uploadText: { color: colors.white, fontFamily: fonts.medium, fontSize: 16 },
  uploadHint: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  cameraLink: { alignItems: 'center', paddingVertical: 14 },
  cameraLinkText: { color: colors.slate[500], fontFamily: fonts.regular, fontSize: 14, textDecorationLine: 'underline' },
  previewCard: { overflow: 'hidden' },
  previewImage: { width: '100%', height: 400, borderRadius: radius['2xl'] - 1, resizeMode: 'cover' as any },
  uploadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,14,42,0.7)', alignItems: 'center', justifyContent: 'center', gap: 12, borderRadius: radius['2xl'] },
  uploadingText: { color: colors.white, fontFamily: fonts.medium, fontSize: 14 },
  previewActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  secondaryButton: { flex: 1, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: 14, alignItems: 'center' },
  secondaryButtonText: { color: colors.slate[300], fontFamily: fonts.medium, fontSize: 14 },
  disabled: { opacity: 0.4 },
  errorBox: { marginTop: 16, backgroundColor: colors.red[900], borderWidth: 1, borderColor: colors.red[800], borderRadius: radius.lg, padding: 14 },
  errorText: { color: colors.red[300], fontFamily: fonts.regular, fontSize: 13 },
  privacy: { color: colors.textDim, fontFamily: fonts.regular, fontSize: 11, textAlign: 'center', marginTop: 20 },
});
