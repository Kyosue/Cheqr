import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Animated, Dimensions, FlatList, StatusBar, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { User, Course, getUsers, updateCourse, getCourses } from '../lib/api';
import { LinearGradient } from 'expo-linear-gradient';

const ITEMS_PER_PAGE = 50;
const WINDOW_HEIGHT = Dimensions.get('window').height;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const SCREEN_WIDTH = Dimensions.get('window').width;

export default function AssignStudents() {
  const params = useLocalSearchParams();
  const courseId = params.courseId as string;

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [currentCourse, setCurrentCourse] = useState<Course | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('enrolled');
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);

  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  // Memoize filtered students to prevent unnecessary recalculations
  const filteredStudents = useMemo(() => {
    return students.filter(student => 
      (student.lastName.toLowerCase() + ', ' + student.firstName.toLowerCase())
        .includes(searchQuery.toLowerCase()) ||
      student.idNumber.toLowerCase().includes(searchQuery.toLowerCase())
    ).sort((a, b) => {
      const nameA = `${a.lastName} ${a.firstName}`.toLowerCase();
      const nameB = `${b.lastName} ${b.firstName}`.toLowerCase();
      return nameA.localeCompare(nameB);
    });
  }, [students, searchQuery]);

  // Memoize displayed students based on active tab
  const displayedStudents = useMemo(() => {
    return filteredStudents.filter(student => 
      activeTab === 'enrolled' 
        ? selectedStudents.includes(student._id)
        : !selectedStudents.includes(student._id)
    );
  }, [filteredStudents, selectedStudents, activeTab]);

  // Memoize paginated students
  const paginatedStudents = useMemo(() => {
    return displayedStudents.slice(0, page * ITEMS_PER_PAGE);
  }, [displayedStudents, page]);

  // Calculate separate counts for enrolled and available students
  const enrolledCount = useMemo(() => {
    return filteredStudents.filter(student => selectedStudents.includes(student._id)).length;
  }, [filteredStudents, selectedStudents]);
  
  const availableCount = useMemo(() => {
    return filteredStudents.filter(student => !selectedStudents.includes(student._id)).length;
  }, [filteredStudents, selectedStudents]);

  useEffect(() => {
    fetchStudents();
    fetchCourse();
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const fetchStudents = async () => {
    try {
      const users = await getUsers();
      const studentUsers = users.filter(user => user.role === 'student');
      setStudents(studentUsers);
      setHasMore(studentUsers.length > ITEMS_PER_PAGE);
    } catch (error) {
      console.error('Error fetching students:', error);
      setError('Failed to fetch students. Please try again.');
    }
  };

  const fetchCourse = async () => {
    try {
      const courses = await getCourses();
      const course = courses.find((c: Course) => c._id === courseId);
      if (course) {
        setCurrentCourse(course);
        setSelectedStudents(course.students || []);
      }
    } catch (error) {
      console.error('Error fetching course:', error);
      setError('Failed to fetch course details.');
    }
  };

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      setIsLoadingMore(true);
      setPage(prev => prev + 1);
      setHasMore(displayedStudents.length > page * ITEMS_PER_PAGE);
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, displayedStudents.length, page]);

  const handleSaveAssignments = async () => {
    if (!currentCourse) return;

    try {
      setIsLoading(true);
      await updateCourse(currentCourse._id, {
        ...currentCourse,
        students: selectedStudents
      });
      setSuccessMessage('Students assigned successfully!');
      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (error) {
      console.error('Error assigning students:', error);
      setError(error instanceof Error ? error.message : 'Failed to assign students');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStudentItem = useCallback(({ item: student }: { item: User }) => (
    <TouchableOpacity
      key={student._id}
      style={[
        styles.studentItem,
        activeTab === 'enrolled' && styles.selectedStudent
      ]}
      onPress={() => {
        if (activeTab === 'enrolled') {
          setSelectedStudents(prev => prev.filter(id => id !== student._id));
        } else {
          setSelectedStudents(prev => [...prev, student._id]);
        }
      }}
    >
      <View style={styles.studentInfo}>
        <View style={styles.studentHeader}>
          <Text style={styles.studentId}>{student.idNumber}</Text>
          {activeTab === 'enrolled' ? (
            <MaterialIcons name="check-circle" size={20} color="#4caf50" />
          ) : null}
        </View>
        <Text style={[
          styles.studentName,
          activeTab === 'enrolled' && styles.selectedStudentText
        ]}>
          {student.lastName}, {student.firstName}
        </Text>
      </View>
      <TouchableOpacity
        style={[
          styles.actionButton,
          activeTab === 'enrolled' ? styles.removeButton : styles.addButton
        ]}
        onPress={() => {
          if (activeTab === 'enrolled') {
            setSelectedStudents(prev => prev.filter(id => id !== student._id));
          } else {
            setSelectedStudents(prev => [...prev, student._id]);
          }
        }}
      >
        <MaterialIcons 
          name={activeTab === 'enrolled' ? 'remove-circle' : 'add-circle'} 
          size={24} 
          color="#fff" 
        />
      </TouchableOpacity>
    </TouchableOpacity>
  ), [activeTab, selectedStudents]);

  const renderEmptyState = useCallback(() => (
    <View style={styles.emptyState}>
      <MaterialIcons 
        name={activeTab === 'enrolled' ? 'groups' : 'person-add'} 
        size={48} 
        color="#ccc" 
      />
      <Text style={styles.emptyStateText}>
        {activeTab === 'enrolled' 
          ? 'No students enrolled in this course yet'
          : 'No available students found'}
      </Text>
    </View>
  ), [activeTab]);

  const renderFooter = useCallback(() => {
    if (!isLoadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color="#1a73e8" />
      </View>
    );
  }, [isLoadingMore]);

  const getItemLayout = useCallback((data: any, index: number) => ({
    length: 80, // Approximate height of each item
    offset: 80 * index,
    index,
  }), []);

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
              <Text style={styles.headerTitle}>Assign Students</Text>
            </View>
            <TouchableOpacity
              style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
              onPress={handleSaveAssignments}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <MaterialIcons name="check" size={20} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.saveButtonText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          
          {currentCourse && (
            <View style={styles.courseInfo}>
              <View style={styles.courseHeader}>
                <MaterialIcons name="menu-book" size={22} color="#fff" />
                <Text style={styles.courseTitle}>
                  {currentCourse.courseName}
                </Text>
              </View>
              <Text style={styles.courseCode}>{currentCourse.courseCode}</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        {successMessage && (
          <View style={styles.successContainer}>
            <MaterialIcons name="check-circle" size={20} color="#4caf50" />
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        )}

        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <MaterialIcons name="search" size={20} color="#666" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or ID number..."
              placeholderTextColor="#999"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity 
                onPress={() => setSearchQuery('')}
                style={styles.clearButton}
              >
                <MaterialIcons name="cancel" size={20} color="#666" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'enrolled' && styles.activeTabButton
            ]}
            onPress={() => setActiveTab('enrolled')}
          >
            <MaterialIcons 
              name="groups" 
              size={20} 
              color={activeTab === 'enrolled' ? '#fff' : '#666'} 
              style={styles.tabIcon}
            />
            <Text style={[
              styles.tabText,
              activeTab === 'enrolled' && styles.activeTabText
            ]}>
              Enrolled ({enrolledCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'available' && styles.activeTabButton
            ]}
            onPress={() => setActiveTab('available')}
          >
            <MaterialIcons 
              name="person-add" 
              size={20} 
              color={activeTab === 'available' ? '#fff' : '#666'} 
              style={styles.tabIcon}
            />
            <Text style={[
              styles.tabText,
              activeTab === 'available' && styles.activeTabText
            ]}>
              Available ({availableCount})
            </Text>
          </TouchableOpacity>
        </View>

        <FlatList
          data={paginatedStudents}
          renderItem={renderStudentItem}
          keyExtractor={item => item._id}
          ListEmptyComponent={renderEmptyState}
          ListFooterComponent={renderFooter}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          getItemLayout={getItemLayout}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={5}
          initialNumToRender={10}
          style={styles.studentList}
          contentContainerStyle={styles.studentListContent}
        />
      </Animated.View>
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
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonIcon: {
    marginRight: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  courseInfo: {
    marginTop: 8,
    
  },
  courseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  courseTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
  courseCode: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 30,
  },
  searchContainer: {
    marginBottom: 20,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 5,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(80, 102, 144, 0.1)',
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  clearButton: {
    padding: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(80, 102, 144, 0.1)',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: '#1c3a70',
  },
  tabIcon: {
    marginRight: 8,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  studentList: {
    flex: 1,
  },
  studentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(80, 102, 144, 0.1)',
  },
  selectedStudent: {
    borderWidth: 1,
    borderColor: 'rgba(28, 58, 112, 0.2)',
  },
  studentInfo: {
    flex: 1,
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  studentId: {
    fontSize: 14,
    color: '#506690',
    marginRight: 8,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1c3a70',
  },
  selectedStudentText: {
    color: '#1c3a70',
    fontWeight: '700',
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  addButton: {
    backgroundColor: '#2D5F2D',
  },
  removeButton: {
    backgroundColor: '#dc3545',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateText: {
    color: '#506690',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
    textAlign: 'center',
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
  studentListContent: {
    paddingBottom: 20,
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
  },
}); 