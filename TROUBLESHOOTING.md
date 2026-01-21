# Troubleshooting Guide

## "Failed to create SDR" Error

If you're getting a "Failed to create SDR" error during Google Sign-In, check the following:

### 1. Backend Server Status

**Check if the backend server is running:**
```bash
cd server
npm start
```

The server should be running on `http://localhost:3001` by default.

**Verify the server is accessible:**
- Open `http://localhost:3001/health` in your browser
- You should see: `{"status":"ok","message":"Sales Dashboard API is running"}`

### 2. MongoDB Connection

**Check if MongoDB is running and accessible:**
- Make sure MongoDB is running on your system
- Verify your `.env` file in the `server/` directory has the correct `MONGODB_URI`

**Example `.env` file:**
```bash
MONGODB_URI=mongodb://localhost:27017/sales_dashboard
```

**Test MongoDB connection:**
```bash
# If using local MongoDB
mongosh mongodb://localhost:27017/sales_dashboard

# Or check if MongoDB service is running
# macOS: brew services list
# Linux: sudo systemctl status mongod
```

### 3. API URL Configuration

**Check your frontend `.env` file:**
```bash
REACT_APP_API_URL=http://localhost:3001/api
```

**Verify the API URL matches your backend:**
- Default: `http://localhost:3001/api`
- Make sure there's no CORS issue
- Check browser console for network errors

### 4. Common Issues

#### Issue: Backend not running
**Solution:** Start the backend server
```bash
cd server
npm install  # If dependencies not installed
npm start
```

#### Issue: MongoDB not connected
**Solution:** 
- Start MongoDB service
- Check `MONGODB_URI` in server `.env`
- Verify MongoDB is accessible

#### Issue: CORS errors
**Solution:** Backend should have CORS enabled (already configured)

#### Issue: Port conflicts
**Solution:** 
- Backend default port: 3001
- Frontend default port: 3000
- Make sure ports are not in use

### 5. Debug Steps

1. **Check browser console** for detailed error messages
2. **Check backend console** for server-side errors
3. **Check network tab** in browser DevTools to see the actual API request/response
4. **Verify MongoDB connection** by checking backend startup logs

### 6. Error Messages

**"Cannot connect to backend API"**
- Backend server is not running
- Wrong API URL configured
- Network/firewall blocking connection

**"SDR with this email already exists"**
- User already registered
- Should automatically find existing SDR (this is normal)

**"API endpoint not found"**
- Backend routes not properly configured
- Wrong API URL
- Backend server crashed

**"Validation error"**
- Missing required fields
- Invalid data format
- Database schema mismatch

### 7. Quick Fix Checklist

- [ ] Backend server is running (`cd server && npm start`)
- [ ] MongoDB is running and accessible
- [ ] `.env` file in `server/` has correct `MONGODB_URI`
- [ ] `.env` file in root has correct `REACT_APP_API_URL`
- [ ] No port conflicts (3000 for frontend, 3001 for backend)
- [ ] Browser console shows no CORS errors
- [ ] Network tab shows API requests reaching the backend

### 8. Testing the API Directly

You can test the SDR creation endpoint directly:

```bash
curl -X POST http://localhost:3001/api/sdrs \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com"}'
```

This should return the created SDR object if everything is working.

