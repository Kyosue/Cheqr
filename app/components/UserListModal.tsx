import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Animated,
  PanResponder,
  Dimensions,
  Keyboard,
  Platform
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { User, deleteUser } from '../../lib/api';

interface UserListModalProps {
  visible: boolean;
  onClose: () => void;
  users: User[];
  onEdit: (user: User) => void;
  onDelete: (userId: string) => void;
  role: string;
  onRefresh: () => void;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DRAWER_HEIGHT = SCREEN_HEIGHT * 0.8;
const DRAG_THRESHOLD = 50;

export const UserListModal: React.FC<UserListModalProps> = ({
  visible,
  onClose,
  users,
  onEdit,
  onDelete,
  role,
  onRefresh
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isDeleting, setIsDeleting] = React.useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [userToDelete, setUserToDelete] = React.useState<User | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Animation values
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;

  // Capitalized role for display
  const capitalizedRole = role.charAt(0).toUpperCase() + role.slice(1);

  const filteredUsers = users.filter(user =>
    `${user.idNumber} ${user.firstName} ${user.lastName} ${user.email}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  // Pan responder for drag gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > DRAG_THRESHOLD) {
          closeDrawer();
        } else {
          // Snap back to open position
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    })
  ).current;

  const openDrawer = () => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeDrawer = () => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  useEffect(() => {
    if (visible) {
      openDrawer();
    }
  }, [visible]);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeleteClick = (user: User) => {
    setUserToDelete(user);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;

    try {
      setIsDeleting(userToDelete._id);
      await deleteUser(userToDelete._id);
      await onDelete(userToDelete._id);
      setShowDeleteConfirm(false);
      setUserToDelete(null);
      handleRefresh();
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setIsDeleting(null);
    }
  };

  if (!visible) return null;

  const getRoleColor = (userRole: string) => {
    switch (userRole) {
      case 'admin': return '#1c3a70';
      case 'lecturer': return '#2D5F2D';
      case 'student': return '#7D4600';
      default: return '#506690';
    }
  };

  const roleColor = getRoleColor(role);

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View 
        style={[
          styles.overlay,
          { opacity: overlayOpacity }
        ]}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={closeDrawer}
          activeOpacity={1}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.drawer,
          {
            transform: [
              {
                translateY: translateY.interpolate({
                  inputRange: [0, SCREEN_HEIGHT],
                  outputRange: [0, SCREEN_HEIGHT],
                  extrapolate: 'clamp',
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.drawerContent}>
          {/* Drawer Handle */}
          <View {...panResponder.panHandlers} style={styles.drawerHandle}>
            <View style={styles.handleBar} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Text style={[styles.title, {color: roleColor}]}>{capitalizedRole} Users</Text>
              {isRefreshing ? (
                <ActivityIndicator color={roleColor} />
              ) : (
                <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
                  <MaterialIcons name="refresh" size={22} color={roleColor} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={closeDrawer} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color="#506690" />
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={20} color="#506690" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by ID, name, or email..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#8896AB"
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialIcons name="cancel" size={20} color="#506690" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* User List */}
          <ScrollView 
            style={styles.userList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <View key={user._id} style={styles.userCard}>
                  <View style={styles.userInfo}>
                    <Text style={styles.userId}>{user.idNumber}</Text>
                    <Text style={[styles.userName, {color: roleColor}]}>{user.lastName}, {user.firstName}</Text>
                    <Text style={styles.userEmail}>{user.email}</Text>
                    
                    {/* Display role badges */}
                    <View style={styles.roleBadgesContainer}>
                      {(Array.isArray(user.roles) ? user.roles : [user.role]).map((userRole, index) => {
                        const badgeColor = getRoleColor(userRole);
                        return (
                          <View 
                            key={index} 
                            style={[
                              styles.roleBadge, 
                              { backgroundColor: `${badgeColor}15`, borderColor: `${badgeColor}30` }
                            ]}
                          >
                            <Text style={[styles.roleBadgeText, { color: badgeColor }]}>
                              {userRole.charAt(0).toUpperCase() + userRole.slice(1)}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                  <View style={styles.userActions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.editButton]}
                      onPress={() => onEdit(user)}
                    >
                      <MaterialIcons name="edit" size={20} color="#2D5F2D" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => handleDeleteClick(user)}
                      disabled={isDeleting === user._id}
                    >
                      {isDeleting === user._id ? (
                        <ActivityIndicator size="small" color="#EF4444" />
                      ) : (
                        <MaterialIcons name="delete" size={20} color="#EF4444" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyStateContainer}>
                <MaterialIcons name="search-off" size={48} color="#8896AB" />
                <Text style={styles.emptyStateText}>No users found</Text>
                <Text style={styles.emptyStateSubtext}>Try adjusting your search query</Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmContent}>
              <View style={styles.confirmIconContainer}>
                <MaterialIcons name="warning" size={40} color="#fff" />
              </View>
              <Text style={styles.confirmTitle}>Confirm Delete</Text>
              <Text style={styles.confirmText}>
                Are you sure you want to delete {userToDelete?.firstName} {userToDelete?.lastName}?
              </Text>
              <Text style={styles.confirmWarning}>
                This action cannot be undone.
              </Text>
              <View style={styles.confirmButtons}>
                <TouchableOpacity
                  style={[styles.confirmButton, styles.cancelConfirmButton]}
                  onPress={() => setShowDeleteConfirm(false)}
                >
                  <Text style={styles.cancelConfirmText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmButton, styles.deleteConfirmButton]}
                  onPress={handleDeleteConfirm}
                  disabled={isDeleting === userToDelete?._id}
                >
                  {isDeleting === userToDelete?._id ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.deleteConfirmText}>Delete</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(23, 43, 77, 0.7)',
  },
  drawer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: DRAWER_HEIGHT,
    backgroundColor: 'transparent',
  },
  drawerContent: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  drawerHandle: {
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#e7eaf0',
    borderRadius: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f4f9',
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginRight: 12,
  },
  refreshButton: {
    padding: 8,
  },
  closeButton: {
    padding: 8,
    marginLeft: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    marginHorizontal: 24,
    borderRadius: 12,
    padding: 12,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: '#e7eaf0',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    marginLeft: 8,
    color: '#2d3748',
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
  },
  userList: {
    flex: 1,
    paddingHorizontal: 24,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e7eaf0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  userInfo: {
    flex: 1,
  },
  userId: {
    fontSize: 14,
    color: '#506690',
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#506690',
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButton: {
    backgroundColor: 'rgba(45, 95, 45, 0.1)',
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  roleBadgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  confirmOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(23, 43, 77, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  confirmIconContainer: {
    width: 60,
    height: 60,
    backgroundColor: '#EF4444',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 16,
  },
  confirmText: {
    fontSize: 16,
    color: '#2d3748',
    marginBottom: 8,
    textAlign: 'center',
  },
  confirmWarning: {
    fontSize: 14,
    color: '#506690',
    marginBottom: 24,
    textAlign: 'center',
  },
  confirmButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 12,
  },
  confirmButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelConfirmButton: {
    backgroundColor: '#f0f4f9',
    borderWidth: 1,
    borderColor: '#e7eaf0',
  },
  deleteConfirmButton: {
    backgroundColor: '#EF4444',
  },
  cancelConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#506690',
  },
  deleteConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  emptyStateContainer: {
    paddingVertical: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2d3748',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#506690',
  },
}); 