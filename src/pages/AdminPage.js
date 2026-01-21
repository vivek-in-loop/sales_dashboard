import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { dataApi, getAuthHeaders } from "../utils/api";
import { useNavigate } from "react-router-dom";

function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sdrs, setSdrs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [debugInfo, setDebugInfo] = useState(null);

  // Define allowed admin emails
  const adminEmails = [
    "vivek.kumar@loopwork.co",
    "vipul.babar@loopwork.co",
    "harshit.gupta@loopwork.co"
  ];

  const isAdmin = user && adminEmails.includes(user.email?.toLowerCase());

  useEffect(() => {
    if (!user) return;

    // Redirect non-admin users
    if (!isAdmin) {
      navigate("/profile");
      return;
    }

    loadAdminData();
  }, [user, isAdmin, navigate]);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      const sdrsData = await dataApi.getAllSdrs();
      setSdrs(sdrsData);
      console.log("Loaded SDR data:", sdrsData);
    } catch (err) {
      console.error("Failed to load admin data:", err);
      setError("Failed to load SDR data");
    } finally {
      setLoading(false);
    }
  };

  const loadDebugInfo = async () => {
    try {
      // Try to call the debug endpoint if it exists
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:4030/api'}/data/debug`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const debugData = await response.json();
        setDebugInfo(debugData);
        console.log("Debug info:", debugData);
      }
    } catch (err) {
      console.log("Debug endpoint not available:", err);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };


  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
            <p className="text-gray-600">You don't have permission to access this page.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Panel</h1>
            <p className="text-gray-600">Manage SDRs and monitor upload activity</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadDebugInfo}
              className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 border border-blue-300 rounded-lg hover:bg-blue-200 transition"
            >
              Debug Info
            </button>
            <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-full">
              Admin Access
            </span>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total SDRs</p>
                <p className="text-2xl font-bold text-gray-900">{sdrs.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Gmail Records</p>
                <p className="text-2xl font-bold text-gray-900">
                  {sdrs.reduce((sum, sdr) => sum + (sdr.total_gmail_records || 0), 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total MailSuite Records</p>
                <p className="text-2xl font-bold text-gray-900">
                  {sdrs.reduce((sum, sdr) => sum + (sdr.total_mailsuite_records || 0), 0).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Debug Info */}
        {debugInfo && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">Debug Information</h3>
            <div className="text-sm text-yellow-700">
              <p>Total SDRs: {debugInfo.total_sdrs}</p>
              <p>Total Gmail Records in DB: {debugInfo.total_gmail_records}</p>
              <p>Total MailSuite Records in DB: {debugInfo.total_mailsuite_records}</p>
              <div className="mt-2">
                <p className="font-medium">SDR Details:</p>
                {debugInfo.sdr_details?.map(sdr => (
                  <div key={sdr.sdr_id} className="ml-4 mt-1">
                    {sdr.sdr_name}: Gmail({sdr.gmail_count}/{sdr.gmail_count_str}), MailSuite({sdr.mailsuite_count}/{sdr.mailsuite_count_str}), Uploads({sdr.upload_history})
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SDRs Cards */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">SDR Management</h2>
              <p className="text-gray-600">Overview of all SDRs and their upload activity</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading SDR data...</span>
            </div>
          ) : error ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-red-600 mb-2">Error loading data</div>
              <p className="text-gray-600">{error}</p>
            </div>
          ) : sdrs.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">No SDRs found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {sdrs.map((sdr) => (
                <div key={sdr._id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow duration-200">
                  {/* SDR Header */}
                  <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center space-x-4">
                      {sdr.picture ? (
                        <img
                          className="h-12 w-12 rounded-full border-2 border-gray-200"
                          src={sdr.picture}
                          alt={sdr.name}
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center border-2 border-gray-200">
                          <span className="text-white font-bold text-lg">
                            {sdr.name ? sdr.name.charAt(0).toUpperCase() : 'U'}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">
                          {sdr.name || 'Unknown SDR'}
                        </h3>
                        <p className="text-sm text-gray-600 truncate">{sdr.email}</p>
                        {sdr.team && (
                          <p className="text-xs text-gray-500 mt-1">Team: {sdr.team}</p>
                        )}
                        {/* Debug info */}
                        <div className="text-xs text-gray-400 mt-1">
                          Upload history: {sdr.upload_history?.length || 0} entries
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="text-center">
                        <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                          📧 {sdr.total_gmail_records || 0}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Gmail Records
                          {sdr.upload_history?.some(u => u.type === 'gmail_send') && (
                            <span className="block text-xs text-green-600">✓ Has uploads</span>
                          )}
                        </p>
                        {sdr.calculated_gmail_count !== undefined && sdr.calculated_gmail_count !== sdr.total_gmail_records && (
                          <p className="text-xs text-red-500">DB: {sdr.calculated_gmail_count}</p>
                        )}
                      </div>
                      <div className="text-center">
                        <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                          📊 {sdr.total_mailsuite_records || 0}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          MailSuite Records
                          {sdr.upload_history?.some(u => u.type === 'mailsuite') && (
                            <span className="block text-xs text-green-600">✓ Has uploads</span>
                          )}
                        </p>
                        {sdr.calculated_mailsuite_count !== undefined && sdr.calculated_mailsuite_count !== sdr.total_mailsuite_records && (
                          <p className="text-xs text-red-500">DB: {sdr.calculated_mailsuite_count}</p>
                        )}
                      </div>
                    </div>

                    {/* Last Uploads */}
                    <div className="space-y-3 mb-6">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Last Gmail Upload:</span>
                        <span className="font-medium text-gray-900">
                          {formatDate(sdr.last_gmail_upload)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">Last MailSuite Upload:</span>
                        <span className="font-medium text-gray-900">
                          {formatDate(sdr.last_mailsuite_upload)}
                        </span>
                      </div>
                    </div>

                    {/* Upload Timeline */}
                    {sdr.upload_history && sdr.upload_history.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3">Recent Uploads</h4>
                        <div className="space-y-2">
                          {sdr.upload_history
                            .sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at))
                            .slice(0, 5)
                            .map((upload, index) => (
                              <div key={index} className="flex items-center space-x-3">
                                <div className={`w-2 h-2 rounded-full ${
                                  upload.type === 'gmail_send' ? 'bg-blue-500' :
                                  upload.type === 'mailsuite' ? 'bg-purple-500' :
                                  'bg-green-500'
                                }`}></div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-gray-900 capitalize">
                                      {upload.type.replace('_', ' ')}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      {formatDate(upload.uploaded_at)}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-600">
                                    {upload.total_records || 0} records uploaded
                                  </p>
                                </div>
                              </div>
                            ))}
                        </div>
                        {sdr.upload_history.length > 5 && (
                          <p className="text-xs text-gray-500 mt-2 text-center">
                            +{sdr.upload_history.length - 5} more uploads
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminPage;
