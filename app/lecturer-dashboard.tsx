import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Modal, BackHandler, Alert, TextInput, RefreshControl, Platform, Vibration, StatusBar, Dimensions, FlatList } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Course, getCourses, logoutUser } from '../lib/api';
import QRCode from 'react-native-qrcode-svg';
import * as MediaLibrary from 'expo-media-library';
import ViewShot from 'react-native-view-shot';
import { API_CONFIG } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

const SCREEN_WIDTH = Dimensions.get('window').width;

const getNumColumns = () => {
  return SCREEN_WIDTH >= 768 ? 2 : 1; // Use 2 columns for tablets/wider screens
};

// Function to get current Philippine time
const getPhilippineTime = () => {
  // Get current UTC time in milliseconds
  const now = new Date();
  const utcTimeMs = now.getTime();
  
  // Convert to Philippine time (UTC+8)
  return new Date(utcTimeMs + (8 * 60 * 60 * 1000));
};

// Function to format time in Philippine timezone
const formatPhilippineTime = (timestamp: string) => {
  try {    
    // Parse the ISO string timestamp directly
    const date = new Date(timestamp);
    
    // Extract time directly from the timestamp without adding 8 hours
    // For database timestamps like 2025-05-18T14:21:17.727+00:00
    const match = timestamp.match(/T(\d{2}):(\d{2})/);
    if (match) {
      const hours24 = parseInt(match[1], 10);
      const minutes = match[2];
      
      // Convert to 12-hour format
      const ampm = hours24 >= 12 ? 'PM' : 'AM';
      const hours12 = hours24 % 12 || 12; // Convert 0 to 12
      
      // Return formatted string - display the database time directly
      return `${hours12}:${minutes} ${ampm}`;
    }
    
    // Fallback if regex fails
    const hours = date.getUTCHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    
    return `${hours12}:${minutes} ${ampm}`;
  } catch (error) {
    console.error('Error formatting time:', error);
    return timestamp; // Return original timestamp as fallback
  }
};

// Function to format date from database timestamp
const formatPhilippineDate = (timestamp: string) => {
  try {
    // Parse the ISO string timestamp directly
    const date = new Date(timestamp);
    
    // Extract date directly from the timestamp without timezone adjustment
    const match = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // Months are 0-based in JS
      const day = parseInt(match[3], 10);
      
      // Create a Date object with these values to get day of week
      const dateObj = new Date(year, month, day);
      const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dateObj.getDay()];
      
      // Get month name
      const monthName = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][month];
      
      // Return formatted string
      return `${dayOfWeek}, ${monthName} ${day}, ${year}`;
    }
    
    // Fallback if regex fails
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getUTCDay()];
    const monthName = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][date.getUTCMonth()];
    const day = date.getUTCDate();
    const year = date.getUTCFullYear();
    
    return `${dayOfWeek}, ${monthName} ${day}, ${year}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return timestamp; // Return original timestamp as fallback
  }
};

// Function to format date and time for session tabs
const formatSessionTabTime = (timestamp: string) => {
  try {
    // Extract date and time directly from the timestamp without timezone adjustment
    const dateMatch = timestamp.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const timeMatch = timestamp.match(/T(\d{2}):(\d{2})/);
    
    if (dateMatch && timeMatch) {
      // Parse date components
      const year = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10) - 1; // Months are 0-based in JS
      const day = parseInt(dateMatch[3], 10);
      
      // Parse time components
      const hours24 = parseInt(timeMatch[1], 10);
      const minutes = timeMatch[2];
      
      // Convert to 12-hour format
      const ampm = hours24 >= 12 ? 'PM' : 'AM';
      const hours12 = hours24 % 12 || 12; // Convert 0 to 12
      
      // Get abbreviated month name
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
      // Return formatted string - display the database time directly
      return `${months[month]} ${day}, ${hours12}:${minutes} ${ampm}`;
    }
    
    // Fallback if regex fails - use direct UTC methods
    const date = new Date(timestamp);
    
    const month = date.getUTCMonth();
    const day = date.getUTCDate();
    const hours = date.getUTCHours();
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    
    // Format time for display
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hours12 = hours % 12 || 12;
    
    // Get abbreviated month name
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return `${months[month]} ${day}, ${hours12}:${minutes} ${ampm}`;
  } catch (error) {
    console.error('Error formatting session tab time:', error);
    return timestamp; // Return original timestamp as fallback
  }
};

// WebSocket connection setup with improved error handling - disabled since server doesn't support WebSockets
const setupWebSocket = (courseId: string, onNewScan: () => void) => {
  // Return null to indicate WebSocket is not available
  // This will trigger the polling fallback
  console.log('WebSocket not available on server, using polling instead');
  return null;
};

SplashScreen.preventAutoHideAsync();

export default function LecturerDashboard() {
  const params = useLocalSearchParams();
  const currentUserId = params.id as string;

  const [fontsLoaded, fontError] = useFonts({
    'THEDISPLAYFONT': require('../assets/fonts/THEDISPLAYFONT-DEMOVERSION.ttf'),
  });

  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [semesters, setSemesters] = useState<string[]>([]);

  useEffect(() => {
    if (currentUserId) {
      fetchAssignedCourses();
    }
  }, [currentUserId]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      setShowLogoutConfirm(true);
      return true; // Prevent default back behavior
    });

    return () => backHandler.remove();
  }, []);

  // Extract semesters from courses for filtering
  useEffect(() => {
    if (courses.length > 0) {
      // We'll use courseCode prefix as a grouping mechanism since 'semester' doesn't exist
      // This assumes course codes follow a pattern like 'CS101', 'CS102', 'MATH101'
      const prefixSet = new Set<string>();
      
      courses.forEach(course => {
        // Extract the department prefix from the course code (e.g., 'CS' from 'CS101')
        const prefix = course.courseCode.match(/^[A-Z]+/);
        if (prefix && prefix[0]) {
          prefixSet.add(prefix[0]);
        }
      });
      
      const uniquePrefixes = Array.from(prefixSet).sort();
      setSemesters(uniquePrefixes);
    }
  }, [courses]);

  // New effect to filter courses based on search and filter
  useEffect(() => {
    if (!courses.length) {
      setFilteredCourses([]);
      return;
    }

    let result = [...courses];

    // Apply search filter
    if (courseSearch.trim()) {
      const searchLower = courseSearch.toLowerCase();
      result = result.filter(course => 
        course.courseName.toLowerCase().includes(searchLower) || 
        course.courseCode.toLowerCase().includes(searchLower)
      );
    }

    // Apply prefix/department filter
    if (activeFilter) {
      result = result.filter(course => course.courseCode.startsWith(activeFilter));
    }

    // Sort courses alphabetically
    result = result.sort((a, b) => a.courseName.localeCompare(b.courseName));
    
    setFilteredCourses(result);
  }, [courses, courseSearch, activeFilter]);

  const fetchAssignedCourses = async () => {
    try {
      setIsLoading(true);
      const allCourses = await getCourses();
      console.log('Current Lecturer ID:', currentUserId);
      console.log('All Courses:', allCourses);

      const assignedCourses = allCourses.filter((course: Course) => {
        console.log('Course Lecturer ID:', course.lecturerId?._id);
        return course.lecturerId?._id === currentUserId;
      });

      console.log('Assigned Courses:', assignedCourses);
      setCourses(assignedCourses);
      setFilteredCourses(assignedCourses);
      setError(null);
    } catch (error) {
      console.error('Error fetching assigned courses:', error);
      setError('Failed to fetch courses. Please try again.');
    } finally {
      setIsLoading(false);
    }
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
      
      console.log('Logging out lecturer, stored data:', userData);
      
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

  const handleRefresh = () => {
    fetchAssignedCourses();
  };

  const generateQRData = (course: Course) => {
    const phTime = getPhilippineTime();
    const expiryTime = new Date(phTime.getTime() + (60 * 60 * 1000)); // 1 hour from now

    return JSON.stringify({
      courseId: course._id,
      courseCode: course.courseCode,
      courseName: course.courseName,
      generatedAt: phTime.toISOString(),
      expiresAt: expiryTime.toISOString()
    });
  };

  const clearFilters = () => {
    setActiveFilter(null);
    setCourseSearch('');
  };

  if (!fontsLoaded && !fontError) {
    return null;
  }

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
          <Text style={styles.welcomeText}>Lecturer Dashboard</Text>
          <Text style={styles.subtitleText}>Manage attendance and view student records</Text>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color="#506690" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search courses..."
            value={courseSearch}
            onChangeText={setCourseSearch}
            placeholderTextColor="#999"
          />
          {courseSearch ? (
            <TouchableOpacity
              onPress={() => setCourseSearch('')}
              style={styles.clearSearchButton}
            >
              <MaterialIcons name="close" size={20} color="#506690" />
            </TouchableOpacity>
          ) : null}
        </View>

        {semesters.length > 0 && (
          <View style={styles.filterContainer}>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScroll}
            >
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  activeFilter === null && styles.activeFilterChip
                ]}
                onPress={() => setActiveFilter(null)}
              >
                <Text 
                  style={[
                    styles.filterChipText,
                    activeFilter === null && styles.activeFilterChipText
                  ]}
                >
                  All Departments
                </Text>
              </TouchableOpacity>
              
              {semesters.map(prefix => (
                <TouchableOpacity
                  key={prefix}
                  style={[
                    styles.filterChip,
                    activeFilter === prefix && styles.activeFilterChip
                  ]}
                  onPress={() => setActiveFilter(prefix)}
                >
                  <Text 
                    style={[
                      styles.filterChipText,
                      activeFilter === prefix && styles.activeFilterChipText
                    ]}
                  >
                    {prefix}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            
            {(activeFilter || courseSearch) && (
              <TouchableOpacity 
                style={styles.clearFiltersButton}
                onPress={clearFilters}
              >
                <MaterialIcons name="clear-all" size={18} color="#506690" />
                <Text style={styles.clearFiltersText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        
        {isLoading ? (
          <ActivityIndicator size="large" color="#1c3a70" style={styles.loader} />
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : filteredCourses.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="book" size={48} color="#ccc" />
            {courseSearch ? (
              <Text style={styles.emptyStateText}>No courses match your search</Text>
            ) : (
              <Text style={styles.emptyStateText}>No assigned courses found</Text>
            )}
          </View>
        ) : (
          <FlatList
            data={filteredCourses}
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
                refreshing={isLoading}
                onRefresh={handleRefresh}
                colors={["#1c3a70"]}
                tintColor="#1c3a70"
              />
            }
            numColumns={getNumColumns()}
            columnWrapperStyle={getNumColumns() > 1 ? styles.gridRow : undefined}
            ListHeaderComponent={() => (
              <View style={styles.listHeader}>
                <Text style={styles.listHeaderText}>Your Courses ({filteredCourses.length})</Text>
              </View>
            )}
            ListFooterComponent={() => <View style={styles.listFooter} />}
          />
        )}
      </View>

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

const CourseCard = ({ course }: { course: Course }) => {
  const [showQRModal, setShowQRModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showEnrolledStudentsModal, setShowEnrolledStudentsModal] = useState(false);
  const [qrData, setQRData] = useState<{ data: string; expiresAt: string } | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [remainingTime, setRemainingTime] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [newScans, setNewScans] = useState(0);
  const qrRef = useRef<any>(null);
  const countdownInterval = useRef<NodeJS.Timeout>();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const lastCheckTime = useRef<Date>(new Date());
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [detailedStudents, setDetailedStudents] = useState<any[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Setup polling for attendance updates
  useEffect(() => {
    const handleNewScan = async () => {
      try {
        // Throttle checks - only check if last check was more than 3 seconds ago
        const now = new Date();
        const timeSinceLastCheck = now.getTime() - lastCheckTime.current.getTime();
        if (timeSinceLastCheck < 3000) {
          return; // Skip this check if too soon
        }
        
        const response = await fetch(`${API_CONFIG.baseURL}/attendance/course/${course._id}`);
        if (!response.ok) return;

        const records = await response.json();
        const phTime = getPhilippineTime();

        // Count scans in the last 5 minutes
        const recentScans = records.reduce((count: number, record: any) => {
          const recordTime = new Date(record.generatedAt);
          const timeDiff = phTime.getTime() - recordTime.getTime();
          if (timeDiff <= 5 * 60 * 1000) { // 5 minutes
            return count + record.scannedBy.length;
          }
          return count;
        }, 0);

        setNewScans(recentScans);
        lastCheckTime.current = now;
      } catch (error) {
        // Silently handle errors to avoid console spam
      }
    };

    // Create a polling interval
    const pollingInterval = setInterval(handleNewScan, 10000); // Poll every 10 seconds
    
    // Initial check
    handleNewScan();
    
    // Clean up polling interval
    return () => {
      clearInterval(pollingInterval);
    };
  }, [course._id]);

  // Check for existing valid QR code
  const checkExistingQRCode = async () => {
    try {
      const response = await fetch(`${API_CONFIG.baseURL}/attendance/course/${course._id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch attendance records');
      }
      const records = await response.json();

      // Find the most recent valid QR code
      const phTime = getPhilippineTime();
      const validRecord = records.find((record: any) => new Date(record.expiresAt) > phTime);

      if (validRecord) {
        setQRData({
          data: validRecord.qrCodeData,
          expiresAt: validRecord.expiresAt
        });
        setShowQRModal(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error checking existing QR code:', error);
      return false;
    }
  };

  // Check countdown timer
  useEffect(() => {
    if (qrData) {
      // Start countdown timer
      countdownInterval.current = setInterval(() => {
        const phTime = getPhilippineTime();
        const expiryTime = new Date(qrData.expiresAt);
        const diffInMinutes = Math.floor((expiryTime.getTime() - phTime.getTime()) / (1000 * 60));

        if (diffInMinutes <= 0) {
          setRemainingTime('expired');
          clearInterval(countdownInterval.current);
          setShowQRModal(false);
          setQRData(null);
        } else {
          setRemainingTime(`${diffInMinutes} minutes`);
        }
      }, 1000);
    }

    return () => {
      if (countdownInterval.current) {
        clearInterval(countdownInterval.current);
      }
    };
  }, [qrData]);

  const generateQRData = async () => {
    try {
      setIsLoading(true);
      if (!course.lecturerId?._id) {
        throw new Error('Lecturer ID not found');
      }

      const response = await fetch(`${API_CONFIG.baseURL}/attendance/generate-qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          courseId: course._id,
          lecturerId: course.lecturerId._id
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate QR code');
      }

      const data = await response.json();
      return {
        data: data.qrData,
        expiresAt: data.expiresAt
      };
    } catch (error) {
      console.error('Error generating QR code:', error);
      Alert.alert('Error', 'Failed to generate QR code. Please try again.');
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateQR = async () => {
    const hasValidQR = await checkExistingQRCode();
    if (!hasValidQR) {
      setShowConfirmModal(true);
    }
  };

  const handleConfirmGenerateQR = async () => {
    setShowConfirmModal(false);
    const newQRData = await generateQRData();
    if (newQRData) {
      setQRData(newQRData);
      setShowQRModal(true);
    }
  };

  // Reset new scans count when viewing attendance
  const handleViewAttendance = async () => {
    setNewScans(0);
    try {
      const response = await fetch(`${API_CONFIG.baseURL}/attendance/course/${course._id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch attendance records');
      }
      const records = await response.json();

      // Sort records by generation time (most recent first)
      const sortedRecords = records.sort((a: any, b: any) =>
        new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
      );

      setAttendanceRecords(sortedRecords);
      setShowAttendanceModal(true);
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      Alert.alert('Error', 'Failed to fetch attendance records. Please try again.');
    }
  };

  const handleSaveQRCode = async () => {
    try {
      // Request permission to access media library
      const { status } = await MediaLibrary.requestPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please grant permission to save QR code to your gallery.');
        return;
      }

      if (qrRef.current) {
        const uri = await qrRef.current.capture();
        const asset = await MediaLibrary.createAssetAsync(uri);
        await MediaLibrary.createAlbumAsync('CHEQR', asset, false);

        Alert.alert('Success', 'QR code saved to gallery successfully!');
      }
    } catch (error) {
      console.error('Error saving QR code:', error);
      Alert.alert('Error', 'Failed to save QR code to gallery.');
    }
  };

  const filteredRecords = attendanceRecords.map(record => {
    const filteredScans = record.scannedBy.filter((scan: any) => {
      const fullName = `${scan.studentId.firstName} ${scan.studentId.lastName}`.toLowerCase();
      const idNumber = scan.studentId.idNumber.toLowerCase();
      const query = searchQuery.toLowerCase();
      return fullName.includes(query) || idNumber.includes(query);
    });
    return { ...record, scannedBy: filteredScans };
  }).filter(record => record.scannedBy.length > 0);

  const handleViewEnrolledStudents = async () => {
    setShowEnrolledStudentsModal(true);
    setStudentSearchQuery('');
    await fetchDetailedStudents();
  };

  // Function to fetch detailed student data
  const fetchDetailedStudents = async () => {
    if (!course || !course._id) return;
    
    try {
      setLoadingStudents(true);
      const response = await fetch(`${API_CONFIG.baseURL}/courses/${course._id}/students`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch student details');
      }
      
      const data = await response.json();
      console.log(`Fetched ${data.length} detailed students for course ${course.courseCode}`);
      setDetailedStudents(data);
    } catch (error) {
      console.error('Error fetching detailed student data:', error);
      Alert.alert('Error', 'Failed to load student details. Please try again.');
      // Use existing course.students as fallback
      setDetailedStudents(course.students || []);
    } finally {
      setLoadingStudents(false);
    }
  };

  // Function to filter students based on search query
  const getFilteredStudents = () => {
    if (!detailedStudents || !Array.isArray(detailedStudents) || detailedStudents.length === 0) {
      return [];
    }
    
    // Start with all students
    let filtered = [...detailedStudents];
    
    // Apply search filter if needed
    if (studentSearchQuery.trim()) {
      const query = studentSearchQuery.toLowerCase();
      filtered = filtered.filter((student: any) => {
        const fullName = `${student.firstName || ''} ${student.lastName || ''}`.toLowerCase();
        const idNumber = (student.idNumber || '').toLowerCase();
        return fullName.includes(query) || idNumber.includes(query);
      });
    }
    
    // Sort alphabetically by last name
    filtered.sort((a: any, b: any) => {
      const lastNameA = (a.lastName || '').toLowerCase();
      const lastNameB = (b.lastName || '').toLowerCase();
      
      if (lastNameA < lastNameB) return -1;
      if (lastNameA > lastNameB) return 1;
      
      // If last names are the same, sort by first name
      const firstNameA = (a.firstName || '').toLowerCase();
      const firstNameB = (b.firstName || '').toLowerCase();
      return firstNameA < firstNameB ? -1 : firstNameA > firstNameB ? 1 : 0;
    });
    
    return filtered;
  };

  return (
    <View style={styles.courseCard}>
      <View style={styles.courseImageContainer}>
        <Image
          source={require('../assets/images/c_image.jpg')}
          style={styles.courseImage}
        />
        <View style={styles.courseOverlay}>
          <View style={styles.courseActions}>
            <TouchableOpacity
              style={styles.courseActionButton}
              onPress={handleGenerateQR}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFD700" />
              ) : (
                <MaterialIcons name="qr-code" size={24} color="#FFD700" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.courseActionButton}
              onPress={handleViewAttendance}
            >
              <View>
                <MaterialIcons name="people" size={24} color="#FFD700" />
                {newScans > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationText}>{newScans}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.courseActionButton}
              onPress={handleViewEnrolledStudents}
            >
              <MaterialIcons name="format-list-bulleted" size={24} color="#FFD700" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <View style={styles.courseContent}>
        <View style={styles.courseHeader}>
          <View style={styles.courseTitleContainer}>
            <Text style={styles.courseCode}>{course.courseCode}</Text>
            <Text style={styles.courseTitle} numberOfLines={1}>{course.courseName}</Text>
          </View>
          <View style={styles.studentCount}>
            <MaterialIcons name="people" size={16} color="#666" />
            <Text style={styles.studentCountText}>{course.students?.length || 0}</Text>
          </View>
        </View>

        <View style={styles.schedulesContainer}>
          {course.schedules.map((schedule, index) => (
            <View key={index} style={styles.scheduleCard}>
              <View style={styles.scheduleHeader}>
                <MaterialIcons name="calendar-today" size={16} color="#002147" />
                <Text style={styles.scheduleDays}>{schedule.days.join(', ')}</Text>
              </View>
              <View style={styles.scheduleTime}>
                <MaterialIcons name="schedule" size={16} color="#002147" />
                <Text style={styles.timeText}>{schedule.startTime} - {schedule.endTime}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* QR Code Generation Confirmation Modal */}
      <Modal
        visible={showConfirmModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowConfirmModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.confirmModal]}>
            <View style={styles.confirmHeader}>
              <MaterialIcons name="qr-code" size={48} color="#1c3a70" />
              <Text style={styles.confirmTitle}>Generate QR Code</Text>
            </View>

            <Text style={styles.confirmText}>
              This will generate a QR code for attendance that will expire in 1 hour. Are you sure you want to proceed?
            </Text>

            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelConfirmButton]}
                onPress={() => setShowConfirmModal(false)}
              >
                <Text style={styles.cancelConfirmText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.confirmGenerateButton]}
                onPress={handleConfirmGenerateQR}
              >
                <Text style={styles.confirmGenerateText}>Generate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* QR Code Modal */}
      <Modal
        visible={showQRModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowQRModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.qrModalContent}>
            <LinearGradient
              colors={['#1c3a70', '#2c5282']}
              style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>Attendance QR Code</Text>
              <TouchableOpacity 
                style={styles.qrModalCloseButton}
                onPress={() => setShowQRModal(false)}
              >
                <MaterialIcons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>
            
            <View style={styles.qrModalBody}>
              <View style={styles.courseQRInfo}>
                <Text style={styles.qrCourseCode}>{course.courseCode}</Text>
                <Text style={styles.qrCourseName}>{course.courseName}</Text>
              </View>
              
              <ViewShot ref={qrRef} style={styles.qrContainer}>
                {qrData && (
                  <QRCode
                    value={qrData.data}
                    size={240}
                    color="#1c3a70"
                    backgroundColor="white"
                  />
                )}
              </ViewShot>
              
              <View style={styles.qrExpiryContainer}>
                <View style={styles.qrExpiryBadge}>
                  <MaterialIcons name="schedule" size={18} color="#1c3a70" />
                  <Text style={styles.qrExpiryText}>
                    Expires in {remainingTime}
                  </Text>
                </View>
              </View>
              
              <View style={styles.qrInfoPanel}>
                <View style={styles.qrInfoRow}>
                  <MaterialIcons name="info" size={20} color="#1c3a70" />
                  <Text style={styles.qrInfoText}>
                    This QR code is valid ONLY for {course.courseCode}
                  </Text>
                </View>
                
                <View style={styles.qrInfoRow}>
                  <MaterialIcons name="people" size={20} color="#1c3a70" />
                  <Text style={styles.qrInfoText}>
                    {course.students?.length || 0} students can scan this code
                  </Text>
                </View>
                
                <View style={styles.qrInfoRow}>
                  <MaterialIcons name="qr-code-scanner" size={20} color="#1c3a70" />
                  <Text style={styles.qrInfoText}>
                    Students must use the CHEQR app to scan
                  </Text>
                </View>
              </View>
              
              <TouchableOpacity
                style={styles.saveQrButton}
                onPress={handleSaveQRCode}
              >
                <MaterialIcons name="save" size={20} color="#fff" />
                <Text style={styles.saveQrButtonText}>Save to Gallery</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Attendance Modal - Always Fullscreen */}
      <Modal
        visible={showAttendanceModal}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowAttendanceModal(false)}
        statusBarTranslucent={true}
      >
        <View style={styles.fullScreenModal}>
          <View style={styles.fullScreenContent}>
            <LinearGradient
              colors={['#1c3a70', '#2c5282', '#3a6298']}
              style={styles.headerGradient}>
              <View style={styles.attendanceModalHeader}>
                <View style={styles.modalTitleContainer}>
                  <Text style={styles.attendanceModalTitle}>Attendance Records</Text>
                  <Text style={styles.attendanceCourseSubtitle}>{course.courseName}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.modalCloseButton}
                  onPress={() => setShowAttendanceModal(false)}
                >
                  <MaterialIcons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={20} color="#506690" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or ID..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#999"
              />
              {searchQuery ? (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  style={styles.clearSearchButton}
                >
                  <MaterialIcons name="close" size={20} color="#506690" />
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.sessionTabs}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity
                  style={[styles.sessionTab, !selectedSession && styles.selectedSessionTab]}
                  onPress={() => setSelectedSession(null)}
                >
                  <Text style={[styles.sessionTabText, !selectedSession && styles.selectedSessionTabText]}>
                    All Sessions
                  </Text>
                </TouchableOpacity>
                {attendanceRecords.map((record, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[styles.sessionTab, selectedSession === record._id && styles.selectedSessionTab]}
                    onPress={() => setSelectedSession(record._id)}
                  >
                    <Text style={[styles.sessionTabText, selectedSession === record._id && styles.selectedSessionTabText]}>
                      {formatSessionTabTime(record.generatedAt)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {filteredRecords.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="people" size={48} color="#ccc" />
                <Text style={styles.noAttendanceText}>
                  {searchQuery ? 'No matching students found' : 'No attendance records found'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={filteredRecords.filter(record => !selectedSession || record._id === selectedSession)}
                keyExtractor={(item, index) => `${item._id}-${index}`}
                renderItem={({ item: record }) => (
                  <View style={styles.attendanceSession}>
                    <View style={styles.sessionHeader}>
                      <Text style={styles.sessionDate}>
                        {formatPhilippineDate(record.generatedAt)}
                      </Text>
                      <Text style={styles.sessionTime}>
                        {formatPhilippineTime(record.generatedAt)}
                      </Text>
                    </View>
                    <View style={styles.studentCountBadge}>
                      <MaterialIcons name="groups" size={16} color="#1c3a70" />
                      <Text style={styles.studentCountBadgeText}>{record.scannedBy.length} students</Text>
                    </View>
                    <FlatList
                      data={record.scannedBy}
                      keyExtractor={(scan, scanIndex) => `${record._id}-${scan.studentId._id || scanIndex}`}
                      renderItem={({ item: scan }) => (
                        <View style={styles.studentItem}>
                          <View style={styles.studentInfo}>
                            <Text style={styles.studentName}>
                              {scan.studentId.firstName} {scan.studentId.lastName}
                            </Text>
                            <Text style={styles.studentId}>
                              ID: {scan.studentId.idNumber}
                            </Text>
                          </View>
                          <View style={styles.scanTimeContainer}>
                            <MaterialIcons name="check-circle" size={16} color="#4CAF50" style={styles.checkmarkIcon} />
                            <Text style={styles.scanTime}>
                              {formatPhilippineTime(scan.scannedAt)}
                            </Text>
                          </View>
                        </View>
                      )}
                      initialNumToRender={10}
                      maxToRenderPerBatch={20}
                      windowSize={10}
                      removeClippedSubviews={true}
                      ListHeaderComponent={<View style={{ height: 8 }} />}
                      ListFooterComponent={<View style={{ height: 8 }} />}
                      style={styles.studentsList}
                      contentContainerStyle={styles.studentsListContent}
                    />
                  </View>
                )}
                initialNumToRender={5}
                maxToRenderPerBatch={10}
                windowSize={10}
                removeClippedSubviews={true}
                contentContainerStyle={styles.attendanceListContent}
                showsVerticalScrollIndicator={true}
                ListHeaderComponent={
                  <View style={styles.attendanceStatsHeader}>
                    <View style={styles.attendanceStatItem}>
                      <Text style={styles.attendanceStatValue}>{attendanceRecords.length}</Text>
                      <Text style={styles.attendanceStatLabel}>Sessions</Text>
                    </View>
                    <View style={styles.attendanceStatItem}>
                      <Text style={styles.attendanceStatValue}>
                        {attendanceRecords.reduce((total, record) => total + record.scannedBy.length, 0)}
                      </Text>
                      <Text style={styles.attendanceStatLabel}>Total Scans</Text>
                    </View>
                  </View>
                }
                ListFooterComponent={<View style={{ height: 32 }} />}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Enrolled Students Modal */}
      <Modal
        visible={showEnrolledStudentsModal}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setShowEnrolledStudentsModal(false)}
        statusBarTranslucent={true}
      >
        <View style={styles.fullScreenModal}>
          <View style={styles.fullScreenContent}>
            <LinearGradient
              colors={['#1c3a70', '#2c5282', '#3a6298']}
              style={styles.headerGradient}>
              <View style={styles.attendanceModalHeader}>
                <View style={styles.modalTitleContainer}>
                  <Text style={styles.attendanceModalTitle}>Enrolled Students</Text>
                  <Text style={styles.attendanceCourseSubtitle}>{course.courseName}</Text>
                </View>
                <TouchableOpacity 
                  style={styles.modalCloseButton}
                  onPress={() => setShowEnrolledStudentsModal(false)}
                >
                  <MaterialIcons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </LinearGradient>

            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={20} color="#506690" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or ID..."
                value={studentSearchQuery}
                onChangeText={setStudentSearchQuery}
                placeholderTextColor="#999"
              />
              {studentSearchQuery ? (
                <TouchableOpacity
                  onPress={() => setStudentSearchQuery('')}
                  style={styles.clearSearchButton}
                >
                  <MaterialIcons name="close" size={20} color="#506690" />
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.enrollmentStatsHeader}>
              <View style={styles.enrollmentStatCard}>
                <View style={styles.enrollmentStatRow}>
                  <MaterialIcons name="people" size={16} color="#1c3a70" />
                  <Text style={styles.enrollmentStatLabel}>Total Students:</Text>
                  <Text style={styles.enrollmentStatValue}>{detailedStudents?.length || 0}</Text>
                </View>
              </View>
            </View>

            {loadingStudents ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1c3a70" />
                <Text style={styles.loadingText}>Loading student details...</Text>
              </View>
            ) : (!detailedStudents || detailedStudents.length === 0) ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="people" size={48} color="#ccc" />
                <Text style={styles.noAttendanceText}>No students enrolled in this course</Text>
              </View>
            ) : getFilteredStudents().length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="search-off" size={48} color="#ccc" />
                <Text style={styles.noAttendanceText}>No students match your search</Text>
              </View>
            ) : (
              <FlatList
                data={getFilteredStudents()}
                keyExtractor={(student: any) => student._id || String(Math.random())}
                renderItem={({ item: student, index }: { item: any, index: number }) => (
                  <View style={styles.studentListItem}>
                    <View style={styles.studentAvatar}>
                      <Text style={styles.studentInitials}>
                        {(student.firstName || '')[0]}{(student.lastName || '')[0]}
                      </Text>
                    </View>
                    <View style={styles.studentInfo}>
                      <Text style={styles.studentName}>
                        <Text style={styles.studentLastName}>{student.lastName || ''}</Text>{student.lastName ? ', ' : ''}
                        <Text>{student.firstName || ''}</Text>
                      </Text>
                      {student.idNumber && (
                        <Text style={styles.studentId}>
                          ID: {student.idNumber}
                        </Text>
                      )}
                      {student.email && (
                        <Text style={styles.studentEmail}>
                          {student.email}
                        </Text>
                      )}
                    </View>
                    <View style={styles.studentRight}>
                      <View style={styles.studentIndexBadge}>
                        <Text style={styles.studentIndexText}>{index + 1}</Text>
                      </View>
                      {student.program && (
                        <Text style={styles.studentProgram}>{student.program}</Text>
                      )}
                    </View>
                  </View>
                )}
                contentContainerStyle={styles.studentsListContent}
                showsVerticalScrollIndicator={true}
                initialNumToRender={15}
                maxToRenderPerBatch={20}
                windowSize={10}
                removeClippedSubviews={true}
                refreshControl={
                  <RefreshControl
                    refreshing={loadingStudents}
                    onRefresh={fetchDetailedStudents}
                    colors={["#1c3a70"]}
                    tintColor="#1c3a70"
                  />
                }
                ListHeaderComponent={
                  <View style={styles.studentListHeader}>
                    <Text style={styles.studentListHeaderText}>Name</Text>
                    <Text style={styles.studentListHeaderText}>ID/Contact</Text>
                  </View>
                }
                ItemSeparatorComponent={() => <View style={styles.studentSeparator} />}
                stickyHeaderIndices={[0]}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

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
  logoutButton: {
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
  },
  content: {
    flex: 1,
    padding: 16,
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
  courseActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
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
  studentCount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  studentCountText: {
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
    padding: 25,
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
  qrContainer: {
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 8,
    marginVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(80, 102, 144, 0.15)',
  },
  qrInfo: {
    fontSize: 14,
    color: '#506690',
    textAlign: 'center',
    marginTop: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(80, 102, 144, 0.1)',
    backgroundColor: '#fff',
  },
  modalTitleContainer: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1c3a70',
  },
  courseSubtitle: {
    fontSize: 14,
    color: '#506690',
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  fullScreenModal: {
    backgroundColor: '#fff',
  },
  fullScreenContent: {
    width: '100%',
    height: '100%',
    maxWidth: '100%',
    borderRadius: 0,
    padding: 0,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1c3a70',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
    gap: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmGenerateButton: {
    backgroundColor: '#1c3a70',
  },
  confirmGenerateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  courseQRInfo: {
    alignItems: 'center',
    marginBottom: 16,
  },
  qrCourseCode: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1c3a70',
  },
  qrCourseName: {
    fontSize: 16,
    color: '#506690',
  },
  qrWatermark: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.1,
  },
  qrWatermarkText: {
    fontSize: 24,
    color: '#1c3a70',
    fontWeight: 'bold',
  },
  qrWarning: {
    fontSize: 12,
    color: '#FF3B30',
    textAlign: 'center',
    marginTop: 10,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(28, 58, 112, 0.05)',
  },
  attendanceModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 10 : 50,
  },
  attendanceModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  attendanceCourseSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: 5,
    marginBottom: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
    height: 48,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(80, 102, 144, 0.05)',
  },
  searchIcon: {
    marginRight: 12,
    color: '#506690',
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#333',
  },
  clearSearchButton: {
    padding: 8,
  },
  sessionTabs: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(80, 102, 144, 0.1)',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sessionTab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 20,
  },
  selectedSessionTab: {
    backgroundColor: '#1c3a70',
  },
  sessionTabText: {
    fontSize: 14,
    color: '#506690',
  },
  selectedSessionTabText: {
    color: '#fff',
    fontWeight: '600',
  },
  attendanceList: {
    flex: 1,
    padding: 16,
  },
  attendanceListContent: {
    paddingBottom: 24,
  },
  noAttendanceText: {
    fontSize: 16,
    color: '#666',
    marginTop: 24,
    textAlign: 'center',
  },
  attendanceSession: {
    marginBottom: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 0,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(80, 102, 144, 0.1)',
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(80, 102, 144, 0.1)',
  },
  sessionDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c3a70',
  },
  sessionTime: {
    fontSize: 14,
    color: '#506690',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  studentsList: {
    padding: 16,
  },
  studentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    borderWidth: 1,
    borderColor: 'rgba(80, 102, 144, 0.05)',
  },
  studentInfo: {
    flex: 1,
    marginRight: 12,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c3a70',
    marginBottom: 4,
  },
  studentId: {
    fontSize: 14,
    color: '#506690',
  },
  studentEmail: {
    fontSize: 12,
    color: '#506690',
    marginTop: 2,
  },
  scanTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  checkmarkIcon: {
    marginRight: 2,
  },
  scanTime: {
    fontSize: 14,
    color: '#506690',
    fontWeight: '500',
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
  filterContainer: {
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  filterScroll: {
    paddingVertical: 8,
    paddingRight: 16,
    flexGrow: 1,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f5f7fa',
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'rgba(80, 102, 144, 0.1)',
  },
  activeFilterChip: {
    backgroundColor: '#1c3a70',
  },
  filterChipText: {
    color: '#506690',
    fontWeight: '500',
  },
  activeFilterChipText: {
    color: '#fff',
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  clearFiltersText: {
    color: '#506690',
    marginLeft: 4,
    fontWeight: '500',
  },
  attendanceStatsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  attendanceStatItem: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  attendanceStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1c3a70',
    marginBottom: 4,
  },
  attendanceStatLabel: {
    fontSize: 14,
    color: '#506690',
  },
  studentCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 12,
  },
  studentCountBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginLeft: 5,
  },
  studentsListContent: {
    paddingTop: 8,
    paddingBottom: 24,
  },
  studentListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    marginHorizontal: 16,
  },
  studentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1c3a70',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  studentInitials: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  studentLastName: {
    fontWeight: 'bold',
  },
  studentRight: {
    alignItems: 'flex-end',
    marginLeft: 'auto',
  },
  studentProgram: {
    fontSize: 12,
    color: '#506690',
    marginTop: 4,
    backgroundColor: '#f0f2f5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  studentListHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(80, 102, 144, 0.1)',
  },
  studentListHeaderText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1c3a70',
  },
  studentSeparator: {
    height: 1,
    backgroundColor: 'rgba(80, 102, 144, 0.05)',
    marginLeft: 64,
    marginRight: 16,
  },
  enrollmentStatsHeader: {
    padding: 12,
  },
  enrollmentStatCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(80, 102, 144, 0.05)',
  },
  enrollmentStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 8,
  },
  enrollmentStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1c3a70',
  },
  enrollmentStatLabel: {
    fontSize: 14,
    color: '#506690',
  },
  studentIndexBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f0f2f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 'auto',
    paddingHorizontal: 8,
  },
  studentIndexText: {
    fontSize: 12,
    color: '#506690',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#506690',
    marginTop: 12,
  },
  qrModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '90%',
    maxWidth: 400,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  qrModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  qrModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  qrModalCloseButton: {
    padding: 8,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  qrModalBody: {
    padding: 24,
  },
  qrExpiryContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  qrExpiryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f2f5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    gap: 8,
  },
  qrExpiryText: {
    fontSize: 14,
    color: '#1c3a70',
    fontWeight: '600',
  },
  qrInfoPanel: {
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    gap: 12,
  },
  qrInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qrInfoText: {
    fontSize: 14,
    color: '#506690',
    flexShrink: 1,
  },
  saveQrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1c3a70',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveQrButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
}); 