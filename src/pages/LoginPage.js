import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function LoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const { loginWithGoogle, isAuthenticated, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const googleButtonRef = useRef(null);
  const buttonRenderedRef = useRef(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate("/profile", { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Handle Google Sign-In callback
  const handleGoogleSignIn = useCallback(async (response) => {
    setError("");
    setLoading(true);

    try {
      // Decode the JWT token to get user info
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
      const email = payload.email;
      const name = payload.name || payload.given_name || email.split('@')[0];
      const picture = payload.picture;

      const result = await loginWithGoogle(email, name, picture);
      setLoading(false);

      if (result.success) {
        navigate("/profile");
      } else {
        setError(result.error || "Login failed. Please try again.");
      }
    } catch (err) {
      console.error('Google Sign-In error:', err);
      setError("Failed to process Google Sign-In. Please try again.");
      setLoading(false);
    }
  }, [loginWithGoogle, navigate]);

  // Initialize Google Sign-In
  useEffect(() => {
    // Prevent multiple initializations
    if (buttonRenderedRef.current) {
      return;
    }

    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || "970603123952-ooq7ntiksu2gjeulsi0rmjpbj4jh2u23.apps.googleusercontent.com";
    
    const initializeGoogleSignIn = () => {
      if (window.google && window.google.accounts && window.google.accounts.id && googleButtonRef.current && !buttonRenderedRef.current) {
        try {
          console.log('Initializing Google Sign-In with client ID:', clientId);
          
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleSignIn,
          });

          // Small delay to ensure DOM is ready
          const timeoutId = setTimeout(() => {
            if (googleButtonRef.current && !buttonRenderedRef.current) {
              console.log('Rendering Google Sign-In button');
              try {
                window.google.accounts.id.renderButton(
                  googleButtonRef.current,
                  {
                    theme: "outline",
                    size: "large",
                    width: "100%",
                    text: "signin_with",
                    locale: "en",
                  }
                );
                buttonRenderedRef.current = true;
                setGoogleLoaded(true);
              } catch (renderErr) {
                console.error('Error rendering button:', renderErr);
                setError("Failed to render Google Sign-In button. Please refresh the page.");
              }
            } else {
              console.error('Google button ref is null or already rendered');
            }
          }, 200);

          return () => clearTimeout(timeoutId);
        } catch (err) {
          console.error('Error initializing Google Sign-In:', err);
          setError("Failed to initialize Google Sign-In. Please refresh the page.");
        }
      } else {
        console.log('Google script not fully loaded yet or button already rendered');
      }
    };

    let checkInterval = null;
    let initTimeout = null;

    // Check if Google script is already loaded
    if (window.google && window.google.accounts && window.google.accounts.id) {
      initTimeout = setTimeout(initializeGoogleSignIn, 100);
    } else {
      // Wait for Google script to load (with timeout)
      let attempts = 0;
      const maxAttempts = 100; // 10 seconds max
      
      checkInterval = setInterval(() => {
        attempts++;
        if (window.google && window.google.accounts && window.google.accounts.id) {
          clearInterval(checkInterval);
          initTimeout = setTimeout(initializeGoogleSignIn, 100);
        } else if (attempts >= maxAttempts) {
          clearInterval(checkInterval);
          setError("Google Sign-In failed to load. Please check your internet connection and refresh the page.");
        }
      }, 100);
    }

    return () => {
      if (checkInterval) clearInterval(checkInterval);
      if (initTimeout) clearTimeout(initTimeout);
      // Don't try to clean up Google's DOM - it handles its own cleanup
    };
  }, [handleGoogleSignIn]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <div className="mb-4">
            <svg
              className="mx-auto h-16 w-16 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Sales Dashboard</h1>
          <p className="text-gray-600">Sign in with Google to continue</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {loading && (
          <div className="mb-6 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Signing in...</span>
          </div>
        )}

        <div className="space-y-4">
          {!googleLoaded && !error && (
            <div className="flex items-center justify-center py-2 min-h-[42px]">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
              <span className="text-gray-600 text-sm">Loading Google Sign-In...</span>
            </div>
          )}
          <div 
            key="google-button-container"
            ref={googleButtonRef} 
            id="google-signin-button"
            className="w-full min-h-[42px] bg-white"
            style={{ minHeight: '42px' }}
            suppressHydrationWarning
          />

          {!googleLoaded && error && (
            <div className="text-center">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition w-full"
              >
                Reload Page to Try Again
              </button>
            </div>
          )}
          
          {googleLoaded && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Secure authentication</span>
                </div>
              </div>

              <div className="text-center text-sm text-gray-600">
                <p>By signing in, you agree to our Terms of Service</p>
                <p className="mt-1">New users will be automatically registered</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
