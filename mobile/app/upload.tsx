import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Image, ActivityIndicator, Alert, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassCard } from '../components/GlassCard';
import { GradientButton } from '../components/GradientButton';
import { colors, fonts, radius } from '../lib/theme';
import { CONTEXTS, Context } from '../lib/constants';
import { analyzeImage } from '../lib/api';

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
  const [error, setError] = useState<string | null>(null);

  const handleContextSelect = (c: Context) => { setContext(c); setState('idle'); };

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
      const result = await launcher({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.9 });
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
    setState('uploading');
    setError(null);
    try {
      const { id } = await analyzeImage(imageUri, context);
      router.push({ pathname: '/processing', params: { id } });
    } catch (err: any) {
      setError(err.message || 'Upload failed. Please try again.');
      setState('preview');
    }
  };

  const handleReset = () => { setImageUri(null); setState('idle'); setError(null); };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <Pressable onPress={() => state === 'context' ? router.back() : setState('context')} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Back</Text>
      </Pressable>

      <View style={styles.content}>
        {state === 'context' && (
          <FadeInView>
            <Text style={styles.title}>What's this photo for?</Text>
            <Text style={styles.subtitle}>Scoring is optimised per context.</Text>
            <View style={styles.contextList}>
              {CONTEXTS.map((c) => (
                <Pressable key={c.id} onPress={() => handleContextSelect(c.id)}>
                  <GlassCard style={styles.contextCard}>
                    <View style={[styles.contextBadge, { backgroundColor: c.id === 'professional' ? '#4f46e5' : c.id === 'dating' ? '#e11d48' : '#06b6d4' }]}>
                      <Text style={styles.contextBadgeText}>{c.emoji}</Text>
                    </View>
                    <View style={styles.contextInfo}>
                      <Text style={styles.contextLabel}>{c.label}</Text>
                      <Text style={styles.contextDesc}>{c.desc}</Text>
                    </View>
                    <Text style={styles.contextArrow}>›</Text>
                  </GlassCard>
                </Pressable>
              ))}
            </View>
          </FadeInView>
        )}

        {state === 'idle' && (
          <FadeInView>
            <Pressable onPress={() => setState('context')}>
              <Text style={styles.changeContext}>← Change context · <Text style={styles.contextHighlight}>{context}</Text></Text>
            </Pressable>
            <Text style={styles.title}>Upload your photo</Text>
            <Text style={styles.subtitle}>Clear, front-facing portrait · good lighting · one person</Text>
            <GlassCard style={styles.uploadCard}>
              <View style={styles.uploadIconWrap}><Text style={styles.uploadIconText}>+</Text></View>
              <Text style={styles.uploadText}>Choose a photo to analyze</Text>
              <Text style={styles.uploadHint}>JPEG or PNG · max 10MB</Text>
              <View style={styles.uploadButtons}>
                <Pressable onPress={() => pickImage(true)} style={styles.uploadOption}>
                  <Text style={styles.uploadOptionText}>Camera</Text>
                </Pressable>
                <Pressable onPress={() => pickImage(false)} style={styles.uploadOption}>
                  <Text style={styles.uploadOptionText}>Gallery</Text>
                </Pressable>
              </View>
            </GlassCard>
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
  backButton: { marginBottom: 16 },
  backButtonText: { color: colors.slate[400], fontFamily: fonts.regular, fontSize: 14 },
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
  contextArrow: { color: colors.textMuted, fontSize: 24 },
  changeContext: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13, marginBottom: 16 },
  contextHighlight: { color: colors.indigo[300], textTransform: 'capitalize' },
  uploadCard: { padding: 32, alignItems: 'center', gap: 12 },
  uploadIconWrap: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(99,102,241,0.2)', alignItems: 'center' as const, justifyContent: 'center' as const },
  uploadIconText: { color: colors.indigo[400], fontSize: 32, fontFamily: fonts.bold },
  uploadText: { color: colors.white, fontFamily: fonts.medium, fontSize: 16 },
  uploadHint: { color: colors.textMuted, fontFamily: fonts.regular, fontSize: 13 },
  uploadButtons: { flexDirection: 'row', gap: 12, marginTop: 12 },
  uploadOption: { backgroundColor: 'rgba(30,27,75,0.5)', borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: 24 },
  uploadOptionText: { color: colors.slate[300], fontFamily: fonts.medium, fontSize: 14 },
  previewCard: { overflow: 'hidden' },
  previewImage: { width: '100%', aspectRatio: 1, borderRadius: radius['2xl'] - 1 },
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
