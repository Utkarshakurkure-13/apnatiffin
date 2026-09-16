import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { I18nProvider, useI18n } from './context/I18nContext';
import { LocationProvider, useLocationContext } from './context/LocationContext';
import { NotificationProvider } from './context/NotificationContext';
import Header from './components/common/Header';
import Sidebar from './components/common/Sidebar';
import Footer from './components/common/Footer';
import LocationPermissionModal from './components/location/LocationPermissionModal';

// Public Pages
import LandingPage from './pages/LandingPage';
import CommonLoginPage from './pages/CommonLoginPage';
import CustomerRegister from './pages/CustomerRegister';
import ProviderRegister from './pages/ProviderRegister';

// Customer Pages
import CustomerDashboard from './pages/customer/CustomerDashboard';
import CustomerLocationPage from './pages/customer/CustomerLocationPage';
import CustomerProviderDetail from './pages/customer/CustomerProviderDetail';
import CustomerOrders from './pages/customer/CustomerOrders';
import CustomerSubscriptions from './pages/customer/CustomerSubscriptions';
import CustomerBills from './pages/customer/CustomerBills';
import CustomerPoints from './pages/customer/CustomerPoints';
import CustomerProfile from './pages/customer/CustomerProfile';
import CustomerSettings from './pages/customer/CustomerSettings';

// Provider Pages
import ProviderDashboard from './pages/provider/ProviderDashboard';
import ProviderLocationPage from './pages/provider/ProviderLocationPage';
import ProviderOrders from './pages/provider/ProviderOrders';
import ProviderMenu from './pages/provider/ProviderMenu';
import ProviderEarnings from './pages/provider/ProviderEarnings';
import ProviderCustomers from './pages/provider/ProviderCustomers';
import ProviderServiceArea from './pages/provider/ProviderServiceArea';
import ProviderDeliveryRoute from './pages/provider/ProviderDeliveryRoute';
import ProviderProfile from './pages/provider/ProviderProfile';
import ProviderSettings from './pages/provider/ProviderSettings';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminProviders from './pages/admin/AdminProviders';
import AdminOrders from './pages/admin/AdminOrders';
import AdminSettings from './pages/admin/AdminSettings';
import AdminProfile from './pages/admin/AdminProfile';

function MainLayout() {
  const { user, isCustomer, isProvider, isAdmin, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('landing');
  const [selectedProviderId, setSelectedProviderId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Sync tab when user logs in or is authenticated
  useEffect(() => {
    if (user) {
      if (['landing', 'common-login', 'register-customer', 'register-provider'].includes(activeTab)) {
        if (isCustomer) setActiveTab('customer-dashboard');
        else if (isProvider) setActiveTab('provider-dashboard');
        else if (isAdmin) setActiveTab('admin-dashboard');
      }
    }
  }, [user, isCustomer, isProvider, isAdmin, activeTab]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFF5F7]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full border-4 border-[#2d6a4f] border-t-transparent animate-spin" />
          <span className="font-heading font-bold text-sm text-[#0f5238]">Loading Aapna Tiffin...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FFF5F7] text-[#181a2e]">
      <Header 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        sidebarOpen={sidebarOpen} 
        setSidebarOpen={setSidebarOpen} 
      />

      {/* Role-Based Sidebar Navigation (when authenticated) */}
      {user && (
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          sidebarOpen={sidebarOpen} 
          setSidebarOpen={setSidebarOpen} 
        />
      )}

      <main className="flex-1 pt-20 transition-all duration-200">
        {/* Public Pages */}
        {activeTab === 'landing' && (
          <LandingPage setActiveTab={setActiveTab} setSelectedProviderId={setSelectedProviderId} />
        )}
        {activeTab === 'common-login' && (
          <CommonLoginPage setActiveTab={setActiveTab} />
        )}
        {activeTab === 'register-customer' && (
          <CustomerRegister setActiveTab={setActiveTab} />
        )}
        {activeTab === 'register-provider' && (
          <ProviderRegister setActiveTab={setActiveTab} />
        )}

        {/* Customer Portal */}
        {activeTab === 'customer-dashboard' && (
          <CustomerDashboard setActiveTab={setActiveTab} setSelectedProviderId={setSelectedProviderId} />
        )}
        {activeTab === 'customer-location' && (
          <CustomerLocationPage setActiveTab={setActiveTab} />
        )}
        {activeTab === 'customer-provider-detail' && (
          <CustomerProviderDetail providerId={selectedProviderId} setActiveTab={setActiveTab} />
        )}
        {activeTab === 'customer-orders' && (
          <CustomerOrders setActiveTab={setActiveTab} />
        )}
        {activeTab === 'customer-subscriptions' && (
          <CustomerSubscriptions setActiveTab={setActiveTab} />
        )}
        {activeTab === 'customer-bills' && (
          <CustomerBills setActiveTab={setActiveTab} />
        )}
        {activeTab === 'customer-points' && (
          <CustomerPoints setActiveTab={setActiveTab} />
        )}
        {activeTab === 'customer-profile' && (
          <CustomerProfile setActiveTab={setActiveTab} />
        )}
        {activeTab === 'customer-settings' && (
          <CustomerSettings setActiveTab={setActiveTab} />
        )}

        {/* Provider Portal */}
        {activeTab === 'provider-dashboard' && (
          <ProviderDashboard setActiveTab={setActiveTab} />
        )}
        {activeTab === 'provider-location' && (
          <ProviderLocationPage setActiveTab={setActiveTab} />
        )}
        {activeTab === 'provider-delivery-route' && (
          <ProviderDeliveryRoute setActiveTab={setActiveTab} />
        )}
        {activeTab === 'provider-service-area' && (
          <ProviderServiceArea setActiveTab={setActiveTab} />
        )}
        {activeTab === 'provider-orders' && (
          <ProviderOrders setActiveTab={setActiveTab} />
        )}
        {activeTab === 'provider-menu' && (
          <ProviderMenu setActiveTab={setActiveTab} />
        )}
        {activeTab === 'provider-earnings' && (
          <ProviderEarnings setActiveTab={setActiveTab} />
        )}
        {activeTab === 'provider-customers' && (
          <ProviderCustomers setActiveTab={setActiveTab} />
        )}
        {activeTab === 'provider-profile' && (
          <ProviderProfile setActiveTab={setActiveTab} />
        )}
        {activeTab === 'provider-settings' && (
          <ProviderSettings setActiveTab={setActiveTab} />
        )}

        {/* Admin Portal */}
        {activeTab === 'admin-dashboard' && (
          <AdminDashboard setActiveTab={setActiveTab} />
        )}
        {activeTab === 'admin-customers' && (
          <AdminCustomers setActiveTab={setActiveTab} />
        )}
        {activeTab === 'admin-providers' && (
          <AdminProviders setActiveTab={setActiveTab} />
        )}
        {activeTab === 'admin-orders' && (
          <AdminOrders setActiveTab={setActiveTab} />
        )}
        {activeTab === 'admin-settings' && (
          <AdminSettings setActiveTab={setActiveTab} />
        )}
        {activeTab === 'admin-profile' && (
          <AdminProfile setActiveTab={setActiveTab} />
        )}
      </main>

      <div className="transition-all duration-200">
        <Footer setActiveTab={setActiveTab} />
      </div>

      {/* Real Geolocation Permission Modal (Ask only once) */}
      <LocationPermissionModal />
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <LocationProvider>
        <AuthProvider>
          <NotificationProvider>
            <MainLayout />
          </NotificationProvider>
        </AuthProvider>
      </LocationProvider>
    </I18nProvider>
  );
}

