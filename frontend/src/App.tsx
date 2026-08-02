import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import RootLayout from './layouts/RootLayout';
import DashboardLayout from './layouts/DashboardLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleProtectedRoute } from './components/RoleProtectedRoute';
import Landing from './pages/Landing';
import NotFound from './pages/NotFound';
import AccessDenied from './pages/AccessDenied';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyOtp from './pages/VerifyOtp';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AdminDashboard from './pages/admin/AdminDashboard';
import DonorDashboard from './pages/donor/DonorDashboard';
import PatientDashboard from './pages/patient/PatientDashboard';
import HospitalDashboard from './pages/hospital/HospitalDashboard';
import BloodBankDashboard from './pages/bloodbank/BloodBankDashboard';
import Profile from './pages/Profile';
import Inventory from './pages/Inventory';
import BloodRequests from './pages/BloodRequests';
import Donations from './pages/Donations';
import MedicalEligibility from './pages/MedicalEligibility';
import DonationCamps from './pages/DonationCamps';
import AdminManagement from './pages/admin/AdminManagement';
import EmergencyMap from './pages/EmergencyMap';
import Notifications from './pages/Notifications';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Top-Level Providers Wrapper */}
        <Route element={<RootLayout />}>
          
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/access-denied" element={<AccessDenied />} />

          {/* Protected Area Layout */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              
              {/* Profile - Available to all authenticated roles */}
              <Route path="/profile" element={<Profile />} />

              {/* Role Protected Dashboards */}
              <Route
                path="/admin/dashboard"
                element={
                  <RoleProtectedRoute allowedRoles={['ADMIN']}>
                    <AdminDashboard />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/donor/dashboard"
                element={
                  <RoleProtectedRoute allowedRoles={['DONOR']}>
                    <DonorDashboard />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/patient/dashboard"
                element={
                  <RoleProtectedRoute allowedRoles={['PATIENT']}>
                    <PatientDashboard />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/hospital/dashboard"
                element={
                  <RoleProtectedRoute allowedRoles={['HOSPITAL']}>
                    <HospitalDashboard />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/blood-bank/dashboard"
                element={
                  <RoleProtectedRoute allowedRoles={['BLOOD_BANK']}>
                    <BloodBankDashboard />
                  </RoleProtectedRoute>
                }
              />

              {/* Business Modules (Role Restricted) */}
              <Route
                path="/inventory"
                element={
                  <RoleProtectedRoute allowedRoles={['BLOOD_BANK', 'ADMIN']}>
                    <Inventory />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/requests"
                element={
                  <RoleProtectedRoute allowedRoles={['PATIENT', 'HOSPITAL', 'ADMIN']}>
                    <BloodRequests />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/donations"
                element={
                  <RoleProtectedRoute allowedRoles={['DONOR', 'BLOOD_BANK', 'ADMIN']}>
                    <Donations />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/eligibility"
                element={
                  <RoleProtectedRoute allowedRoles={['DONOR']}>
                    <MedicalEligibility />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/camps"
                element={
                  <RoleProtectedRoute allowedRoles={['DONOR', 'ADMIN']}>
                    <DonationCamps />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/admin/management"
                element={
                  <RoleProtectedRoute allowedRoles={['ADMIN']}>
                    <AdminManagement />
                  </RoleProtectedRoute>
                }
              />
              <Route path="/emergency-map" element={<EmergencyMap />} />
              <Route path="/notifications" element={<Notifications />} />

            </Route>
          </Route>

          {/* Catch All Fallbacks */}
          <Route path="/404" element={<NotFound />} />
          <Route path="*" element={<Navigate to="/404" replace />} />

        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
