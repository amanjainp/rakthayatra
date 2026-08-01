import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import RootLayout from './layouts/RootLayout';
import DashboardLayout from './layouts/DashboardLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleProtectedRoute } from './components/RoleProtectedRoute';
import Landing from './pages/Landing';
import NotFound from './pages/NotFound';
import AccessDenied from './pages/AccessDenied';

// --- STUB PAGE COMPONENTS (To be replaced in subsequent phases) ---
const StubPage = ({ title }: { title: string }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-4">
    <h2 className="text-2xl font-bold text-white">{title}</h2>
    <p className="text-sm text-slate-400">
      This interface is currently under construction for the {title.toLowerCase()} module.
    </p>
  </div>
);

const LoginStub = () => <StubPage title="Login Authentication" />;
const RegisterStub = () => <StubPage title="Donor/Hospital Registration" />;
const VerifyOtpStub = () => <StubPage title="OTP Verification" />;
const ProfileStub = () => <StubPage title="User Profile Settings" />;
const AdminDashboardStub = () => <StubPage title="Admin Management Dashboard" />;
const DonorDashboardStub = () => <StubPage title="Donor Dashboard & Statistics" />;
const PatientDashboardStub = () => <StubPage title="Patient Request Panel" />;
const HospitalDashboardStub = () => <StubPage title="Hospital Blood Logistics Portal" />;
const BloodBankDashboardStub = () => <StubPage title="Blood Bank Dashboard" />;
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
          <Route path="/login" element={<LoginStub />} />
          <Route path="/register" element={<RegisterStub />} />
          <Route path="/verify-otp" element={<VerifyOtpStub />} />
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
                    <AdminDashboardStub />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/donor/dashboard"
                element={
                  <RoleProtectedRoute allowedRoles={['DONOR']}>
                    <DonorDashboardStub />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/patient/dashboard"
                element={
                  <RoleProtectedRoute allowedRoles={['PATIENT']}>
                    <PatientDashboardStub />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/hospital/dashboard"
                element={
                  <RoleProtectedRoute allowedRoles={['HOSPITAL']}>
                    <HospitalDashboardStub />
                  </RoleProtectedRoute>
                }
              />
              <Route
                path="/blood-bank/dashboard"
                element={
                  <RoleProtectedRoute allowedRoles={['BLOOD_BANK']}>
                    <BloodBankDashboardStub />
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
