import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Modal, BackHandler, Alert, Animated, Dimensions, RefreshControl, StatusBar, Platform, FlatList } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Course, getCourses, logoutUser } from '../lib/api';
import { CameraView, BarcodeScanningResult, Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { API_CONFIG } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

SplashScreen.preventAutoHideAsync();

const SCREEN_WIDTH = Dimensions.get('window').width;

const getNumColumns = () => {
  return SCREEN_WIDTH >= 768 ? 2 : 1; // Use 2 columns for tablets/wider screens
};

export default function StudentDashboard() {
  const params = useLocalSearchParams();
  const currentUserId = params.id as string;
  
  const [fontsLoaded, fontError] = useFonts({
    'THEDISPLAYFONT': require('../assets/fonts/THEDISPLAYFONT-DEMOVERSION.ttf'),
  });

  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isScannerVisible, setScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const { width: screenWidth } = Dimensions.get('window');
  const [currentScanningCourse, setCurrentScanningCourse] = useState<Course | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchEnrolledCourses();
  }, []);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowLogoutConfirm(true);
      return true; // Prevent default back behavior
    });

    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    checkPermissions();
  }, []);

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  useEffect(() => {
    if (isScannerVisible) {
      startScanAnimation();
    }
  }, [isScannerVisible]);

  const fetchEnrolledCourses = async () => {
    try {
      setIsLoading(true);
      const allCourses = await getCourses();
      console.log('Current Student ID:', currentUserId);
      
      const enrolledCourses = allCourses.filter((course: Course) => {
        return course.students && course.students.includes(currentUserId);
      });
      
      console.log('Enrolled Courses:', enrolledCourses);
      setCourses(enrolledCourses);
      setError(null);
    } catch (error) {
      console.error('Error fetching enrolled courses:', error);
      setError('Failed to fetch courses. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const checkPermissions = async () => {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    } catch (err) {
      console.error('Error checking permissions:', err);
      Alert.alert('Error', 'Failed to access camera');
    }
  };

  const playBeep = async () => {
    try {
      // Using a simple beep sound from expo-av
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'https://www.soundjay.com/buttons/sounds/beep-01a.mp3' }
      );
      setSound(sound);
      await sound.playAsync();
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  };

  const handleBarCodeScanned = async ({ data }: BarcodeScanningResult) => {
    try {
      setScanned(true);
      await playBeep();

      console.log('Scanned QR data:', data);

      // Parse the QR data to get the course information
      let qrDataObj;
      try {
        qrDataObj = JSON.parse(data);
        console.log('Parsed QR data:', qrDataObj);
      } catch (e) {
        console.error('Failed to parse QR data:', e);
        throw new Error('Invalid QR code format');
      }

      // Verify the QR code is for the correct course
      if (!currentScanningCourse) {
        throw new Error('Course information not available');
      }

      console.log('Current scanning course:', currentScanningCourse);
      console.log('QR course ID:', qrDataObj.courseId);
      console.log('Scanning course ID:', currentScanningCourse._id);

      // Strict comparison of course IDs
      if (qrDataObj.courseId !== currentScanningCourse._id) {
        throw new Error(`This QR code is for ${qrDataObj.courseCode || 'another course'}. You are trying to mark attendance for ${currentScanningCourse.courseCode}.`);
      }

      // Verify the student is enrolled in this course
      const isEnrolled = courses.some(course => 
        course._id === qrDataObj.courseId && 
        course.students && 
        course.students.includes(currentUserId)
      );

      if (!isEnrolled) {
        throw new Error(`You are not enrolled in ${qrDataObj.courseCode || 'this course'}. Attendance cannot be marked.`);
      }

      // Check if QR code has expired
      if (qrDataObj.expiresAt) {
        const expiryTime = new Date(qrDataObj.expiresAt);
        const currentTime = new Date();
        
        if (currentTime > expiryTime) {
          throw new Error('This QR code has expired. Please ask your lecturer to generate a new one.');
        }
      }

      // Send scan to backend
      const response = await fetch(`${API_CONFIG.baseURL}/attendance/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          qrData: data,
          studentId: currentUserId,
          intendedCourseId: currentScanningCourse._id, // Send the intended course ID for additional validation
          courseCode: currentScanningCourse.courseCode // Send course code for better error messages
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to record attendance');
      }

      setShowSuccessModal(true);
      setTimeout(() => {
        setShowSuccessModal(false);
        setScannerVisible(false);
        setScanned(false);
        setCurrentScanningCourse(null); // Reset current scanning course
      }, 2000);
    } catch (error: any) {
      console.error('Error scanning QR code:', error);
      setErrorMessage(error.message === 'Network request failed' 
        ? 'Unable to connect to the server. Please check your internet connection.'
        : error.message || 'Failed to record attendance');
      setShowErrorModal(true);
      setScanned(false);
    }
  };

  const handleScanPress = (course: Course) => {
    if (hasPermission === null) {
      Alert.alert('Error', 'Requesting camera permission...');
      return;
    }
    if (hasPermission === false) {
      Alert.alert('Error', 'No access to camera');
      return;
    }
    setCurrentScanningCourse(course); // Set the current course for which attendance is being marked
    setScannerVisible(true);
  };

  const startScanAnimation = () => {
    // Reset animation to the starting position
    scanLineAnim.setValue(0);
    
    Animated.loop(
      Animated.sequence([
        // Move from top to bottom
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        // Move from bottom to top
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        })
      ])
    ).start();
  };

  React.useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const handleConfirmLogout = async () => {
    try {
      // Get the current user data from AsyncStorage
      const userData = await AsyncStorage.getItem('user');
      
      console.log('Logging out student, stored data:', userData);
      
      if (userData) {
        const user = JSON.parse(userData);
        console.log('Parsed user data:', user);
        
        // For better troubleshooting
        if (user.loginAuditId) {
          console.log('Found loginAuditId:', user.loginAuditId);
          const response = await logoutUser(undefined, user.loginAuditId);
          console.log('Logout response:', response);
        } else if (user._id) {
          console.log('Using user._id for logout:', user._id);
          const response = await logoutUser(user._id);
          console.log('Logout response:', response);
        } else {
          console.log('No user ID available for logout');
        }
      } else {
        console.log('No user data in AsyncStorage');
      }
      
      // Remove user data from storage
      await AsyncStorage.removeItem('user');
      console.log('Cleared user data from AsyncStorage');
      
      // Navigate to login screen
      router.replace('/');
    } catch (error) {
      console.error('Logout error:', error);
      // Still proceed with logout even if logging the logout time fails
      router.replace('/');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchEnrolledCourses();
    setRefreshing(false);
  };

  if (!fontsLoaded && !fontError) {
    return null;
  }

  const CourseCard = ({ course }: { course: Course }) => {
    return (
      <View style={styles.courseCard}>
        <View style={styles.courseImageContainer}>
          <Image
            source={require('../assets/images/c_image.jpg')}
            style={styles.courseImage}
          />
          <View style={styles.courseOverlay}>
            <TouchableOpacity 
              style={styles.courseActionButton}
              onPress={() => handleScanPress(course)}
            >
              <MaterialIcons name="qr-code-scanner" size={24} color="#FFD700" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.courseContent}>
          <View style={styles.courseHeader}>
            <View style={styles.courseTitleContainer}>
              <Text style={styles.courseCode}>{course.courseCode}</Text>
              <Text style={styles.courseTitle} numberOfLines={1}>{course.courseName}</Text>
            </View>
            <View style={styles.instructorBadge}>
              <MaterialIcons name="person" size={16} color="#666" />
              <Text style={styles.instructorText}>
                {course.lecturerId ? `${course.lecturerId.firstName} ${course.lecturerId.lastName}` : 'Not assigned'}
              </Text>
            </View>
          </View>
          
          <View style={styles.schedulesContainer}>
            {course.schedules.map((schedule, index) => (
              <View key={index} style={styles.scheduleCard}>
                <View style={styles.scheduleHeader}>
                  <MaterialIcons name="calendar-today" size={16} color="#1c3a70" />
                  <Text style={styles.scheduleDays}>{schedule.days.join(', ')}</Text>
                </View>
                <View style={styles.scheduleTime}>
                  <MaterialIcons name="schedule" size={16} color="#1c3a70" />
                  <Text style={styles.timeText}>{schedule.startTime} - {schedule.endTime}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle="light-content" 
        backgroundColor="#1c3a70"
        translucent={true}
      />
      
      <LinearGradient
        colors={['#1c3a70', '#2c5282', '#3a6298']}
        style={styles.headerGradient}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Image
                source={require('../assets/images/logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <View style={styles.headerTitleContainer}>
                <Text style={[styles.headerTitle, styles.headerTitleChe]}>CHE</Text>
                <Text style={[styles.headerTitle, styles.headerTitleQr]}>QR</Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
                <MaterialIcons name="logout" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
          <Text style={styles.welcomeText}>Student Dashboard</Text>
          <Text style={styles.subtitleText}>Scan QR codes to mark your attendance</Text>
        </View>
      </LinearGradient>

      <View style={styles.contentContainer}>
        {isLoading && !refreshing ? (
          <ActivityIndicator size="large" color="#1c3a70" style={styles.loader} />
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : courses.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="book" size={48} color="#ccc" />
            <Text style={styles.emptyStateText}>No enrolled courses found</Text>
          </View>
        ) : (
          <FlatList
            data={courses}
            key={getNumColumns().toString()}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => <CourseCard key={item._id} course={item} />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.courseList}
            initialNumToRender={8}
            maxToRenderPerBatch={10}
            windowSize={5}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#1c3a70"]}
                tintColor="#1c3a70"
              />
            }
            numColumns={getNumColumns()}
            columnWrapperStyle={getNumColumns() > 1 ? styles.gridRow : undefined}
            ListHeaderComponent={() => (
              <View style={styles.listHeader}>
                <Text style={styles.listHeaderText}>Your Courses ({courses.length})</Text>
              </View>
            )}
            ListFooterComponent={() => <View style={styles.listFooter} />}
          />
        )}
      </View>

      {/* QR Scanner Modal */}
      <Modal
        visible={isScannerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setScannerVisible(false);
          setScanned(false);
        }}
        statusBarTranslucent={true}
      >
        <View style={styles.scannerModalContainer}>
          <View style={styles.scannerBackdrop} />
          <LinearGradient
            colors={['rgba(28, 58, 112, 100)', 'rgba(44, 82, 130, 100)', 'rgba(58, 98, 152, 100)']}
            style={styles.scannerGradient}
          >
            <View style={styles.scannerHeader}>
              <TouchableOpacity
                style={styles.closeScannerButton}
                onPress={() => {
                  setScannerVisible(false);
                  setScanned(false);
                }}
              >
                <MaterialIcons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.scannerTitle}>Scan QR Code</Text>
              <View style={{ width: 40 }} />
            </View>
            
            <View style={styles.scannerContent}>
              <View style={styles.scannerBox}>
                <CameraView
                  style={styles.camera}
                  onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                />
                <View style={styles.scannerIndicator}>
                  <View style={[styles.scannerCorner, styles.topLeft]} />
                  <View style={[styles.scannerCorner, styles.topRight]} />
                  <View style={[styles.scannerCorner, styles.bottomLeft]} />
                  <View style={[styles.scannerCorner, styles.bottomRight]} />
                  <Animated.View
                    style={[
                      styles.scanLine,
                      {
                        transform: [
                          {
                            translateY: scanLineAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [10, Dimensions.get('window').width * 0.7],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                </View>
              </View>

              <View style={styles.scannerGuide}>
                <View style={styles.guideIcon}>
                  <MaterialIcons name="qr-code-scanner" size={24} color="#FFD700" />
                </View>
                <Text style={styles.scanText}>
                  Position QR code within the frame
                </Text>
              </View>
            </View>

            <View style={styles.scannerFooter}>
              {scanned ? (
                <TouchableOpacity
                  style={styles.scanAgainButton}
                  onPress={() => setScanned(false)}
                >
                  <MaterialIcons name="refresh" size={20} color="#1c3a70" />
                  <Text style={styles.scanAgainText}>Scan Again</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.scannerHint}>
                  <MaterialIcons name="info" size={20} color="#fff" />
                  <Text style={styles.hintText}>
                    Make sure the QR code is well lit and clearly visible
                  </Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.successModal]}>
            <View style={styles.successIconContainer}>
              <MaterialIcons name="check-circle" size={64} color="#4CAF50" />
            </View>
            <Text style={styles.successTitle}>Success!</Text>
            <Text style={styles.successText}>Attendance marked successfully</Text>
          </View>
        </View>
      </Modal>

      {/* Error Modal */}
      <Modal
        visible={showErrorModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowErrorModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.errorModal]}>
            <View style={styles.errorIconContainer}>
              <MaterialIcons name="error" size={64} color="#D32F2F" />
            </View>
            <Text style={styles.errorTitle}>Error</Text>
            <Text style={styles.errorMessageText}>{errorMessage}</Text>
            <TouchableOpacity
              style={styles.errorButton}
              onPress={() => setShowErrorModal(false)}
            >
              <Text style={styles.errorButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowLogoutConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.confirmModal]}>
            <View style={styles.confirmHeader}>
              <MaterialIcons name="logout" size={48} color="#1c3a70" />
              <Text style={styles.confirmTitle}>Confirm Logout</Text>
            </View>
            
            <Text style={styles.confirmText}>
              Are you sure you want to logout?
            </Text>

            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelConfirmButton]}
                onPress={() => setShowLogoutConfirm(false)}
              >
                <Text style={styles.cancelConfirmText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.logoutConfirmButton]}
                onPress={handleConfirmLogout}
              >
                <Text style={styles.logoutConfirmText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  headerGradient: {
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) - 25 : 0,
  },
  header: {
    padding: 16,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoImage: {
    width: 38,
    height: 38,
    marginRight: 8,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 40,
    lineHeight: 40,
    includeFontPadding: false,
    textAlignVertical: 'center',
    fontFamily: 'THEDISPLAYFONT',
  },
  headerTitleChe: {
    color: '#fff',
  },
  headerTitleQr: {
    color: '#FFD700',
  },
  welcomeText: {
    fontSize: 22,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  subtitleText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoutButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
  },
  contentContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f7fa',
  },
  loader: {
    marginTop: 20,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 14,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 24,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#666',
    marginTop: 10,
  },
  courseCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(80, 102, 144, 0.1)',
  },
  courseImageContainer: {
    height: 80,
    position: 'relative',
  },
  courseImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
  },
  courseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28, 58, 112, 0.7)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  courseActionButton: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'flex-end',
  },
  courseContent: {
    padding: 12,
  },
  courseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  courseTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  courseCode: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1c3a70',
    marginBottom: 2,
  },
  courseTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1c3a70',
    lineHeight: 20,
  },
  instructorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  instructorText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  schedulesContainer: {
    gap: 8,
  },
  scheduleCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 10,
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  scheduleDays: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1c3a70',
  },
  scheduleTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 12,
    color: '#666',
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
    padding: 24,
    width: '90%',
    maxWidth: 400,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  confirmModal: {
    width: '90%',
    maxWidth: 400,
    padding: 24,
  },
  confirmHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1c3a70',
    marginTop: 8,
  },
  confirmText: {
    fontSize: 16,
    color: '#506690',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  confirmButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 8,
  },
  cancelConfirmButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  logoutConfirmButton: {
    backgroundColor: '#1c3a70',
  },
  cancelConfirmText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scannerModalContainer: {
    flex: 1,
    position: 'relative',
  },
  scannerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  scannerGradient: {
    flex: 1,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: Platform.OS === 'android' ? 60 : 80,
    overflow: 'hidden',
  },
  scannerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 20 : 60,
  },
  scannerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeScannerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerBox: {
    width: Dimensions.get('window').width * 0.8,
    height: Dimensions.get('window').width * 0.8,
    alignSelf: 'center',
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
    borderColor: '#FFD700',
    backgroundColor: '#fff',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  scannerIndicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  scannerCorner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#FFD700',
    borderWidth: 4,
  },
  scanLine: {
    position: 'absolute',
    width: '90%',
    height: 2,
    backgroundColor: '#FFD700',
    opacity: 0.8,
    top: 10, // Start from the top with a small offset
  },
  topLeft: {
    top: 20,
    left: 20,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 20,
    right: 20,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 20,
    left: 20,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 20,
    right: 20,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
  scannerGuide: {
    alignItems: 'center',
    marginTop: 30,
  },
  guideIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  scanText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.9,
  },
  scannerFooter: {
    padding: 20,
    paddingBottom: 40,
    alignItems: 'center',
  },
  scanAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  scanAgainText: {
    color: '#1c3a70',
    fontSize: 16,
    fontWeight: '600',
  },
  scannerHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    borderRadius: 12,
    gap: 8,
    maxWidth: '80%',
  },
  hintText: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
    flex: 1,
  },
  successModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '80%',
    maxWidth: 320,
  },
  successIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
  },
  successText: {
    fontSize: 16,
    color: '#506690',
    textAlign: 'center',
  },
  errorModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '80%',
    maxWidth: 320,
  },
  errorIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(211, 47, 47, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginBottom: 8,
  },
  errorMessageText: {
    fontSize: 16,
    color: '#506690',
    textAlign: 'center',
    marginBottom: 24,
  },
  errorButton: {
    backgroundColor: '#D32F2F',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  courseList: {
    padding: 8,
    paddingBottom: 32,
  },
  listHeader: {
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  listHeaderText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1c3a70',
  },
  listFooter: {
    height: 20,
  },
  gridRow: {
    flex: 1,
    justifyContent: 'space-between',
  },
}); 