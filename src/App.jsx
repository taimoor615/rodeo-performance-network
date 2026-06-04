import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './pages/Layout'
import HomePage from './pages/HomePage'
import RankingsPage from './pages/RankingsPage'
import RidersPage from './pages/RidersPage'
import AnimalsPage from './pages/AnimalsPage'
import RiderDetailPage from './pages/RiderDetailPage'
import AthletePage from './pages/AthletePage'
import AnimalDetailPage from './pages/AnimalDetailPage'
import EventDetailPage from './pages/EventDetailPage'
import EventsPage from './pages/EventsPage'
import PickupTeamsPage from './pages/PickupTeamsPage'
import PickupTeamDetailPage from './pages/PickupTeamDetailPage'
import ContractorsPage from './pages/ContractorsPage'
import ContractorDetailPage from './pages/ContractorDetailPage'
import ContractorRankingsPage from './pages/ContractorRankingsPage'
import ProducersPage from './pages/ProducersPage'
import ProducerDetailPage from './pages/ProducerDetailPage'
import AddPerformancePage from './pages/AddPerformancePage'
import PostPage from './pages/PostPage'
import AboutUsPage from './pages/AboutUsPage'
import JoinUsPage from './pages/JoinUsPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import CheckoutPage from './pages/CheckoutPage'
import ThankYouPage from './pages/ThankYouPage'
import NILMarketplacePage from './pages/NILMarketplacePage'
import FantasyPage from './pages/FantasyPage'
import LegalPage from './pages/LegalPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import SetPasswordPage from './pages/SetPasswordPage'
import NotFoundPage from './pages/NotFoundPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="rankings" element={<RankingsPage />} />
          <Route path="riders" element={<RidersPage />} />
          <Route path="riders/:slug" element={<RiderDetailPage />} />
          <Route path="athletes/:rinId" element={<AthletePage />} />
          <Route path="animals" element={<AnimalsPage />} />
          <Route path="animals/:slug" element={<AnimalDetailPage />} />
          <Route path="events" element={<EventsPage />} />
          <Route path="events/:slug" element={<EventDetailPage />} />
          <Route path="pickup-teams" element={<PickupTeamsPage />} />
          <Route path="pickup-teams/:slug" element={<PickupTeamDetailPage />} />
          <Route path="contractors" element={<ContractorsPage />} />
          <Route path="contractors/rankings" element={<ContractorRankingsPage />} />
          <Route path="contractors/:slug" element={<ContractorDetailPage />} />
          <Route path="producers" element={<ProducersPage />} />
          <Route path="producers/:slug" element={<ProducerDetailPage />} />
          <Route path="add-performance" element={<AddPerformancePage />} />
          <Route path="about-us" element={<AboutUsPage />} />
          <Route path="join-us" element={<JoinUsPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="set-password" element={<SetPasswordPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="thank-you" element={<ThankYouPage />} />
          <Route path="post/:slug" element={<PostPage />} />
          <Route path="nil-marketplace" element={<NILMarketplacePage />} />
          <Route path="fantasy" element={<FantasyPage />} />
          <Route path="legal" element={<LegalPage />} />
          <Route path="privacy-policy" element={<LegalPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
