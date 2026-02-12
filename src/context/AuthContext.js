import React, { createContext, useContext, useState, useEffect } from "react";
import { sdrApi } from "../utils/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setToken] = useState(null);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedToken = localStorage.getItem('authToken');
      const storedSdrId = localStorage.getItem('currentSdrId');

      if (storedToken && storedSdrId) {
        try {
          console.log('Verifying existing authentication session...');
          // Verify token by making an authenticated request
          const sdr = await sdrApi.getById(storedSdrId);
          console.log('Authentication verified successfully for user:', sdr.name);

          // Double-check that we got valid SDR data
          if (!sdr || (!sdr._id && !sdr.id)) {
            throw new Error('Invalid SDR data received');
          }

          setToken(storedToken);
          setUser(sdr);
          setIsAuthenticated(true);
        } catch (err) {
          console.warn('Authentication check failed, clearing session:', err.message);
          // Token invalid or SDR not found, clear storage
          localStorage.removeItem('authToken');
          localStorage.removeItem('currentSdrId');
          setToken(null);
          setUser(null);
          setIsAuthenticated(false);
        }
      } else {
        console.log('No stored authentication found');
      }

      setLoading(false);
    };

    checkAuth();
  }, []); // Empty dependency array ensures this only runs once on mount

  const login = async (email, name) => {
    try {
      // Try to find existing SDR by email
      let sdr;
      try {
        const allSdrs = await sdrApi.getAll();
        sdr = allSdrs.find(s => s.email?.toLowerCase() === email?.toLowerCase());
      } catch (err) {
        console.log('Error fetching SDRs:', err);
      }

      // If not found, create new SDR
      if (!sdr) {
        sdr = await sdrApi.create({
          name: name || email.split('@')[0],
          email: email,
        });
      }

      localStorage.setItem('currentSdrId', sdr._id || sdr.id);
      setUser(sdr);
      setIsAuthenticated(true);
      return { success: true, user: sdr };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  };

  const loginWithGoogle = async (email, name, picture) => {
    try {
      // Use the new login endpoint
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:4030/api'}/sdrs/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          name: name,
          picture: picture
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Login failed' }));
        throw new Error(errorData.error || 'Login failed');
      }

      const data = await response.json();
      const { user, token: jwtToken } = data;

      if (!user || !jwtToken) {
        throw new Error('Invalid login response');
      }

      console.log('Login successful, user:', user.name, 'ID:', user._id || user.id);

      // Store token and user data
      localStorage.setItem('authToken', jwtToken);
      localStorage.setItem('currentSdrId', user._id || user.id);

      setToken(jwtToken);
      setUser(user);
      setIsAuthenticated(true);

      return { success: true, user: user };
    } catch (error) {
      console.error('Google login error:', error);
      return { success: false, error: error.message || 'Failed to sign in with Google' };
    }
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentSdrId');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated,
    login,
    loginWithGoogle,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}

