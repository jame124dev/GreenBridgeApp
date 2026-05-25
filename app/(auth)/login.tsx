import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';

import { loginSchema, type LoginInput } from '@/features/auth/schema';
import { useLogin } from '@/features/auth/useLogin';
import { LoginError } from '@/services/auth/login';
import { useAuth } from '@/stores/authStore';
import { getBranding } from '@/theme/branding';
import { gradients } from '@/theme/gradients';

export default function LoginScreen() {
  const branding = getBranding();
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });
  const mut = useLogin();
  const setPending = useAuth((s) => s.setPending);

  const onInvalid = () => {
    Alert.alert('Check your input', 'Enter a valid email and password.');
  };

  const onSubmit = (values: LoginInput) =>
    mut.mutate(values, {
      onSuccess: () => router.replace('/(tabs)'),
      onError: (err) => {
        if (err instanceof LoginError) {
          if (err.code === 'EMAIL_NOT_VERIFIED') {
            return Alert.alert('Verify your email', err.message);
          }
          if (err.code === 'ACCOUNT_PENDING') {
            setPending(true);
            return router.replace('/(auth)/pending');
          }
          if (err.code === 'BUYER_NOT_ALLOWED') {
            return Alert.alert('Sellers only', err.message);
          }
          if (err.code === 'VALIDATION') {
            return setError('email', { message: err.message });
          }
          return Alert.alert('Login failed', err.message);
        }
        Alert.alert('Login failed', 'Please try again');
      },
    });

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1 }}
        bounces={false}
      >
        <LinearGradient colors={[...gradients.hero]} style={styles.headerGradient}>
          <SafeAreaView edges={['top']}>
            <View style={styles.headerContent}>
              <View style={styles.logoContainer}>
                <Image
                  source={branding.logo}
                  style={{ width: branding.logoWidth, height: branding.logoHeight }}
                  resizeMode="contain"
                  accessibilityLabel={branding.logoLabel}
                />
              </View>

              <Text style={styles.welcomeText}>Welcome back</Text>
              <Text style={styles.subtitleText}>Sign in to keep listing</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.formCard}>
          <Controller
            control={control}
            name="email"
            render={({ field: { value, onChange, onBlur } }) => (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email</Text>
                <View style={styles.inputWrapper}>
                  <Mail
                    size={18}
                    color={errors.email ? '#dc3737' : emailFocused ? '#0a4a2f' : '#9ca3af'}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={() => {
                      onBlur();
                      setEmailFocused(false);
                    }}
                    onFocus={() => setEmailFocused(true)}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                    placeholder="you@company.com"
                    placeholderTextColor="#9ca3af"
                    style={[
                      styles.input,
                      errors.email
                        ? styles.inputErrorBorder
                        : emailFocused
                        ? styles.inputFocusBorder
                        : styles.inputDefaultBorder,
                    ]}
                  />
                </View>
                {errors.email ? (
                  <Text style={styles.errorText}>{errors.email.message}</Text>
                ) : null}
              </View>
            )}
          />

          <Controller
            control={control}
            name="password"
            render={({ field: { value, onChange, onBlur } }) => (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.inputWrapper}>
                  <Lock
                    size={18}
                    color={errors.password ? '#dc3737' : passwordFocused ? '#0a4a2f' : '#9ca3af'}
                    style={styles.inputIcon}
                  />
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={() => {
                      onBlur();
                      setPasswordFocused(false);
                    }}
                    onFocus={() => setPasswordFocused(true)}
                    secureTextEntry={!showPassword}
                    autoComplete="password"
                    returnKeyType="go"
                    onSubmitEditing={handleSubmit(onSubmit, onInvalid)}
                    placeholder="••••••••"
                    placeholderTextColor="#9ca3af"
                    style={[
                      styles.input,
                      styles.inputPassword,
                      errors.password
                        ? styles.inputErrorBorder
                        : passwordFocused
                        ? styles.inputFocusBorder
                        : styles.inputDefaultBorder,
                    ]}
                  />
                  <Pressable
                    onPress={() => setShowPassword((v) => !v)}
                    hitSlop={12}
                    style={styles.eyeIcon}
                    accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <EyeOff size={18} color="#9ca3af" />
                    ) : (
                      <Eye size={18} color="#9ca3af" />
                    )}
                  </Pressable>
                </View>
                {errors.password ? (
                  <Text style={styles.errorText}>{errors.password.message}</Text>
                ) : null}
              </View>
            )}
          />

          <Pressable
            onPress={handleSubmit(onSubmit, onInvalid)}
            disabled={mut.isPending}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.submitButton,
              {
                opacity: mut.isPending ? 0.6 : pressed ? 0.9 : 1,
                backgroundColor: '#0a4a2f',
              },
            ]}
          >
            {mut.isPending ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>Sign in</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() =>
              Alert.alert('Use the website', 'Forgot password is on the website for now.')
            }
            style={styles.forgotPasswordButton}
          >
            <Text style={styles.forgotPasswordText}>Forgot password?</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9fb',
  },
  headerGradient: {
    paddingBottom: 48,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  headerContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  logoContainer: {
    marginBottom: 20,
    alignSelf: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.08)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 2,
      },
    }),
  },
  welcomeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    lineHeight: 34,
    color: '#ffffff',
  },
  subtitleText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 6,
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginTop: -20,
    marginHorizontal: 20,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 32,
    gap: 20,
    ...Platform.select({
      web: {
        boxShadow: '0px 8px 30px rgba(0, 0, 0, 0.06)',
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 24,
        elevation: 6,
      },
    }),
    borderWidth: 1,
    borderColor: '#e1e5ec',
  },
  inputGroup: {
    width: '100%',
  },
  inputLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#13171f',
    marginBottom: 8,
  },
  inputWrapper: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  inputIcon: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
  },
  input: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    borderWidth: 1.5,
    backgroundColor: '#f8fafc',
    paddingLeft: 46,
    paddingRight: 16,
    fontSize: 15,
    color: '#13171f',
    fontFamily: 'Inter_400Regular',
    ...Platform.select({
      web: {
        outlineStyle: 'none' as any,
      },
    }),
  },
  inputPassword: {
    paddingRight: 46,
  },
  inputDefaultBorder: {
    borderColor: '#e2e8f0',
  },
  inputFocusBorder: {
    borderColor: '#0a4a2f',
    backgroundColor: '#ffffff',
  },
  inputErrorBorder: {
    borderColor: '#dc3737',
    backgroundColor: '#fff8f8',
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    zIndex: 10,
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: '#dc3737',
    marginTop: 6,
  },
  submitButton: {
    height: 50,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    ...Platform.select({
      web: {
        boxShadow: '0px 4px 10px rgba(10, 74, 47, 0.2)',
      },
      default: {
        shadowColor: '#0a4a2f',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 3,
      },
    }),
  },
  submitButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#ffffff',
  },
  forgotPasswordButton: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  forgotPasswordText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#0a4a2f',
  },
});
