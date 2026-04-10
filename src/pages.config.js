/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
import SystemReadiness from './pages/SystemReadiness';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
import SystemReadiness from './pages/SystemReadiness';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "CommandCenterHome",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import ActionMatrix from './pages/ActionMatrix';
import AgentWorkspace from './pages/AgentWorkspace';
import CommandCenterHome from './pages/CommandCenterHome';
import AIAgents from './pages/AIAgents';
import AICommandCenter from './pages/AICommandCenter';
import NexusOpsHub from './pages/NexusOpsHub';
import NexusIntelligenceDashboard from './pages/NexusIntelligenceDashboard';
import AdaptiveLearning from './pages/AdaptiveLearning';
import Atlas from './pages/Atlas';
import AtlasOpsHub from './pages/AtlasOpsHub';
import AtlasOperationsDashboard from './pages/AtlasOperationsDashboard';
import Automations from './pages/Automations';
import Briefing from './pages/Briefing';
import BudgetControl from './pages/BudgetControl';
import BusinessHealth from './pages/BusinessHealth';
import BusinessProfile from './pages/BusinessProfile';
import CampaignHub from './pages/CampaignHub';
import Canvas from './pages/Canvas';
import CanvasOpsHub from './pages/CanvasOpsHub';
import CanvasCreativeDashboard from './pages/CanvasCreativeDashboard';
import Centsible from './pages/Centsible';
import CentsibleOpsHub from './pages/CentsibleOpsHub';
import CentsibleCFODashboard from './pages/CentsibleCFODashboard';
import Chronos from './pages/Chronos';
import ChronosOpsHub from './pages/ChronosOpsHub';
import ChronosTimeDashboard from './pages/ChronosTimeDashboard';
import Compass from './pages/Compass';
import CompassIntelDashboard from './pages/CompassIntelDashboard';
import CompassOpsHub from './pages/CompassOpsHub';
import ContentBank from './pages/ContentBank';
import ContentCreator from './pages/ContentCreator';
import Dashboard from './pages/Dashboard';
import EmailHub from './pages/EmailHub';
import FinancialHub from './pages/FinancialHub';
import Forecasting from './pages/Forecasting';
import GrowthIntelligence from './pages/GrowthIntelligence';
import Insights from './pages/Insights';
import Inspect from './pages/Inspect';
import InspectOpsHub from './pages/InspectOpsHub';
import InspectQualityDashboard from './pages/InspectQualityDashboard';
import Integrations from './pages/Integrations';
import InvoiceManager from './pages/InvoiceManager';
import Maestro from './pages/Maestro';
import MaestroOpsHub from './pages/MaestroOpsHub';
import MaestroPerformanceDashboard from './pages/MaestroPerformanceDashboard';
import Merchant from './pages/Merchant';
import MerchantOpsHub from './pages/MerchantOpsHub';
import MerchantCommerceDashboard from './pages/MerchantCommerceDashboard';
import Notifications from './pages/Notifications';
import Part from './pages/Part';
import PartEcosystemDashboard from './pages/PartEcosystemDashboard';
import PartOpsHub from './pages/PartOpsHub';
import Preferences from './pages/Preferences';
import Prospect from './pages/Prospect';
import ProspectOpsHub from './pages/ProspectOpsHub';
import ProspectRevenueDashboard from './pages/ProspectRevenueDashboard';
import Pulse from './pages/Pulse';
import PulseOpsHub from './pages/PulseOpsHub';
import PulsePeopleDashboard from './pages/PulsePeopleDashboard';
import Reports from './pages/Reports';
import SageAI from './pages/SageAI';
import SageOpsHub from './pages/SageOpsHub';
import SageStrategyDashboard from './pages/SageStrategyDashboard';
import ScenarioPlanner from './pages/ScenarioPlanner';
import Scribe from './pages/Scribe';
import ScribeOpsHub from './pages/ScribeOpsHub';
import ScribeKnowledgeDashboard from './pages/ScribeKnowledgeDashboard';
import SecurityOps from './pages/SecurityOps';
import Sentinel from './pages/Sentinel';
import SentinelOpsHub from './pages/SentinelOpsHub';
import SentinelThreatDashboard from './pages/SentinelThreatDashboard';
import Settings from './pages/Settings';
import SystemReadiness from './pages/SystemReadiness';
import SocialCommand from './pages/SocialCommand';
import SocialInbox from './pages/SocialInbox';
import SocialScheduler from './pages/SocialScheduler';
import SupportSage from './pages/SupportSage';
import SupportCXDashboard from './pages/SupportCXDashboard';
import SupportSageOpsHub from './pages/SupportSageOpsHub';
import Team from './pages/Team';
import TrendExplorer from './pages/TrendExplorer';
import Veritas from './pages/Veritas';
import VeritasOpsHub from './pages/VeritasOpsHub';
import VeritasLegalDashboard from './pages/VeritasLegalDashboard';
import VideoStudio from './pages/VideoStudio';
import Workflows from './pages/Workflows';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AgentWorkspace": AgentWorkspace,
    "CommandCenterHome": CommandCenterHome,
    "AIAgents": AIAgents,
    "AICommandCenter": AICommandCenter,
    "NexusOpsHub": NexusOpsHub,
    "NexusIntelligenceDashboard": NexusIntelligenceDashboard,
    "AdaptiveLearning": AdaptiveLearning,
    "Atlas": Atlas,
    "AtlasOpsHub": AtlasOpsHub,
    "AtlasOperationsDashboard": AtlasOperationsDashboard,
    "Automations": Automations,
    "Briefing": Briefing,
    "BudgetControl": BudgetControl,
    "BusinessHealth": BusinessHealth,
    "BusinessProfile": BusinessProfile,
    "CampaignHub": CampaignHub,
    "Canvas": Canvas,
    "CanvasOpsHub": CanvasOpsHub,
    "CanvasCreativeDashboard": CanvasCreativeDashboard,
    "Centsible": Centsible,
    "CentsibleOpsHub": CentsibleOpsHub,
    "CentsibleCFODashboard": CentsibleCFODashboard,
    "Chronos": Chronos,
    "ChronosOpsHub": ChronosOpsHub,
    "ChronosTimeDashboard": ChronosTimeDashboard,
    "Compass": Compass,
    "CompassIntelDashboard": CompassIntelDashboard,
    "CompassOpsHub": CompassOpsHub,
    "ContentBank": ContentBank,
    "ContentCreator": ContentCreator,
    "Dashboard": Dashboard,
    "EmailHub": EmailHub,
    "FinancialHub": FinancialHub,
    "Forecasting": Forecasting,
    "GrowthIntelligence": GrowthIntelligence,
    "Insights": Insights,
    "Inspect": Inspect,
    "InspectOpsHub": InspectOpsHub,
    "InspectQualityDashboard": InspectQualityDashboard,
    "Integrations": Integrations,
    "InvoiceManager": InvoiceManager,
    "Maestro": Maestro,
    "MaestroOpsHub": MaestroOpsHub,
    "MaestroPerformanceDashboard": MaestroPerformanceDashboard,
    "Merchant": Merchant,
    "MerchantOpsHub": MerchantOpsHub,
    "MerchantCommerceDashboard": MerchantCommerceDashboard,
    "Notifications": Notifications,
    "Part": Part,
    "PartEcosystemDashboard": PartEcosystemDashboard,
    "PartOpsHub": PartOpsHub,
    "Preferences": Preferences,
    "Prospect": Prospect,
    "ProspectOpsHub": ProspectOpsHub,
    "ProspectRevenueDashboard": ProspectRevenueDashboard,
    "Pulse": Pulse,
    "PulseOpsHub": PulseOpsHub,
    "PulsePeopleDashboard": PulsePeopleDashboard,
    "Reports": Reports,
    "SageAI": SageAI,
    "SageOpsHub": SageOpsHub,
    "SageStrategyDashboard": SageStrategyDashboard,
    "ScenarioPlanner": ScenarioPlanner,
    "Scribe": Scribe,
    "ScribeOpsHub": ScribeOpsHub,
    "ScribeKnowledgeDashboard": ScribeKnowledgeDashboard,
    "SecurityOps": SecurityOps,
    "Sentinel": Sentinel,
    "SentinelOpsHub": SentinelOpsHub,
    "SentinelThreatDashboard": SentinelThreatDashboard,
    "Settings": Settings,
    "SystemReadiness": SystemReadiness,
    "SocialCommand": SocialCommand,
    "SocialInbox": SocialInbox,
    "SocialScheduler": SocialScheduler,
    "SupportSage": SupportSage,
    "SupportCXDashboard": SupportCXDashboard,
    "SupportSageOpsHub": SupportSageOpsHub,
    "Team": Team,
    "TrendExplorer": TrendExplorer,
    "Veritas": Veritas,
    "VeritasOpsHub": VeritasOpsHub,
    "VeritasLegalDashboard": VeritasLegalDashboard,
    "VideoStudio": VideoStudio,
    "Workflows": Workflows,
}

export const pagesConfig = {
    mainPage: "CommandCenterHome",
    Pages: PAGES,
    Layout: __Layout,
};






































