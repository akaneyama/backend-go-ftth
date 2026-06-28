import { Routes, Route, Navigate } from 'react-router-dom';
import MainLoginScreen from '../screens/LoginScreen/MainLoginScreen';
import ScrollToTop from '../components/Motion/ScrollToTop';
// import MainRegisterScreen from '../screens/RegisterScreen/MainRegisterScreen'; // Jika ada

// Import Dashboard baru
import DashboardLayout from './DashboardLayout/DashboardLayout';
import DashboardHome from '../screens/Dashboard/DashboardHome';
import RouterListScreen from '../screens/RouterScreen/RouterListScreen';
import RouterFormScreen from '../screens/RouterScreen/RouterFormScreen';
import InterfaceFormScreen from '../screens/InterfaceScreen/InterfaceFormScreen';
import InterfaceListScreen from '../screens/InterfaceScreen/InterfaceListScreen';
import TrafficDashboardScreen from '../screens/TrafficScreen/TrafficDashboardScreen';
import UserFormScreen from '../screens/UserScreen/UserFormScreen';
import UserListScreen from '../screens/UserScreen/UserListScreen';
import PackageFormScreen from '../screens/PackageScreen/PackageFormScreen';
import PackageListScreen from '../screens/PackageScreen/PackageListScreen';
import NetworkMap from '../screens/MapScreen/NetworkMap';
import TopologyTableScreen from '../screens/MapScreen/TopologyTableScreen';
import IsolirScreen from '../screens/ToolScreen/IsolirScreen';
import ClientListScreen from '../screens/ClientScreen/ClientListScreen';
import ClientFormScreen from '../screens/ClientScreen/ClientFormScreen';
import ODPListScreen from '../screens/ODPScreen/ODPListScreen';
import MappingListScreen from '../screens/MapScreen/MappingListScreen';
import GenieACSScreen from '../screens/GenieACSScreen/GenieACSScreen';
import IPPoolScreen from '../screens/IPPoolScreen/IPPoolScreen';

function Router(){
    return (
      <>
      <ScrollToTop/>
        <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<MainLoginScreen />} />
            
            <Route path="/admin" element={<DashboardLayout />}>
                <Route index element={<DashboardHome />} />
                <Route path="packages" element={<PackageListScreen />} />
                <Route path="packages/add" element={<PackageFormScreen />} />
                <Route path="packages/edit/:id" element={<PackageFormScreen />} />
                <Route path="users" element={<UserListScreen />} />
                <Route path="users/add" element={<UserFormScreen />} />
                <Route path="users/edit/:id" element={<UserFormScreen />} />
                <Route path="routers" element={<RouterListScreen />} />
                <Route path="routers/add" element={<RouterFormScreen />} />
                <Route path="routers/edit/:id" element={<RouterFormScreen />} />
                <Route path="interfaces" element={<InterfaceListScreen />} />
                <Route path="interfaces/add" element={<InterfaceFormScreen />} />
                <Route path="interfaces/edit/:id" element={<InterfaceFormScreen />} />
                <Route path="traffic-monitoring" element={<TrafficDashboardScreen />} />
                <Route path="network-map" element={<NetworkMap />} />
                <Route path="topology-table" element={<TopologyTableScreen />} />
                <Route path="isolir" element={<IsolirScreen />} />
                <Route path="clients" element={<ClientListScreen />} />
                <Route path="clients/add" element={<ClientFormScreen />} />
                <Route path="clients/edit/:id" element={<ClientFormScreen />} />
                <Route path="odp" element={<ODPListScreen />} />
                <Route path="network-mapping" element={<MappingListScreen />} />
                <Route path="genie-acs" element={<GenieACSScreen />} />
                <Route path="ippool" element={<IPPoolScreen />} />
            </Route>

        </Routes>
        </>
      );
}

export default Router;