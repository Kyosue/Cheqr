import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, TextInput, ActivityIndicator, Image, ImageBackground, FlatList, Dimensions, Animated, PanResponder, StatusBar, Platform, Keyboard, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { User, getUsers, createCourse, Course, getCourses, deleteCourse, updateCourse } from '../lib/api';
import { LinearGradient } from 'expo-linear-gradient';

SplashScreen.preventAutoHideAsync();

interface ScheduleEntry {
  days: string[];
  startTime: string;
  endTime: string;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAG_THRESHOLD = 50;
const ITEMS_PER_PAGE = 20;

export default function ManageCourses() {
  const [fontsLoaded, fontError] = useFonts({
    'THEDISPLAYFONT': require('../assets/fonts/THEDISPLAYFONT-DEMOVERSION.ttf'),
  });

  React.useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lecturers, setLecturers] = useState<User[]>([]);
  const [formData, setFormData] = useState({
    courseCode: '',
    courseName: '',
    description: '',
    lecturerId: '',
    schedules: [] as ScheduleEntry[],
  });
  const [showLecturerModal, setShowLecturerModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [newSchedule, setNewSchedule] = useState<ScheduleEntry>({
    days: [],
    startTime: '',
    endTime: '',
  });
  const [courses, setCourses] = useState<Course[]>([]);
  const [newCourseId, setNewCourseId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [drawerHeight] = useState(new Animated.Value(0));
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreCourses, setHasMoreCourses] = useState(true);

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return Math.abs(gestureState.dy) > 5;
    },
    onPanResponderMove: (_, gestureState) => {
      if (gestureState.dy > 0) { // Only allow dragging down
        drawerHeight.setValue(gestureState.dy);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dy > 100) {
        closeDrawer();
      } else {
        Animated.spring(drawerHeight, {
          toValue: 0,
          useNativeDriver: false,
        }).start();
      }
    },
  });

  useEffect(() => {
    fetchLecturers();
    fetchCourses();
  }, []);

  const fetchLecturers = async () => {
    try {
      setIsLoading(true);
      const users = await getUsers();
      const lecturerUsers = users.filter(user => 
        user.role === 'lecturer' || 
        (Array.isArray(user.roles) && user.roles.includes('lecturer'))
      );
      setLecturers(lecturerUsers);
    } catch (error) {
      console.error('Error fetching lecturers:', error);
      setError('Failed to fetch lecturers. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCourses = async (pageNumber = 1, shouldAppend = false) => {
    try {
      if (pageNumber === 1) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }

      const coursesData = await getCourses();
      
      if (shouldAppend) {
        // Filter out any potential duplicates before appending
        setCourses(prevCourses => {
          const existingIds = new Set(prevCourses.map(course => course._id));
          const newCourses = coursesData.filter((course: Course) => !existingIds.has(course._id));
          return [...prevCourses, ...newCourses];
        });
      } else {
        // For fresh loads, just set the data directly
        setCourses(coursesData);
      }

      // Check if we have more courses to load
      setHasMoreCourses(coursesData.length === ITEMS_PER_PAGE);
    } catch (error) {
      console.error('Error fetching courses:', error);
      setError('Failed to fetch courses. Please try again.');
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  const openDrawer = () => {
    setIsDrawerOpen(true);
    Animated.spring(drawerHeight, {
      toValue: SCREEN_HEIGHT * 0.9,
      useNativeDriver: false,
    }).start();
  };

  const closeDrawer = () => {
    Animated.timing(drawerHeight, {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      setIsDrawerOpen(false);
      setFormData({
        courseCode: '',
        courseName: '',
        description: '',
        lecturerId: '',
        schedules: [],
      });
      setSelectedCourse(null);
    });
  };

  const handleAddCourse = () => {
    setError(null);
    setFormData({
      courseCode: '',
      courseName: '',
      description: '',
      lecturerId: '',
      schedules: [],
    });
    openDrawer();
  };

  const handleEditCourse = (course: Course) => {
    setSelectedCourse(course);
    setFormData({
      courseCode: course.courseCode,
      courseName: course.courseName,
      description: course.description,
      lecturerId: course.lecturerId?._id || '',
      schedules: course.schedules,
    });
    openDrawer();
  };

  const handleDeletePress = (course: Course) => {
    setCourseToDelete(course);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!courseToDelete) return;

    try {
      setIsDeleting(true);
      await deleteCourse(courseToDelete._id);
      setSuccessMessage('Course deleted successfully!');
      await fetchCourses();
    } catch (error) {
      console.error('Error deleting course:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete course');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setCourseToDelete(null);
    }
  };

  const handleSubmit = async () => {
    if (selectedCourse) {
      setShowEditConfirm(true);
    } else {
      await saveCourse();
    }
  };

  const handleConfirmEdit = async () => {
    setShowEditConfirm(false);
    await saveCourse();
  };

  const saveCourse = async () => {
    try {
      setIsSaving(true);
      setError(null);

      // Validate required fields
      if (!formData.courseCode || !formData.courseName || !formData.lecturerId || formData.schedules.length === 0) {
        setError('Course code, name, lecturer, and at least one schedule are required');
        return;
      }

      let updatedCourse;
      if (selectedCourse) {
        // Update existing course - create a properly formatted update object to fix the type error
        const selectedLecturer = lecturers.find(l => l._id === formData.lecturerId);
        const courseUpdateData = {
          courseCode: formData.courseCode,
          courseName: formData.courseName,
          description: formData.description,
          schedules: formData.schedules,
          // Only include lecturerId if we found the matching lecturer
          ...(selectedLecturer ? { 
            lecturerId: { 
              _id: selectedLecturer._id,
              firstName: selectedLecturer.firstName,
              lastName: selectedLecturer.lastName
            }
          } : {})
        };
        updatedCourse = await updateCourse(selectedCourse._id, courseUpdateData);
        setSuccessMessage('Course updated successfully!');
      } else {
        // Create new course
        updatedCourse = await createCourse(formData);
        setSuccessMessage('Course added successfully!');
      }

      // Refresh the course list
      await fetchCourses();

      // Set new course ID for highlighting
      setNewCourseId(updatedCourse._id);

      // Reset form and close modal
      setShowModal(false);
      setSelectedCourse(null);
      setFormData({
        courseCode: '',
        courseName: '',
        description: '',
        lecturerId: '',
        schedules: [],
      });

      // Scroll to the course after a short delay
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error saving course:', error);
      setError(error instanceof Error ? error.message : 'Failed to save course');
    } finally {
      setIsSaving(false);
    }
  };

  const formatTimeInput = (text: string) => {
    // Remove any non-numeric characters
    const numbers = text.replace(/[^0-9]/g, '');
    
    // Format as HH:MM
    if (numbers.length <= 2) {
      return numbers;
    } else if (numbers.length <= 4) {
      return `${numbers.slice(0, 2)}:${numbers.slice(2)}`;
    }
    return `${numbers.slice(0, 2)}:${numbers.slice(2, 4)}`;
  };

  const validateTime = (time: string) => {
    if (!time) return false;
    
    const [hours, minutes] = time.split(':').map(Number);
    
    if (isNaN(hours) || isNaN(minutes)) return false;
    if (hours < 0 || hours > 23) return false;
    if (minutes < 0 || minutes > 59) return false;
    
    return true;
  };

  const handleAddSchedule = () => {
    if (newSchedule.days.length === 0) {
      setError('Please select at least one day');
      return;
    }

    if (!validateTime(newSchedule.startTime) || !validateTime(newSchedule.endTime)) {
      setError('Please enter valid start and end times');
      return;
    }

    // Validate that end time is after start time
    const [startHours, startMinutes] = newSchedule.startTime.split(':').map(Number);
    const [endHours, endMinutes] = newSchedule.endTime.split(':').map(Number);
    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;

    if (endTotalMinutes <= startTotalMinutes) {
      setError('End time must be after start time');
      return;
    }

    setFormData({
      ...formData,
      schedules: [...formData.schedules, newSchedule],
    });
    setNewSchedule({
      days: [],
      startTime: '',
      endTime: '',
    });
    setShowScheduleModal(false);
    setError(null);
  };

  const handleRemoveSchedule = (index: number) => {
    const updatedSchedules = [...formData.schedules];
    updatedSchedules.splice(index, 1);
    setFormData({
      ...formData,
      schedules: updatedSchedules,
    });
  };

  const handleAssignStudents = (course: Course) => {
    // Store the current page before navigation
    const currentPage = page;
    
    // Navigate to assign students
    router.push(`/assign-students?courseId=${course._id}`);
    
    // When returning, we'll refresh the list through the focus effect
  };

  // Clear success message after 3 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // Clear highlight after 2 seconds
  useEffect(() => {
    if (newCourseId) {
      const timer = setTimeout(() => {
        setNewCourseId(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [newCourseId]);

  const generateUniqueKey = (prefix: string, id: string, index?: number) => {
    return `${prefix}-${id}${index !== undefined ? `-${index}` : ''}`;
  };

  const renderCourseCard = ({ item: course, index }: { item: Course; index: number }) => (
    <View 
      key={generateUniqueKey('course', course._id, index)}
      style={[
        styles.courseCard,
        newCourseId === course._id && styles.highlightedCard
      ]}
    >
      <View style={styles.courseImageContainer}>
        <Image
          source={require('../assets/images/c_image.jpg')}
          style={styles.courseImage}
        />
        <View style={styles.courseOverlay}>
          <View style={styles.courseActions}>
            <TouchableOpacity 
              key={generateUniqueKey('edit', course._id)}
              style={[styles.courseActionButton, { backgroundColor: 'rgba(0, 0, 0, 0.6)' }]}
              onPress={() => handleEditCourse(course)}
            >
              <MaterialIcons name="edit" size={22} color="#FFD700" />
            </TouchableOpacity>
            <TouchableOpacity 
              key={generateUniqueKey('assign', course._id)}
              style={[styles.courseActionButton, { backgroundColor: 'rgba(0, 0, 0, 0.6)' }]}
              onPress={() => handleAssignStudents(course)}
            >
              <MaterialIcons name="groups" size={22} color="#FFD700" />
            </TouchableOpacity>
            <TouchableOpacity 
              key={generateUniqueKey('delete', course._id)}
              style={[styles.courseActionButton, { backgroundColor: 'rgba(0, 0, 0, 0.6)' }]}
              onPress={() => handleDeletePress(course)}
              disabled={isDeleting}
            >
              <MaterialIcons name="delete" size={22} color="#FFD700" />
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
          <View style={styles.instructorBadge}>
            <MaterialIcons name="person" size={16} color="#666" />
            <Text style={styles.instructorText}>
              {course.lecturerId ? `${course.lecturerId.firstName} ${course.lecturerId.lastName}` : 'Not assigned'}
            </Text>
          </View>
        </View>
        
        <View style={styles.schedulesContainer}>
          {course.schedules.map((schedule, scheduleIndex) => (
            <View 
              key={generateUniqueKey('schedule', course._id, scheduleIndex)} 
              style={styles.scheduleCard}
            >
              <View style={styles.scheduleHeader}>
                <MaterialIcons name="event" size={16} color="#1c3a70" />
                <Text style={styles.scheduleDays}>{schedule.days.join(', ')}</Text>
              </View>
              <View style={styles.scheduleTime}>
                <MaterialIcons name="access-time" size={16} color="#1c3a70" />
                <Text style={styles.timeText}>{schedule.startTime} - {schedule.endTime}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  const renderListHeader = () => (
    <>
      <TouchableOpacity style={styles.addButton} onPress={handleAddCourse}>
        <MaterialIcons name="add-circle" size={24} color="#fff" />
        <Text style={styles.addButtonText}>Add Course</Text>
      </TouchableOpacity>

      {successMessage && (
        <View style={styles.successContainer}>
          <MaterialIcons name="check-circle" size={20} color="#4caf50" />
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      )}
    </>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name="menu-book" size={48} color="#ccc" />
      <Text style={styles.emptyStateText}>No courses found</Text>
    </View>
  );

  const renderDrawer = () => (
    <Animated.View
      style={[
        styles.drawer,
        {
          height: drawerHeight,
        },
      ]}
    >
      <View style={styles.drawerHeader} {...panResponder.panHandlers}>
        <View style={styles.drawerHandle} />
        <Text style={styles.drawerTitle}>
          {selectedCourse ? 'Edit Course' : 'Add New Course'}
        </Text>
        <TouchableOpacity onPress={closeDrawer} style={styles.closeButton}>
          <MaterialIcons name="close" size={24} color="#002147" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.drawerContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.formSection}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="book" size={24} color="#1a73e8" />
            <Text style={styles.sectionTitle}>Course Information</Text>
          </View>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Course Code</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="code" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={formData.courseCode}
                onChangeText={(text) => setFormData({ ...formData, courseCode: text })}
                placeholder="Enter course code"
                placeholderTextColor="#999"
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Course Name</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="school" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={formData.courseName}
                onChangeText={(text) => setFormData({ ...formData, courseName: text })}
                placeholder="Enter course name"
                placeholderTextColor="#999"
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Description</Text>
            <View style={styles.inputWrapper}>
              <MaterialIcons name="description" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Enter course description"
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
              />
            </View>
          </View>
        </View>

        <View style={styles.formSection}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="person" size={24} color="#1a73e8" />
            <Text style={styles.sectionTitle}>Lecturer</Text>
          </View>
          <TouchableOpacity
            style={styles.selectContainer}
            onPress={() => setShowLecturerModal(true)}
          >
            <View style={styles.selectContent}>
              <MaterialIcons name="person" size={20} color="#666" style={styles.inputIcon} />
              <Text style={styles.selectText}>
                {formData.lecturerId
                  ? lecturers.find(l => l._id === formData.lecturerId)?.firstName + ' ' + lecturers.find(l => l._id === formData.lecturerId)?.lastName
                  : 'Select lecturer'}
              </Text>
              <MaterialIcons name="chevron-right" size={20} color="#666" />
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.formSection}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="calendar-today" size={24} color="#1a73e8" />
            <Text style={styles.sectionTitle}>Schedule</Text>
          </View>
          <View style={styles.scheduleContainer}>
            {formData.schedules.map((schedule, index) => (
              <View 
                key={generateUniqueKey('form-schedule', `schedule-${index}`, index)} 
                style={styles.scheduleItem}
              >
                <View style={styles.scheduleInfo}>
                  <MaterialIcons name="event" size={16} color="#1c3a70" />
                  <Text style={styles.scheduleText}>
                    {schedule.days.join(', ')} {schedule.startTime}-{schedule.endTime}
                  </Text>
                </View>
                <TouchableOpacity
                  style={{ padding: 8 }}
                  onPress={() => handleRemoveSchedule(index)}
                >
                  <MaterialIcons name="cancel" size={20} color="#ff4444" />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity
              style={styles.addScheduleButton}
              onPress={() => setShowScheduleModal(true)}
            >
              <MaterialIcons name="add-circle-outline" size={20} color="#fff" style={styles.buttonIcon} />
              <Text style={styles.addScheduleButtonText}>Add Schedule</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.drawerButtons}>
          <TouchableOpacity
            style={[styles.drawerButton, styles.cancelButton]}
            onPress={closeDrawer}
          >
            <MaterialIcons name="close" size={20} color="#666" style={styles.buttonIcon} />
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.drawerButton, styles.saveButton]}
            onPress={handleSubmit}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialIcons name="check" size={20} color="#fff" style={styles.buttonIcon} />
                <Text style={styles.saveButtonText}>Save</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </Animated.View>
  );

  // Add Lecturer Selection Modal
  const renderLecturerModal = () => (
    <Modal
      visible={showLecturerModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowLecturerModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Lecturer</Text>
            <TouchableOpacity onPress={() => setShowLecturerModal(false)}>
              <MaterialIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalList}>
            {lecturers.map((lecturer) => (
              <TouchableOpacity
                key={generateUniqueKey('lecturer', lecturer._id)}
                style={[
                  styles.modalItem,
                  formData.lecturerId === lecturer._id && styles.selectedItem
                ]}
                onPress={() => {
                  setFormData({ ...formData, lecturerId: lecturer._id });
                  setShowLecturerModal(false);
                }}
              >
                <View style={styles.lecturerInfo}>
                  <MaterialIcons name="person" size={24} color="#1c3a70" />
                  <View style={styles.lecturerDetails}>
                    <Text style={styles.lecturerName}>
                      {lecturer.firstName} {lecturer.lastName}
                    </Text>
                    <Text style={styles.lecturerEmail}>{lecturer.email}</Text>
                  </View>
                </View>
                {formData.lecturerId === lecturer._id && (
                  <MaterialIcons name="check-circle" size={24} color="#1c3a70" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  // Add Schedule Modal
  const renderScheduleModal = () => (
    <Modal
      visible={showScheduleModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowScheduleModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Schedule</Text>
            <TouchableOpacity onPress={() => setShowScheduleModal(false)}>
              <MaterialIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <View style={styles.scheduleForm}>
            <Text style={styles.inputLabel}>Days</Text>
            <View style={styles.daysContainer}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <TouchableOpacity
                  key={generateUniqueKey('day', day)}
                  style={[
                    styles.dayButton,
                    newSchedule.days.includes(day) && styles.selectedDay
                  ]}
                  onPress={() => {
                    const updatedDays = newSchedule.days.includes(day)
                      ? newSchedule.days.filter(d => d !== day)
                      : [...newSchedule.days, day];
                    setNewSchedule({ ...newSchedule, days: updatedDays });
                  }}
                >
                  <Text
                    style={[
                      styles.dayButtonText,
                      newSchedule.days.includes(day) && styles.selectedDayText
                    ]}
                  >
                    {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.timeContainer}>
              <View style={styles.timeInput}>
                <Text style={styles.inputLabel}>Start Time</Text>
                <View style={styles.inputWrapper}>
                  <MaterialIcons name="access-time" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={newSchedule.startTime}
                    onChangeText={(text) => {
                      const formattedTime = formatTimeInput(text);
                      setNewSchedule({ ...newSchedule, startTime: formattedTime });
                    }}
                    placeholder="HH:MM"
                    placeholderTextColor="#999"
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                </View>
                {newSchedule.startTime && !validateTime(newSchedule.startTime) && (
                  <Text style={styles.ScheduleErrorText}>Invalid time format</Text>
                )}
              </View>
              <View style={styles.timeInput}>
                <Text style={styles.inputLabel}>End Time</Text>
                <View style={styles.inputWrapper}>
                  <MaterialIcons name="access-time" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={newSchedule.endTime}
                    onChangeText={(text) => {
                      const formattedTime = formatTimeInput(text);
                      setNewSchedule({ ...newSchedule, endTime: formattedTime });
                    }}
                    placeholder="HH:MM"
                    placeholderTextColor="#999"
                    keyboardType="number-pad"
                    maxLength={5}
                  />
                </View>
                {newSchedule.endTime && !validateTime(newSchedule.endTime) && (
                  <Text style={styles.ScheduleErrorText}>Invalid time format</Text>
                )}
              </View>
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowScheduleModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.saveButton,
                  (!validateTime(newSchedule.startTime) || !validateTime(newSchedule.endTime)) && styles.disabledButton
                ]}
                onPress={handleAddSchedule}
                disabled={!validateTime(newSchedule.startTime) || !validateTime(newSchedule.endTime)}
              >
                <Text style={styles.saveButtonText}>Add Schedule</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );

  // Add this function to handle refresh
  const handleRefresh = async () => {
    setPage(1);
    setHasMoreCourses(true);
    await fetchCourses(1, false);
  };

  // Add this function to handle load more
  const handleLoadMore = async () => {
    if (!isLoadingMore && hasMoreCourses) {
      const nextPage = page + 1;
      setPage(nextPage);
      await fetchCourses(nextPage, true);
    }
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
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
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
          <Text style={styles.welcomeText}>Manage Courses</Text>
          <Text style={styles.subtitleText}>Create, edit and organize academic courses</Text>
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#1c3a70" style={styles.loader} />
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <FlatList
            data={courses}
            renderItem={renderCourseCard}
            keyExtractor={(item, index) => generateUniqueKey('course', item._id, index)}
            contentContainerStyle={styles.courseList}
            ListHeaderComponent={renderListHeader}
            ListEmptyComponent={renderEmptyList}
            showsVerticalScrollIndicator={false}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={true}
            getItemLayout={(data, index) => ({
              length: 220,
              offset: 220 * index,
              index,
            })}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            refreshing={isLoading && page === 1}
            onRefresh={handleRefresh}
            ListFooterComponent={() => (
              isLoadingMore ? (
                <View style={styles.loadingMoreContainer}>
                  <ActivityIndicator size="small" color="#1c3a70" />
                  <Text style={styles.loadingMoreText}>Loading more courses...</Text>
                </View>
              ) : null
            )}
          />
        )}
      </View>

      {isDrawerOpen && (
        <View style={styles.drawerOverlay}>
          <TouchableOpacity
            style={styles.drawerBackdrop}
            activeOpacity={1}
            onPress={closeDrawer}
          />
          {renderDrawer()}
        </View>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.confirmModal]}>
            <View style={styles.confirmHeader}>
              <MaterialIcons name="warning" size={48} color="#dc3545" />
              <Text style={styles.confirmTitle}>Delete Course</Text>
            </View>
            
            <Text style={styles.confirmText}>
              Are you sure you want to delete{'\n'}
              <Text style={styles.confirmHighlight}>
                {courseToDelete?.courseName} ({courseToDelete?.courseCode})
              </Text>?
              {'\n'}This action cannot be undone.
            </Text>

            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelConfirmButton]}
                onPress={() => {
                  setShowDeleteConfirm(false);
                  setCourseToDelete(null);
                }}
                disabled={isDeleting}
              >
                <Text style={styles.cancelConfirmText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.deleteConfirmButton]}
                onPress={handleConfirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.deleteConfirmText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Confirmation Modal */}
      <Modal
        visible={showEditConfirm}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowEditConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.confirmModal]}>
            <View style={styles.confirmHeader}>
              <MaterialIcons name="warning" size={48} color="#1a73e8" />
              <Text style={styles.confirmTitle}>Confirm Edit</Text>
            </View>
            
            <Text style={styles.confirmText}>
              Are you sure you want to update{'\n'}
              <Text style={styles.confirmHighlight}>
                {selectedCourse?.courseName} ({selectedCourse?.courseCode})
              </Text>?
            </Text>

            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={[styles.confirmButton, styles.cancelConfirmButton]}
                onPress={() => {
                  setShowEditConfirm(false);
                }}
                disabled={isSaving}
              >
                <Text style={styles.cancelConfirmText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, styles.saveConfirmButton]}
                onPress={handleConfirmEdit}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveConfirmText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {renderLecturerModal()}
      {renderScheduleModal()}
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
    padding: 20,
  },
  courseList: {
    paddingBottom: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1c3a70',
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    elevation: 4,
    shadowColor: '#1c3a70',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
    marginLeft: 10,
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
    padding: 24,
    width: '90%',
    maxWidth: 400,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1c3a70',
    flex: 1,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 15,
    color: '#666',
    marginBottom: 10,
    fontWeight: '500',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e9ecef',
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  cancelButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e7eaf0',
  },
  saveButton: {
    backgroundColor: '#1c3a70',
    elevation: 4,
    shadowColor: '#1c3a70',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  errorText: {
    color: '#c62828',
    fontSize: 15,
    fontWeight: '500',
  },
  selectContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e7eaf0',
    marginBottom: 20,
  },
  selectContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  selectText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  scheduleContainer: {
    gap: 10,
  },
  scheduleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e7eaf0',
  },
  scheduleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scheduleText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
  },
  addScheduleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1c3a70',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  addScheduleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  modalList: {
    maxHeight: 400,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectedItem: {
    backgroundColor: '#f0f7ff',
  },
  lecturerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  lecturerDetails: {
    flex: 1,
  },
  lecturerName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  lecturerEmail: {
    fontSize: 14,
    color: '#666',
  },
  scheduleForm: {
    padding: 20,
  },
  timeContainer: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
  },
  timeInput: {
    flex: 1,
  },
  daysContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  dayButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e7eaf0',
  },
  selectedDay: {
    backgroundColor: '#1c3a70',
    borderColor: '#1c3a70',
  },
  dayButtonText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  selectedDayText: {
    color: '#fff',
  },
  drawerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(23, 43, 77, 0.7)',
  },
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  drawer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e7eaf0',
  },
  drawerHandle: {
    position: 'absolute',
    top: 10,
    width: 48,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
  },
  drawerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1c3a70',
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    padding: 4,
  },
  drawerContent: {
    padding: 24,
  },
  drawerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    paddingBottom: 24,
  },
  drawerButton: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginHorizontal: 6,
  },
  buttonIcon: {
    marginRight: 8,
  },
  confirmModal: {
    padding: 20,
  },
  confirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1c3a70',
  },
  confirmText: {
    color: '#333',
    fontSize: 16,
    marginBottom: 16,
  },
  confirmHighlight: {
    fontWeight: 'bold',
  },
  confirmButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  confirmButton: {
    flex: 1,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  deleteConfirmButton: {
    backgroundColor: '#dc3545',
  },
  deleteConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveConfirmButton: {
    backgroundColor: '#1c3a70',
  },
  saveConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  formSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#1c3a70',
    marginLeft: 10,
  },
  disabledButton: {
    opacity: 0.5,
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
    height: 100,
    position: 'relative',
  },
  courseImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  courseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
    padding: 10,
  },
  courseActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  courseActionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  courseContent: {
    padding: 16,
  },
  courseHeader: {
    marginBottom: 10,
  },
  courseTitleContainer: {
    marginBottom: 6,
  },
  courseCode: {
    fontSize: 13,
    color: '#1c3a70',
    marginBottom: 4,
    fontWeight: '600',
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
    backgroundColor: 'rgba(28, 58, 112, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(28, 58, 112, 0.2)',
  },
  instructorText: {
    fontSize: 12,
    color: '#1c3a70',
    marginLeft: 4,
    fontWeight: '500',
  },
  schedulesContainer: {
    gap: 6,
  },
  scheduleCard: {
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e7eaf0',
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  scheduleDays: {
    fontSize: 13,
    color: '#1c3a70',
    marginLeft: 6,
    fontWeight: '600',
  },
  scheduleTime: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 13,
    color: '#1c3a70',
    marginLeft: 6,
    fontWeight: '500',
  },
  highlightedCard: {
    borderWidth: 2,
    borderColor: '#1c3a70',
    transform: [{ scale: 1.02 }],
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e9',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  successText: {
    color: '#2e7d32',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  loadingMoreText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '500',
  },
  cancelConfirmButton: {
    backgroundColor: '#f8f9fa',
  },
  cancelConfirmText: {
    color: '#506690',
    fontSize: 16,
    fontWeight: '600',
  },
  ScheduleErrorText: {
    color: '#dc3545',
    fontSize: 12,
    marginTop: 4,
  },
}); 