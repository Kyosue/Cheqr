import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Modal, 
  ActivityIndicator, 
  Image,
  StatusBar,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  SafeAreaView,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { router } from 'expo-router';
import { authenticateUser, resetPassword } from '../lib/api';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const [fontsLoaded] = useFonts({
    'THEDISPLAYFONT': require('../assets/fonts/THEDISPLAYFONT-DEMOVERSION.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [modalTitle, setModalTitle] = useState('');
  const [modalType, setModalType] = useState<'success' | 'error'>('success');
  const [userData, setUserData] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);
  const isNavigating = useRef(false);

  // Role selection modal states
  const [showRoleSelectionModal, setShowRoleSelectionModal] = useState(false);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [selectedRoleIndex, setSelectedRoleIndex] = useState<number | null>(null);

  // Forgot password states
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const showNotification = (title: string, message: string, type: 'success' | 'error', data?: any) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalType(type);
    setUserData(data);
    setShowModal(true);
  };

  const handleModalClose = async () => {
    setShowModal(false);
    if (modalType === 'success' && userData) {
      try {
        await AsyncStorage.setItem('user', JSON.stringify(userData));
        
        // Check if user has multiple roles
        if (userData.roles && userData.roles.length > 1) {
          setAvailableRoles(userData.roles);
          setShowRoleSelectionModal(true);
          return;
        }
        
        // Navigate based on user role (using single role)
        navigateToRoleDashboard(userData.role);
      } catch (error) {
        console.error('Error storing user data:', error);
        // Continue with navigation even if storage fails
        if (userData.roles && userData.roles.length > 1) {
          setAvailableRoles(userData.roles);
          setShowRoleSelectionModal(true);
        } else {
          navigateToRoleDashboard(userData.role);
        }
      }
    }
  };

  // Helper function to navigate based on role
  const navigateToRoleDashboard = (role: string) => {
    switch (role) {
      case 'admin':
        router.push('/admin-dashboard');
        break;
      case 'lecturer':
        router.push(`/lecturer-dashboard?id=${userData._id}`);
        break;
      case 'student':
        router.push(`/student-dashboard?id=${userData._id}`);
        break;
    }
  };

  // Handler for role selection
  const handleRoleSelect = async (selectedRole: string, index: number) => {
    try {
      // Highlight the selected role
      setSelectedRoleIndex(index);
      
      // Delay navigation to show the selection
      setTimeout(async () => {
        // Store the active role the user selected
        await AsyncStorage.setItem('activeRole', selectedRole);
        
        // Get stored user data to update with active role
        const storedUserData = await AsyncStorage.getItem('user');
        if (storedUserData) {
          const userObj = JSON.parse(storedUserData);
          userObj.activeRole = selectedRole;
          await AsyncStorage.setItem('user', JSON.stringify(userObj));
        }
        
        setShowRoleSelectionModal(false);
        navigateToRoleDashboard(selectedRole);
      }, 300); // Short delay for visual feedback
    } catch (error) {
      console.error('Error saving selected role:', error);
      // Continue with navigation even if storage fails
      setShowRoleSelectionModal(false);
      navigateToRoleDashboard(selectedRole);
    }
  };

  // Handler for canceling role selection and returning to login
  const handleCancelRoleSelection = async () => {
    try {
      // Clear user data from AsyncStorage
      await AsyncStorage.removeItem('user');
      // Reset states
      setShowRoleSelectionModal(false);
      setUserData(null);
      setUsername('');
      setPassword('');
      setAvailableRoles([]);
      setSelectedRoleIndex(null);
      isNavigating.current = false;
    } catch (error) {
      console.error('Error clearing user data:', error);
      // Still close the modal and reset states
      setShowRoleSelectionModal(false);
      setUserData(null);
      setUsername('');
      setPassword('');
    }
  };

  const handleLogin = async () => {
    if (isLoading || isNavigating.current) return;
    
    try {
      setIsLoading(true);
      const response = await authenticateUser(username, password);
      
      if (response.success) {
        setUserData(response.user);
        setModalTitle('Success');
        setModalMessage('Login successful!');
        setModalType('success');
        setShowModal(true);
        isNavigating.current = true;
      } else {
        setModalTitle('Error');
        setModalMessage(response.error || 'Invalid credentials');
        setModalType('error');
        setShowModal(true);
      }
    } catch (error) {
      setModalTitle('Error');
      setModalMessage('An error occurred during login');
      setModalType('error');
      setShowModal(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setShowForgotPasswordModal(true);
  };

  const handleResetPassword = async () => {
    if (!email || !username) {
      showNotification('Error', 'Please enter both email and username', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      showNotification('Error', 'Passwords do not match', 'error');
      return;
    }

    if (newPassword.length < 6) {
      showNotification('Error', 'Password must be at least 6 characters long', 'error');
      return;
    }

    try {
      setIsResettingPassword(true);
      await resetPassword(email, username, newPassword);
      showNotification('Success', 'Password reset successful!', 'success');
      setShowForgotPasswordModal(false);
      setEmail('');
      setUsername('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      showNotification('Error', error instanceof Error ? error.message : 'Failed to reset password', 'error');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <View style={styles.container}>
        <StatusBar 
          barStyle="light-content" 
          backgroundColor="#1c3a70"
          translucent={true}
        />
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.keyboardAvoidingView}>
          <ScrollView 
            contentContainerStyle={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            
            <LinearGradient
              colors={['#1c3a70', '#2c5282', '#3a6298']}
              style={styles.headerGradient}>
              <View style={styles.logoContainer}>
                <Image
                  source={require('../assets/images/logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
                <Text style={[styles.logoText, { fontFamily: 'THEDISPLAYFONT' }]}>CHEQR</Text>
                <Text style={styles.logoTagline}>Davao Oriental State University Attendance System</Text>
              </View>
            </LinearGradient>

            <View style={styles.formContainer}>
              <View style={styles.formHeader}>
                <Text style={styles.title}>Welcome Back</Text>
                <Text style={styles.subtitle}>Sign in to continue to your account</Text>
              </View>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Username</Text>
                <View style={styles.inputContainer}>
                  <MaterialIcons name="account-circle" size={22} color="#506690" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your username"
                    placeholderTextColor="#8896AB"
                    value={username}
                    onChangeText={setUsername}
                    autoCapitalize="none"
                    editable={!isLoading}
                  />
                </View>
              </View>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.inputContainer}>
                  <MaterialIcons name="lock" size={22} color="#506690" style={styles.inputIcon} />
                  <TextInput
                    style={styles.passwordInput}
                    placeholder="Enter your password"
                    placeholderTextColor="#8896AB"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    <MaterialIcons
                      name={showPassword ? 'visibility-off' : 'visibility'}
                      size={22}
                      color="#506690"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={styles.forgotPasswordButton}
                onPress={handleForgotPassword}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.buttonText}>Sign In</Text>
                    <MaterialIcons name="arrow-forward" size={20} color="#fff" style={styles.buttonIcon} />
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.footer}>
                <Text style={styles.footerText}>© {new Date().getFullYear()} CHEQR - All Rights Reserved</Text>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Success/Error Modal */}
        <Modal
          visible={showModal}
          transparent={true}
          animationType="fade"
          onRequestClose={handleModalClose}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={[
                styles.modalIconContainer,
                modalType === 'success' ? styles.successIcon : styles.errorIcon
              ]}>
                <MaterialIcons
                  name={modalType === 'success' ? 'check-circle' : 'error'}
                  size={40}
                  color="#fff"
                />
              </View>
              <Text style={[
                styles.modalTitle,
                modalType === 'success' ? styles.successTitle : styles.errorTitle
              ]}>
                {modalTitle}
              </Text>
              <Text style={styles.modalMessage}>{modalMessage}</Text>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  modalType === 'success' ? styles.successButton : styles.errorButton
                ]}
                onPress={handleModalClose}
              >
                <Text style={styles.modalButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Forgot Password Modal */}
        <Modal
          visible={showForgotPasswordModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowForgotPasswordModal(false)}
        >
          <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <View style={styles.modalOverlay}>
              <View style={styles.passwordResetModalContent}>
                <View style={styles.modalHeaderRow}>
                  <Text style={styles.passwordResetModalTitle}>Reset Password</Text>
                  <TouchableOpacity
                    style={styles.closeModalButton}
                    onPress={() => {
                      setShowForgotPasswordModal(false);
                      setEmail('');
                      setUsername('');
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                  >
                    <MaterialIcons name="close" size={24} color="#506690" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.passwordResetModalSubtitle}>
                  Please provide your email and username to reset your password
                </Text>
                
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Email</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="email" size={22} color="#506690" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your email address"
                      placeholderTextColor="#8896AB"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      editable={!isResettingPassword}
                    />
                  </View>
                </View>

                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Username</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="account-circle" size={22} color="#506690" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your username"
                      placeholderTextColor="#8896AB"
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      editable={!isResettingPassword}
                    />
                  </View>
                </View>

                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>New Password</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="lock" size={22} color="#506690" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter new password"
                      placeholderTextColor="#8896AB"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry
                      editable={!isResettingPassword}
                    />
                  </View>
                </View>

                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Confirm New Password</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="lock" size={22} color="#506690" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Confirm new password"
                      placeholderTextColor="#8896AB"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry
                      editable={!isResettingPassword}
                    />
                  </View>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalCancelButton]}
                    onPress={() => {
                      setShowForgotPasswordModal(false);
                      setEmail('');
                      setUsername('');
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                    disabled={isResettingPassword}
                  >
                    <Text style={styles.modalCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalPrimaryButton]}
                    onPress={handleResetPassword}
                    disabled={isResettingPassword}
                  >
                    {isResettingPassword ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.modalPrimaryButtonText}>Reset Password</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        {/* Role Selection Modal */}
        <Modal
          visible={showRoleSelectionModal}
          transparent={true}
          animationType="fade"
          onRequestClose={handleCancelRoleSelection}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.roleModalContent}>
              <View style={styles.roleSelectionHeader}>
                <View style={styles.roleSelectionIconContainer}>
                  <MaterialIcons name="people-alt" size={35} color="#fff" />
                </View>
                <Text style={styles.roleSelectionTitle}>Select Your Role</Text>
                <TouchableOpacity 
                  style={styles.closeRoleModalButton}
                  onPress={handleCancelRoleSelection}
                >
                  <MaterialIcons name="close" size={24} color="#506690" />
                </TouchableOpacity>
              </View>
              <Text style={styles.roleSelectionSubtitle}>
                Please select which role you'd like to use:
              </Text>
              
              <View style={styles.roleButtonsContainer}>
                {availableRoles.map((role, index) => (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleButton,
                      role === 'admin' ? styles.adminRoleButton : 
                      role === 'lecturer' ? styles.lecturerRoleButton : 
                      styles.studentRoleButton,
                      selectedRoleIndex === index && styles.selectedRoleButton
                    ]}
                    onPress={() => {
                      handleRoleSelect(role, index);
                    }}
                  >
                    <View style={[
                      styles.roleIconContainer,
                      role === 'admin' ? styles.adminIconContainer : 
                      role === 'lecturer' ? styles.lecturerIconContainer : 
                      styles.studentIconContainer
                    ]}>
                      <MaterialIcons
                        name={
                          role === 'admin' ? 'admin-panel-settings' :
                          role === 'lecturer' ? 'school' : 'people'
                        }
                        size={28}
                        color={
                          role === 'admin' ? '#1c3a70' :
                          role === 'lecturer' ? '#2D5F2D' :
                          '#7D4600'
                        }
                      />
                    </View>
                    <View style={styles.roleTextContainer}>
                      <Text style={styles.roleButtonText}>
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </Text>
                      <Text style={styles.roleDescription}>
                        {role === 'admin' 
                          ? 'Manage users, courses, and system settings' 
                          : role === 'lecturer' 
                          ? 'Manage courses and track student attendance' 
                          : 'View courses and mark attendance'}
                      </Text>
                    </View>
                    <MaterialIcons 
                      name="arrow-forward-ios" 
                      size={18} 
                      color="#506690" 
                      style={styles.roleSelectorArrow}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  headerGradient: {
    height: height * 0.35,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 0,
  },
  logoContainer: {
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 85,
    height: 85,
    marginBottom: 15,
  },
  logoText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
  },
  logoTagline: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 8,
    letterSpacing: 0.5,
  },
  formContainer: {
    flex: 1,
    padding: 25,
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
  },
  formHeader: {
    marginBottom: 25,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1c3a70',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#506690',
    lineHeight: 22,
  },
  inputWrapper: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1c3a70',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e7eaf0',
    overflow: 'hidden',
  },
  inputIcon: {
    marginLeft: 15,
  },
  input: {
    flex: 1,
    height: 52,
    paddingHorizontal: 15,
    color: '#2d3748',
    fontSize: 15,
  },
  passwordInput: {
    flex: 1,
    height: 52,
    paddingHorizontal: 15,
    color: '#2d3748',
    fontSize: 15,
  },
  eyeIcon: {
    padding: 15,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 25,
    paddingVertical: 5,
  },
  forgotPasswordText: {
    color: '#1c3a70',
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    height: 54,
    backgroundColor: '#1c3a70',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    flexDirection: 'row',
    elevation: 3,
    shadowColor: '#1c3a70',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  buttonIcon: {
    marginLeft: 8,
  },
  footer: {
    marginTop: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#8896AB',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 43, 77, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  passwordResetModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    width: '90%',
    maxWidth: 450,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  roleModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    width: '90%',
    maxWidth: 450,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 10,
  },
  passwordResetModalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1c3a70',
    flex: 1,
  },
  passwordResetModalSubtitle: {
    fontSize: 15,
    color: '#506690',
    marginBottom: 25,
    lineHeight: 22,
  },
  closeModalButton: {
    padding: 5,
  },
  modalIconContainer: {
    width: 75,
    height: 75,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successIcon: {
    backgroundColor: '#10B981',
  },
  errorIcon: {
    backgroundColor: '#EF4444',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  successTitle: {
    color: '#10B981',
  },
  errorTitle: {
    color: '#EF4444',
  },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 25,
    color: '#506690',
    lineHeight: 24,
  },
  modalButton: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  successButton: {
    backgroundColor: '#10B981',
  },
  errorButton: {
    backgroundColor: '#EF4444',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 25,
  },
  modalCancelButton: {
    backgroundColor: '#f0f4f9',
    flex: 1,
    marginRight: 10,
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e7eaf0',
  },
  modalPrimaryButton: {
    backgroundColor: '#1c3a70',
    flex: 1,
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#506690',
    fontSize: 15,
    fontWeight: '600',
  },
  modalPrimaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  roleSelectionHeader: {
    alignItems: 'center',
    position: 'relative',
    marginBottom: 15,
  },
  roleSelectionIconContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#1c3a70',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  roleSelectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1c3a70',
    textAlign: 'center',
  },
  roleSelectionSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    color: '#506690',
    marginBottom: 20,
    lineHeight: 22,
  },
  closeRoleModalButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 5,
  },
  roleButtonsContainer: {
    flexDirection: 'column',
    width: '100%',
    marginTop: 10,
    gap: 14,
  },
  roleButton: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#e7eaf0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  adminRoleButton: {
    borderLeftWidth: 5,
    borderLeftColor: '#1c3a70',
  },
  lecturerRoleButton: {
    borderLeftWidth: 5,
    borderLeftColor: '#2D5F2D',
  },
  studentRoleButton: {
    borderLeftWidth: 5,
    borderLeftColor: '#7D4600',
  },
  roleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  adminIconContainer: {
    backgroundColor: 'rgba(28, 58, 112, 0.1)',
  },
  lecturerIconContainer: {
    backgroundColor: 'rgba(45, 95, 45, 0.1)',
  },
  studentIconContainer: {
    backgroundColor: 'rgba(125, 70, 0, 0.1)',
  },
  roleTextContainer: {
    flex: 1,
  },
  roleButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 2,
  },
  roleDescription: {
    fontSize: 14,
    color: '#506690',
    lineHeight: 20,
  },
  selectedRoleButton: {
    backgroundColor: '#f0f4f9',
    borderWidth: 1,
    borderColor: '#1c3a70',
  },
  roleSelectorArrow: {
    marginLeft: 10,
  },
}); 