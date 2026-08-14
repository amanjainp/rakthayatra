import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import RootLayout from './layouts/RootLayout';
import DashboardLayout from './layouts/DashboardLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleProtectedRoute } from './components/RoleProtectedRoute';
import { Loader } from './components/Loader';

const Landing = lazy(() => import('./pages/Landing'));
const NotFound = lazy(() => import('./pages/NotFound'));
const AccessDenied = lazy(() => import('./pages/AccessDenied'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const VerifyOtp = lazy(() => import('./pages/VerifyOtp'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const DonorDashboard = lazy(() => import('./pages/donor/DonorDashboard'));
const PatientDashboard = lazy(() => import('./pages/patient/PatientDashboard'));
const HospitalDashboard = lazy(() => import('./pages/hospital/HospitalDashboard'));
const BloodBankDashboard = lazy(() => import('./pages/bloodbank/BloodBankDashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const Inventory = lazy(() => import('./pages/Inventory'));
const BloodRequests = lazy(() => import('./pages/BloodRequests'));
const Donations = lazy(() => import('./pages/Donations'));
const MedicalEligibility = lazy(() => import('./pages/MedicalEligibility'));
const DonationCamps = lazy(() => import('./pages/DonationCamps'));
const AdminManagement = lazy(() => import('./pages/admin/AdminManagement'));
const EmergencyMap = lazy(() => import('./pages/EmergencyMap'));
const Notifications = lazy(() => import('./pages/Notifications'));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loader />}>
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
                    <RoleProtectedRoute allowedRoles={['PATIENT', 'HOSPITAL', 'ADMIN', 'BLOOD_BANK']}>
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
                    <RoleProtectedRoute allowedRoles={['DONOR', 'ADMIN', 'HOSPITAL', 'BLOOD_BANK']}>
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
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
