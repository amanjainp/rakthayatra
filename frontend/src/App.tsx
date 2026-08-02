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

// --- STUB PAGE COMPONENTS (To be replaced in subsequent phases) ---
const StubPage = ({ title }: { title: string }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-4">
    <h2 className="text-2xl font-bold text-white">{title}</h2>
    <p className="text-sm text-slate-400">
      This interface is currently under construction for the {title.toLowerCase()} module.
    </p>
  </div>
);

const ProfileStub = () => <StubPage title="User Profile Settings" />;
const InventoryStub = () => <StubPage title="Blood Unit Inventory Management" />;
const RequestsStub = () => <StubPage title="Emergency Blood Requests Ledger" />;
const DonationsStub = () => <StubPage title="Donations & Appointments Ledger" />;
const EligibilityStub = () => <StubPage title="Medical Screening & Eligibility History" />;
const CampsStub = () => <StubPage title="Blood Donation Camps Registry" />;

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
              <Route path="/profile" element={<ProfileStub />} />

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
                    <InventoryStub />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/requests"
                element={
                  <RoleProtectedRoute allowedRoles={['PATIENT', 'HOSPITAL', 'ADMIN']}>
                    <RequestsStub />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/donations"
                element={
                  <RoleProtectedRoute allowedRoles={['DONOR', 'BLOOD_BANK', 'ADMIN']}>
                    <DonationsStub />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/eligibility"
                element={
                  <RoleProtectedRoute allowedRoles={['DONOR']}>
                    <EligibilityStub />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/camps"
                element={
                  <RoleProtectedRoute allowedRoles={['DONOR', 'ADMIN']}>
                    <CampsStub />
                  </RoleProtectedRoute>
                }
              />

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
