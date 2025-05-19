import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, FlatList, Modal, Platform, Alert, Image, StatusBar, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Course, User, getCourses, getUsers } from '../lib/api';
import { API_CONFIG } from '../config';
import { LinearGradient } from 'expo-linear-gradient';

SplashScreen.preventAutoHideAsync();

// Constants
const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH = Dimensions.get('window').width;

export default function AttendanceReports() {
  const [fontsLoaded, fontError] = useFonts({
    'THEDISPLAYFONT': require('../assets/fonts/THEDISPLAYFONT-DEMOVERSION.ttf'),
  });

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showCourseModal, setShowCourseModal] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setIsLoading(true);
      const data = await getCourses();
      setCourses(data);
    } catch (error) {
      console.error('Error fetching courses:', error);
      setError('Failed to fetch courses');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectCourse = async (course: Course) => {
    try {
      // First set the selected course with what we have
      setSelectedCourse(course);
      
      // Then try to fetch more detailed information in the background
      // Only attempt if we have connectivity and the API seems available
      const response = await fetch(`${API_CONFIG.baseURL}/courses/${course._id}/details`, {
        method: 'GET',
        headers: API_CONFIG.headers,
      }).catch(error => {
        // Silently fail - we'll use the basic course info we already have
        console.log('Could not fetch detailed course info:', error);
        return null;
      });
      
      if (response && response.ok) {
        const detailedCourse = await response.json();
        if (detailedCourse && detailedCourse._id) {
          // Update with more detailed info if available
          setSelectedCourse(detailedCourse);
        }
      }
    } catch (error) {
      // If there's an error fetching detailed info, continue with basic info
      console.log('Error fetching detailed course info:', error);
    } finally {
      // Always close the modal
      setShowCourseModal(false);
    }
  };

  const handleOpenCourseModal = () => {
    setShowCourseModal(true);
  };

  const fetchAttendanceData = async (courseId: string) => {
    try {
      // Fetch students enrolled in the course
      const response = await fetch(`${API_CONFIG.baseURL}/courses/${courseId}/students`);
      if (!response.ok) {
        throw new Error(`Failed to fetch students: ${response.status}`);
      }
      
      let students: User[] = [];
      try {
        students = await response.json();
        // Validate the response has the expected structure
        if (!Array.isArray(students)) {
          console.warn('Students data is not an array, using empty array instead');
          students = [];
        }
      } catch (error) {
        console.error('Error parsing students response:', error);
        students = [];
      }
      
      // Sort students alphabetically by last name
      const sortedStudents = students.sort((a, b) => {
        const nameA = `${a.lastName || ''}, ${a.firstName || ''}`.toLowerCase();
        const nameB = `${b.lastName || ''}, ${b.firstName || ''}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });
      
      // Fetch attendance records for the course
      const attendanceResponse = await fetch(`${API_CONFIG.baseURL}/attendance/course/${courseId}`);
      if (!attendanceResponse.ok) {
        throw new Error(`Failed to fetch attendance records: ${attendanceResponse.status}`);
      }
      
      let attendanceRecords = [];
      try {
        attendanceRecords = await attendanceResponse.json();
        // Validate the response has the expected structure
        if (!Array.isArray(attendanceRecords)) {
          console.warn('Attendance data is not an array, using empty array instead');
          attendanceRecords = [];
        }
      } catch (error) {
        console.error('Error parsing attendance response:', error);
        attendanceRecords = [];
      }
      
      // Sort attendance dates chronologically
      const sortedAttendance = attendanceRecords.sort((a: any, b: any) => {
        try {
          return new Date(a.generatedAt).getTime() - new Date(b.generatedAt).getTime();
        } catch (error) {
          console.error('Error sorting attendance records:', error);
          return 0;
        }
      });
      
      return {
        students: sortedStudents,
        attendance: sortedAttendance
      };
    } catch (error) {
      console.error('Error fetching attendance data:', error);
      // Return empty arrays instead of throwing to allow partial reports
      return {
        students: [],
        attendance: []
      };
    }
  };

  const generateCSV = (courseName: string, students: User[], attendanceRecords: any[]) => {
    // Get course details - we'll use the selectedCourse from the component state
    if (!selectedCourse) return '';

    // Get lecturer info with fallback
    const lecturerName = selectedCourse.lecturerId ? 
      `${selectedCourse.lecturerId.firstName || ''} ${selectedCourse.lecturerId.lastName || ''}`.trim() : 
      'Not Assigned';
    
    // Get schedule details with fallback
    const scheduleInfo = selectedCourse.schedules && selectedCourse.schedules.length > 0 ? 
      selectedCourse.schedules.map(schedule => {
        const days = Array.isArray(schedule.days) ? schedule.days.join('/') : 'N/A';
        const startTime = schedule.startTime || 'N/A';
        const endTime = schedule.endTime || 'N/A';
        return `${days} ${startTime}-${endTime}`;
      }).join(', ') : 
      'No schedule information';

    // Course code with fallback
    const courseCode = selectedCourse.courseCode || 'N/A';
    
    // Start with report title and metadata section
    let csv = '';
    
    // Add university name and logo placeholder (Excel will recognize this as a header row)
    csv += `"*UNIVERSITY ATTENDANCE SYSTEM*","","","","","",""\n`;
    csv += `"*CHEQR ATTENDANCE REPORT*","","","","","",""\n\n`;
    
    // Create a metadata box with clean formatting
    csv += `"*COURSE INFORMATION*","","","","","",""\n`;
    csv += `"Course Code:","${courseCode}","","Course Name:","${courseName}","",""\n`;
    csv += `"Lecturer:","${lecturerName}","","Schedule:","${scheduleInfo}","",""\n`;
    csv += `"Description:","${selectedCourse.description || 'No description'}","","","","",""\n`;
    csv += `"Total Students:","${students.length}","","Total Sessions:","${attendanceRecords.length}","",""\n`;
    csv += `"Report Generated:","${new Date().toLocaleString()}","","","","",""\n\n\n`;
    
    // Format dates for better display
    const formattedDates = attendanceRecords.map(record => {
      // Direct string parsing to avoid any timezone conversion
      const rawDateTime = record.generatedAt; // Should be ISO format: "2023-04-15T06:48:23.456Z"
      let dateTimeStr = '';
      
      try {
        // Parse the ISO string directly to extract components
        const isoRegex = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/;
        const match = isoRegex.exec(rawDateTime);
        
        if (match) {
          const [_, year, monthNum, day, hours24, minutes] = match;
          
          // Convert month number to name
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const month = monthNames[parseInt(monthNum) - 1]; // Month is 1-indexed in ISO
          
          // Convert to 12-hour format
          const hours12 = parseInt(hours24) % 12 || 12;
          const ampm = parseInt(hours24) >= 12 ? 'PM' : 'AM';
          
          // Build the formatted string with original hours (not UTC converted)
          dateTimeStr = `${month} ${parseInt(day)}, ${year}\n${hours12}:${minutes} ${ampm}`;
        } else {
          // Fallback if regex doesn't match
          dateTimeStr = rawDateTime;
        }
      } catch (error) {
        console.error('Error parsing date string:', error);
        dateTimeStr = rawDateTime || 'Unknown Date';
      }
      
      return dateTimeStr;
    });
    
    // Add section header for attendance records
    csv += `"*ATTENDANCE RECORDS*","","","","","",""\n\n`;
    
    // Create header row with ID number, student name, and dates
    csv += `"*ID Number*","*Student Name*",${formattedDates.map(date => `"*${date}*"`).join(',')}\n`;
    
    // Add separator row for visual clarity (dash characters)
    csv += `"----------","--------------------",${Array(formattedDates.length).fill('"--------"').join(',')}\n`;
    
    // Calculate attendance statistics
    const attendanceStats = new Map();
    students.forEach(student => {
      attendanceStats.set(student._id, 0);
    });
    
    // Add rows for each student
    students.forEach(student => {
      // Add ID number and full name with quotes
      const idNumber = `"${student.idNumber || ''}"`;
      const fullName = `"${student.lastName || ''}, ${student.firstName || ''}"`.trim();
      
      // For each date, check if student was present
      const attendanceStatus = attendanceRecords.map(record => {
        const isPresent = record.scannedBy && Array.isArray(record.scannedBy) && 
          record.scannedBy.some((scan: any) => {
            // Handle different possible data structures
            if (typeof scan === 'object' && scan !== null) {
              if (scan.studentId) {
                // Handle cases where studentId is an object or string
                const scanStudentId = typeof scan.studentId === 'object' ? 
                  scan.studentId._id : scan.studentId;
                
                return scanStudentId === student._id;
              }
            }
            return false;
          });
        
        // Count present sessions for statistics
        if (isPresent) {
          attendanceStats.set(student._id, attendanceStats.get(student._id) + 1);
        }
        
        // Use colored indicators (when viewed in Excel/Sheets)
        return isPresent ? 
          `"✓ Present"` : 
          `"✗ Absent"`;
      });
      
      csv += `${idNumber},${fullName},${attendanceStatus.join(',')}\n`;
    });

    // Add attendance summary section with spacing for visual separation
    csv += `\n\n"*ATTENDANCE SUMMARY*","","","","","",""\n\n`;
    csv += `"*Student Name*","*Sessions Present*","*Attendance Rate*","*Status*","","",""\n`;
    csv += `"--------------------","----------------","---------------","--------","","",""\n`;
    
    students.forEach(student => {
      const sessionsPresent = attendanceStats.get(student._id) || 0;
      const attendanceRate = attendanceRecords.length > 0 ? 
        Math.round((sessionsPresent / attendanceRecords.length) * 100) : 0;
      
      // Add status indicator based on attendance rate
      let status = '';
      if (attendanceRate >= 90) {
        status = 'Excellent';
      } else if (attendanceRate >= 75) {
        status = 'Good';
      } else if (attendanceRate >= 50) {
        status = 'Average';
      } else {
        status = 'Poor';
      }
      
      const studentName = `"${student.lastName || ''}, ${student.firstName || ''}"`.trim();
      csv += `${studentName},"${sessionsPresent}/${attendanceRecords.length}","${attendanceRate}%","${status}","","",""\n`;
    });
    
    // Add footnote
    csv += `\n"Report generated by CHEQR Attendance System","","","","","",""\n`;
    
    return csv;
  };

  const handleGenerateReport = async () => {
    if (!selectedCourse) {
      Alert.alert('Error', 'Please select a course first');
      return;
    }
    
    try {
      setIsGenerating(true);
      
      // We will work with the selected course directly since we already have its information
      const data = await fetchAttendanceData(selectedCourse._id);
      
      // Check if we have both students and attendance data
      if (!data.students.length) {
        Alert.alert('No Data', 'No students found enrolled in this course');
        setIsGenerating(false);
        return;
      }
      
      if (!data.attendance.length) {
        Alert.alert('No Data', 'No attendance records found for this course');
        setIsGenerating(false);
        return;
      }
      
      const csv = generateCSV(selectedCourse.courseName, data.students, data.attendance);
      
      if (!csv || csv.trim() === '') {
        Alert.alert('Error', 'Failed to generate the report content');
        setIsGenerating(false);
        return;
      }
      
      try {
        // Generate a filename with course code and date
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${selectedCourse.courseCode || 'Course'}_Attendance_${timestamp}.csv`;
        
        // Save the CSV file
        const filePath = `${FileSystem.documentDirectory}${filename}`;
        await FileSystem.writeAsStringAsync(filePath, csv);
        
        // Share the file
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(filePath);
        } else {
          Alert.alert(
            'Sharing not available',
            'Sharing is not available on your device'
          );
        }
      } catch (fileError) {
        console.error('Error saving or sharing file:', fileError);
        Alert.alert('Error', 'Could not save or share the report file');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      Alert.alert('Error', 'Failed to generate attendance report');
    } finally {
      setIsGenerating(false);
    }
  };

  React.useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

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
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <MaterialIcons name="arrow-back" size={28} color="#fff" />
              </TouchableOpacity>
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
          </View>
          <Text style={styles.welcomeText}>Attendance Reports</Text>
          <Text style={styles.subtitleText}>Generate and export attendance data</Text>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.reportCardContainer}>
            <View style={styles.reportCard}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconContainer, styles.reportIconContainer]}>
                  <MaterialIcons name="description" size={28} color="#1c3a70" />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>Attendance Report</Text>
                  <Text style={styles.cardDescription}>
                    Generate enhanced CSV attendance reports with course details and statistics
                  </Text>
                </View>
              </View>
              
              <TouchableOpacity 
                style={styles.courseSelector} 
                onPress={handleOpenCourseModal}
              >
                <View style={styles.courseInfo}>
                  <Text style={styles.courseSelectorLabel}>Course</Text>
                  <Text style={styles.courseSelectorText}>
                    {selectedCourse ? selectedCourse.courseName : 'Select a course'}
                  </Text>
                </View>
                <MaterialIcons name="keyboard-arrow-down" size={24} color="#1c3a70" />
              </TouchableOpacity>

              {selectedCourse && (
                <View style={styles.reportInfoContainer}>
                  <View style={styles.reportInfoItem}>
                    <MaterialIcons name="school" size={20} color="#1c3a70" />
                    <Text style={styles.reportInfoText}>
                      Course Code: {selectedCourse.courseCode}
                    </Text>
                  </View>
                  {selectedCourse.lecturerId && (
                    <View style={styles.reportInfoItem}>
                      <MaterialIcons name="person" size={20} color="#1c3a70" />
                      <Text style={styles.reportInfoText}>
                        Lecturer: {selectedCourse.lecturerId.firstName} {selectedCourse.lecturerId.lastName}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <TouchableOpacity 
                style={[
                  styles.generateButton, 
                  (!selectedCourse || isGenerating) && styles.generateButtonDisabled
                ]} 
                onPress={handleGenerateReport}
                disabled={!selectedCourse || isGenerating}
              >
                {isGenerating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <MaterialIcons name="file-download" size={24} color="#fff" style={styles.buttonIcon} />
                    <Text style={styles.generateButtonText}>Generate Report</Text>
                  </>
                )}
              </TouchableOpacity>

              {isGenerating && (
                <Text style={styles.generatingText}>
                  Processing attendance data...
                </Text>
              )}
            </View>

            <View style={styles.instructionsCard}>
              <View style={styles.cardHeader}>
                <View style={[styles.cardIconContainer, styles.instructionsIconContainer]}>
                  <MaterialIcons name="info" size={32} color="#4CAF50" />
                </View>
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, styles.instructionsTitle]}>Enhanced Report Features</Text>
                </View>
              </View>
              
              <View style={styles.instructionsContainer}>
                <View style={styles.instructionItem}>
                  <View style={styles.instructionIcon}>
                    <MaterialIcons name="format-list-bulleted" size={24} color="#1c3a70" />
                  </View>
                  <View style={styles.instructionContent}>
                    <Text style={styles.instructionText}>
                      Reports include complete course information and metadata
                    </Text>
                  </View>
                </View>
                <View style={styles.instructionItem}>
                  <View style={styles.instructionIcon}>
                    <MaterialIcons name="people" size={24} color="#1c3a70" />
                  </View>
                  <View style={styles.instructionContent}>
                    <Text style={styles.instructionText}>
                      Student list sorted alphabetically with attendance records
                    </Text>
                  </View>
                </View>
                <View style={styles.instructionItem}>
                  <View style={styles.instructionIcon}>
                    <MaterialIcons name="insert-chart" size={24} color="#1c3a70" />
                  </View>
                  <View style={styles.instructionContent}>
                    <Text style={styles.instructionText}>
                      Includes attendance statistics summary with attendance rates
                    </Text>
                  </View>
                </View>
                <View style={styles.instructionItem}>
                  <View style={styles.instructionIcon}>
                    <MaterialIcons name="table-chart" size={24} color="#FF9800" />
                  </View>
                  <View style={styles.instructionContent}>
                    <Text style={styles.instructionText}>
                      Formatted with proper hierarchy and styling for Excel and Google Sheets
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Course Selection Modal */}
      <Modal
        visible={showCourseModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCourseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select a Course</Text>
              <TouchableOpacity 
                style={styles.modalCloseButton}
                onPress={() => setShowCourseModal(false)}
              >
                <MaterialIcons name="close" size={24} color="#002147" />
              </TouchableOpacity>
            </View>

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#1c3a70" />
                <Text style={styles.loadingText}>Loading courses...</Text>
              </View>
            ) : courses.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="menu-book" size={48} color="#ccc" />
                <Text style={styles.emptyStateText}>No courses found</Text>
              </View>
            ) : (
              <FlatList
                data={courses}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.courseList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.courseItem}
                    onPress={() => handleSelectCourse(item)}
                  >
                    <View style={styles.courseItemContent}>
                      <View style={styles.courseIconContainer}>
                        <MaterialIcons name="menu-book" size={24} color="#1c3a70" />
                      </View>
                      <View style={styles.courseItemInfo}>
                        <Text style={styles.courseItemName}>{item.courseName}</Text>
                        <Text style={styles.courseItemCode}>{item.courseCode}</Text>
                      </View>
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color="#1c3a70" />
                  </TouchableOpacity>
                )}
              />
            )}
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
  backButton: {
    marginRight: 10,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
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
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  reportCardContainer: {
    gap: 20,
  },
  reportCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(80, 102, 144, 0.1)',
  },
  instructionsCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(80, 102, 144, 0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  cardIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  reportIconContainer: {
    backgroundColor: 'rgba(28, 58, 112, 0.1)',
  },
  instructionsIconContainer: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1c3a70',
    marginBottom: 4,
  },
  instructionsTitle: {
    color: '#4CAF50',
  },
  cardDescription: {
    fontSize: 14,
    color: '#506690',
    lineHeight: 20,
  },
  courseSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(80, 102, 144, 0.1)',
    borderRadius: 12,
    marginBottom: 24,
    backgroundColor: '#f8f9fa',
  },
  courseInfo: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  courseSelectorLabel: {
    fontSize: 12,
    color: '#506690',
    marginBottom: 4,
  },
  courseSelectorText: {
    fontSize: 16,
    color: '#1c3a70',
    fontWeight: '500',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1c3a70',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#1c3a70',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  generateButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonIcon: {
    marginRight: 8,
  },
  generatingText: {
    textAlign: 'center',
    marginTop: 16,
    color: '#506690',
    fontSize: 14,
  },
  reportInfoContainer: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(80, 102, 144, 0.1)',
    marginBottom: 24,
  },
  reportInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingLeft: 4,
  },
  reportInfoText: {
    fontSize: 14,
    color: '#506690',
    marginLeft: 8,
  },
  instructionsContainer: {
    gap: 16,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(80, 102, 144, 0.1)',
  },
  instructionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(28, 58, 112, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  instructionContent: {
    flex: 1,
  },
  instructionText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(23, 43, 77, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    width: '90%',
    maxWidth: 500,
    maxHeight: '80%',
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(80, 102, 144, 0.1)',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1c3a70',
    flex: 1,
    textAlign: 'center',
  },
  modalCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(28, 58, 112, 0.05)',
  },
  courseList: {
    padding: 16,
  },
  courseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: 'rgba(80, 102, 144, 0.1)',
  },
  courseItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  courseIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(28, 58, 112, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  courseItemInfo: {
    flex: 1,
  },
  courseItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1c3a70',
    marginBottom: 4,
  },
  courseItemCode: {
    fontSize: 14,
    color: '#506690',
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#506690',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    color: '#506690',
  },
}); 