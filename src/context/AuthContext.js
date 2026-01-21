import React, { createContext, useContext, useState, useEffect } from "react";
import { sdrApi } from "../utils/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const storedSdrId = localStorage.getItem('currentSdrId');
      if (storedSdrId) {
        try {
          const sdr = await sdrApi.getById(storedSdrId);
          setUser(sdr);
          setIsAuthenticated(true);
        } catch (err) {
          // SDR not found, clear storage
          localStorage.removeItem('currentSdrId');
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

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
      // Ensure we have at least a name
      const sdrName = name || email.split('@')[0] || 'User';
      
      // Try to find existing SDR by email
      let sdr;
      try {
        const allSdrs = await sdrApi.getAll();
        sdr = allSdrs.find(s => s.email?.toLowerCase() === email?.toLowerCase());
      } catch (err) {
        console.error('Error fetching SDRs:', err);
        // If we can't fetch, try to create anyway (might be network issue)
      }

      // If not found, create new SDR
      if (!sdr) {
        try {
          sdr = await sdrApi.create({
            name: sdrName,
            email: email,
            picture: picture,
          });
        } catch (createError) {
          console.error('Error creating SDR:', createError);
          // If creation fails due to duplicate email, try fetching again
          if (createError.message.includes('already exists') || createError.message.includes('duplicate')) {
            try {
              const allSdrs = await sdrApi.getAll();
              sdr = allSdrs.find(s => s.email?.toLowerCase() === email?.toLowerCase());
              // Update picture if it exists and SDR doesn't have one
              if (picture && sdr && !sdr.picture) {
                try {
                  sdr = await sdrApi.update(sdr._id || sdr.id, { picture: picture });
                } catch (updateError) {
                  console.error('Error updating SDR picture:', updateError);
                }
              }
            } catch (fetchError) {
              throw new Error(`Failed to create or find SDR: ${createError.message}`);
            }
          } else {
            throw createError;
          }
        }
      } else {
        // Update picture if it exists and SDR doesn't have one
        if (picture && !sdr.picture) {
          try {
            sdr = await sdrApi.update(sdr._id || sdr.id, { picture: picture });
          } catch (updateError) {
            console.error('Error updating SDR picture:', updateError);
          }
        }
      }

      if (!sdr || (!sdr._id && !sdr.id)) {
        throw new Error('SDR creation succeeded but no ID returned');
      }

      const sdrId = sdr._id || sdr.id;
      localStorage.setItem('currentSdrId', sdrId);
      setUser(sdr);
      setIsAuthenticated(true);
      return { success: true, user: sdr };
    } catch (error) {
      console.error('Google login error:', error);
      return { success: false, error: error.message || 'Failed to sign in with Google' };
    }
  };

  const logout = () => {
    localStorage.removeItem('currentSdrId');
    setUser(null);
    setIsAuthenticated(false);
  };

  const updateUser = (updatedUser) => {
    setUser(updatedUser);
  };

  const value = {
    user,
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

