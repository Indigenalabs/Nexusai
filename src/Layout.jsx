import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Bell, Building2, ChevronLeft, ChevronRight, Command, Home, Menu, Search, User } from "lucide-react";
import { AGENTS } from "@/lib/agents";

const ROSTER = AGENTS;

function roleTooltip(agent) {
  return `${agent.role}`;
}

function activeAgentId(pathname) {
  const m = pathname.match(/^\/agents\/([^/]+)/);
  return m?.[1] || "nexus";
}

function activeTab(pathname) {
  const m = pathname.match(/^\/agents\/[^/]+\/([^/]+)$/);
  return m?.[1] || "overview";
}

export default function Layout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [notifOpen, setNotifOpen] = useState(false);

  const currentAgent = activeAgentId(location.pathname);
  const currentTab = activeTab(location.pathname);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setPaletteOpen(false);
        setNotifOpen(false);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const notifications = useMemo(
    () => [
      { id: "n1", text: "Sentinel: Suspicious login attempt blocked", agentId: "sentinel", tab: "chat" },
      { id: "n2", text: "Atlas: Workflow bottleneck detected", agentId: "atlas", tab: "dashboard" },
      { id: "n3", text: "Centsible: Budget variance exceeds threshold", agentId: "centsible", tab: "dashboard" },
    ],
    []
  );

  const paletteItems = useMemo(() => {
    const q = query.toLowerCase().trim();
    const agentMatches = ROSTER.filter((a) => !q || a.name.toLowerCase().includes(q) || a.role.toLowerCase().includes(q));
    const commandMatches = [];
    if (q.startsWith("@")) {
      const name = q.slice(1).trim();
      ROSTER.filter((a) => a.name.toLowerCase().includes(name)).forEach((a) => {
        commandMatches.push({ id: `cmd-${a.id}`, label: `@${a.name}`, action: () => navigate(`/agents/${a.id}`) });
        commandMatches.push({ id: `cmd-${a.id}-chat`, label: `@${a.name} chat`, action: () => navigate(`/agents/${a.id}/chat`) });
      });
    }
    return { agentMatches, commandMatches };
  }, [query, navigate]);

  const sidebar = (
    <aside className={`h-full bg-white border-r border-slate-200 flex flex-col ${collapsed ? "w-20" : "w-60"}`}>
      <div className="h-16 border-b border-slate-200 flex items-center px-4 justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Command className="w-5 h-5 text-blue-600" />
          {!collapsed && <span className="font-semibold text-slate-900">Jarvis OS</span>}
        </Link>
        <button onClick={() => setCollapsed((v) => !v)} className="text-slate-500 hover:text-slate-900">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      <nav className="p-3 overflow-y-auto">
        <Link to="/" className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm mb-2 ${currentAgent === "nexus" ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}>
          <Home className="w-4 h-4" /> {!collapsed && <span>Home</span>}
        </Link>
        <Link to="/BusinessProfile" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm mb-2 text-slate-600 hover:bg-slate-50">
          <Building2 className="w-4 h-4" /> {!collapsed && <span>Business Profile</span>}
        </Link>

        {ROSTER.filter((a) => a.id !== "nexus").map((agent) => {
          const Icon = agent.icon;
          const active = currentAgent === agent.id;
          return (
            <Link
              key={agent.id}
              to={`/agents/${agent.id}${currentTab !== "overview" ? `/${currentTab}` : ""}`}
              title={roleTooltip(agent)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${active ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <Icon className={`w-4 h-4 ${agent.color}`} />
              {!collapsed && <span>{agent.name}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      <div className="hidden md:block fixed inset-y-0 left-0 z-30">{sidebar}</div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setMobileOpen(false)}>
          <div className="w-72 h-full" onClick={(e) => e.stopPropagation()}>{sidebar}</div>
        </div>
      )}

      <div className={`flex-1 ${collapsed ? "md:ml-20" : "md:ml-60"}`}>
        <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button className="md:hidden text-slate-600" onClick={() => setMobileOpen(true)}><Menu className="w-5 h-5" /></button>
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden sm:flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-500 hover:border-slate-300"
            >
              <Search className="w-4 h-4" /> Search or command
              <span className="ml-2 text-xs text-slate-400">Ctrl+K</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <button className="relative p-2 rounded-full hover:bg-slate-100" onClick={() => setNotifOpen((v) => !v)}>
                <Bell className="w-5 h-5 text-slate-600" />
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-600 text-white text-[10px] rounded-full flex items-center justify-center">{notifications.length}</span>
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg p-2">
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-sm text-slate-700"
                      onClick={() => {
                        setNotifOpen(false);
                        navigate(`/agents/${n.agentId}/${n.tab}`);
                      }}
                    >
                      {n.text}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="p-2 rounded-full hover:bg-slate-100"><User className="w-5 h-5 text-slate-600" /></button>
          </div>
        </header>

        <main>{children}</main>
      </div>

      {paletteOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center pt-20 px-4" onClick={() => setPaletteOpen(false)}>
          <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 border-b border-slate-200">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search agents or type @Maestro chat"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm"
              />
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {paletteItems.commandMatches.map((item) => (
                <button key={item.id} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-sm" onClick={() => { item.action(); setPaletteOpen(false); }}>
                  {item.label}
                </button>
              ))}
              {paletteItems.agentMatches.map((agent) => (
                <button key={agent.id} className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-sm flex items-center gap-2" onClick={() => { navigate(`/agents/${agent.id}`); setPaletteOpen(false); }}>
                  <agent.icon className={`w-4 h-4 ${agent.color}`} /> {agent.name}
                  <span className="text-xs text-slate-500">{agent.role}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

