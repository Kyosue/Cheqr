import { API_CONFIG } from '../config';

// Mock user data
const mockUsers = [
  {
    id: '1',
    idNumber: '2020-0001',
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@example.com',
    role: 'admin',
    username: 'admin',
    password: 'password123'
  },
  {
    id: '2',
    idNumber: '2020-0002',
    firstName: 'Lecturer',
    lastName: 'User',
    email: 'lecturer@example.com',
    role: 'lecturer',
    username: 'lecturer',
    password: 'password123'
  },
  {
    id: '3',
    idNumber: '2020-0003',
    firstName: 'Student',
    lastName: 'User',
    email: 'student@example.com',
    role: 'student',
    username: 'student',
    password: 'password123'
  }
];

export type User = {
  _id: string;
  idNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  role: 'admin' | 'lecturer' | 'student';
  roles?: ('admin' | 'lecturer' | 'student')[];
};

export interface Course {
  _id: string;
  courseCode: string;
  courseName: string;
  description: string;
  lecturerId: {
    _id: string;
    firstName: string;
    lastName: string;
  } | null;
  schedules: Array<{
    days: string[];
    startTime: string;
    endTime: string;
  }>;
  students?: string[];
}

// Helper function to handle API responses
const handleResponse = async (response: Response) => {
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Request failed');
  }
  return response.json();
};

export const authenticateUser = async (username: string, password: string) => {
  try {
    console.log('Authenticating user:', username);
    
    // For development/testing, use mock data
    const mockUser = mockUsers.find(
      user => user.username === username && user.password === password
    );

    if (mockUser) {
      console.log('Mock user found:', mockUser.username);
      // Create mock login log
      try {
        console.log('Creating mock login audit entry...');
        const loginResponse = await fetch(`${API_CONFIG.baseURL}/logs/mock`, {
          method: 'POST',
          headers: API_CONFIG.headers,
          body: JSON.stringify({
            userId: mockUser.id,
            username: mockUser.username,
            role: mockUser.role
          }),
        });
        
        const loginData = await loginResponse.json();
        console.log('Login audit response:', loginData);
        
        const loginAuditId = loginData.loginAuditId;
        console.log('Received loginAuditId:', loginAuditId);

        // Remove password from the response
        const { password: _, ...userWithoutPassword } = mockUser;
        
        const userData = {
          ...userWithoutPassword,
          loginAuditId
        };
        
        console.log('Returning user data with loginAuditId:', userData);
        return {
          success: true,
          user: userData
        };
      } catch (error) {
        console.error('Error creating mock login log:', error);
        // Continue with login even if logging fails
        const { password: _, ...userWithoutPassword } = mockUser;
        return {
          success: true,
          user: userWithoutPassword
        };
      }
    }

    // If not using mock data, make the API call
    console.log('No mock user found, calling API...');
    const response = await fetch(`${API_CONFIG.baseURL}/auth/login`, {
      method: 'POST',
      headers: API_CONFIG.headers,
      body: JSON.stringify({ username, password }),
    });

    const data = await handleResponse(response);
    console.log('API login response:', data);
    return {
      success: true,
      user: data // Server already includes loginAuditId in response
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Invalid credentials'
    };
  }
};

export const getAllUsers = async () => {
  try {
    const response = await fetch(`${API_CONFIG.baseURL}/users`, {
      headers: API_CONFIG.headers,
    });

    return handleResponse(response);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }
    throw new Error('Failed to fetch users: Unknown error');
  }
};

export const getUserById = async (id: string) => {
  try {
    const response = await fetch(`${API_CONFIG.baseURL}/users/${id}`, {
      headers: API_CONFIG.headers,
    });

    return handleResponse(response);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch user: ${error.message}`);
    }
    throw new Error('Failed to fetch user: Unknown error');
  }
};

export const getUsers = async (): Promise<User[]> => {
  try {
    const response = await fetch(`${API_CONFIG.baseURL}/users`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    return handleResponse(response);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }
    throw new Error('Failed to fetch users: Unknown error');
  }
};

export const createUser = async (userData: any) => {
  try {
    const response = await fetch(`${API_CONFIG.baseURL}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    return handleResponse(response);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
    throw new Error('Failed to create user: Unknown error');
  }
};

export const updateUser = async (id: string, userData: any) => {
  try {
    const response = await fetch(`${API_CONFIG.baseURL}/users/${id}`, {
      method: 'PUT',
      headers: API_CONFIG.headers,
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to update user');
    }

    return handleResponse(response);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
    throw new Error('Failed to update user: Unknown error');
  }
};

export const deleteUser = async (userId: string) => {
  try {
    const response = await fetch(`${API_CONFIG.baseURL}/users/${userId}`, {
      method: 'DELETE',
      headers: API_CONFIG.headers,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to delete user');
    }

    return handleResponse(response);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
    throw new Error('Failed to delete user: Unknown error');
  }
};

export const getLoginLogs = async () => {
  try {
    const response = await fetch(`${API_CONFIG.baseURL}/logs`, {
      headers: API_CONFIG.headers,
    });

    return handleResponse(response);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch login logs: ${error.message}`);
    }
    throw new Error('Failed to fetch login logs: Unknown error');
  }
};

export const resetPassword = async (email: string, username: string, newPassword: string) => {
  try {
    const response = await fetch(`${API_CONFIG.baseURL}/auth/reset-password`, {
      method: 'POST',
      headers: API_CONFIG.headers,
      body: JSON.stringify({ email, username, newPassword }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Password reset failed: ${error.message}`);
    }
    throw new Error('Password reset failed: Unknown error');
  }
};

export const logoutUser = async (userId?: string, loginAuditId?: string) => {
  try {
    // Ensure at least one parameter is provided
    if (!userId && !loginAuditId) {
      throw new Error('Either userId or loginAuditId must be provided');
    }
    
    const response = await fetch(`${API_CONFIG.baseURL}/auth/logout`, {
      method: 'POST',
      headers: API_CONFIG.headers,
      body: JSON.stringify({ 
        userId,
        loginAuditId 
      }),
    });

    return handleResponse(response);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Logout failed: ${error.message}`);
    }
    throw new Error('Logout failed: Unknown error');
  }
};

export const createCourse = async (courseData: any) => {
  try {
    const response = await fetch(`${API_CONFIG.baseURL}/courses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(courseData),
    });

    return handleResponse(response);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create course: ${error.message}`);
    }
    throw new Error('Failed to create course: Unknown error');
  }
};

export const getCourses = async () => {
  try {
    const response = await fetch(`${API_CONFIG.baseURL}/courses`, {
      headers: API_CONFIG.headers,
    });

    return handleResponse(response);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch courses: ${error.message}`);
    }
    throw new Error('Failed to fetch courses: Unknown error');
  }
};

export const updateCourse = async (courseId: string, courseData: Partial<Course>): Promise<Course> => {
  try {
    const response = await fetch(`${API_CONFIG.baseURL}/courses/${courseId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(courseData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to update course');
    }

    const updatedCourse = await response.json();
    return updatedCourse;
  } catch (error) {
    console.error('Error updating course:', error);
    throw error;
  }
};

export const deleteCourse = async (id: string) => {
  try {
    const response = await fetch(`${API_CONFIG.baseURL}/courses/${id}`, {
      method: 'DELETE',
      headers: API_CONFIG.headers,
    });

    return handleResponse(response);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to delete course: ${error.message}`);
    }
    throw new Error('Failed to delete course: Unknown error');
  }
}; 