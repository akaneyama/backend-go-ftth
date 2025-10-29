import { Routes, Route, Navigate } from 'react-router-dom';


import MainLoginScreen from '../screens/LoginScreen/MainLoginScreen';
import ScrollToTop from '../components/Motion/ScrollToTop';
import MainRegisterScreen from '../screens/RegisterScreen/MainRegisterScreen';
function Router(){
    return (
      <>
      <ScrollToTop/>
        <Routes>
          {/* <Route path="/" element={<MainLayout />}>
            <Route index element={<MainHomeScreen />} /> 
            <Route path="/about" element={<MainAboutUsScreen />} />
            <Route path="/blog" element={ < MainBlogScreen /> } />
            <Route path="/blog/:slug" element={<BlogDetail />} /> 
            <Route path="/Donate" element={ < MainDonateScreen /> } />
            <Route path="donate/:id" element={<DonationDetail />} />
            <Route path="/donate/:id/payment" element={<DonationForm />} />
            <Route path="/donate/:id/payment/confirm" element={<DonationFormDetail />} />
          </Route>
          <Route path="/admin" element={<DashboardLayout />}>
              <Route path="dashboard" element={<DashboardHomePage />} />
              <Route path="tree-types" element={<TreeTypePage />}/>
              <Route path="news" element={<NewsPage />} />
              <Route path="news/add" element={<NewsForm />} />
              <Route path="news/edit/:id" element={<NewsForm />} />
              <Route path="trees" element={<TreePage />} />
              <Route path="areas" element={<AreaPage />} />
              <Route path="donations" element={<DonationPage />} />
              <Route path="donations/add" element={<DonationForms />} />
              <Route path="donations/edit/:id" element={<DonationForms />} />
              <Route index element={<Navigate to="dashboard" replace />} />
              
        </Route> */}
          <Route path="/login" element={<MainLoginScreen />} />
          <Route path="/register" element={<MainRegisterScreen />} />
        </Routes>
        </>
      );
}


export default Router;
