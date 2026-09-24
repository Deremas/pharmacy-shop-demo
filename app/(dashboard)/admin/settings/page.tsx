"use client";

import React, { useState, useEffect } from "react";
import {
  Globe,
  Bell,
  Palette,
  Database,
  Shield,
  Save,
  CheckCircle,
  AlertTriangle,
  Upload,
  Download,
  RefreshCw,
  Moon,
  Sun,
  Laptop,
} from "lucide-react";
import { useAppData } from "@/lib/client/useAppData";
import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { NumericInput } from "@/components/numeric-input";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";

type TabId = "company" | "theme" | "notifications" | "data" | "security";

export default function SystemSettingsPage() {
  const { settings, updateSettings, currentLocation } = useAppData();
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<TabId>("company");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);

  // Local Form state (Company Profile)
  const [companyName, setCompanyName] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [currency, setCurrency] = useState("ETB");
  const [taxRate, setTaxRate] = useState(15);

  // Local Form state (Notifications)
  const [lowStockThreshold, setLowStockThreshold] = useState(10);
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [enableEmailAlerts, setEnableEmailAlerts] = useState(false);

  // Local Form state (Security Policies)
  const [passwordStrength, setPasswordStrength] = useState("Medium");
  const [sessionTimeout, setSessionTimeout] = useState("24 Hours");
  const [require2FA, setRequire2FA] = useState(false);

  // Load settings into local state on mount or change
  useEffect(() => {
    if (settings) {
      setCompanyName(settings.companyName || "");
      setCompanyEmail(settings.companyEmail || "");
      setCompanyPhone(settings.companyPhone || "");
      setCompanyAddress(settings.companyAddress || "");
      setCurrency(settings.currency || "ETB");
      setTaxRate(settings.taxRate ?? 15);
      setLowStockThreshold(settings.lowStockThreshold ?? 10);
      setEnableNotifications(settings.enableNotifications ?? true);
      setEnableEmailAlerts(settings.enableEmailAlerts ?? false);
      setPasswordStrength(settings.passwordStrength || "Medium");
      setSessionTimeout("24 Hours");
      setRequire2FA(settings.require2FA ?? false);
    }
  }, [settings]);

  // Toast timer
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSettings({ companyName, companyEmail, companyPhone, companyAddress, currency, taxRate: Number(taxRate) });
      setToast({ message: "Company profile settings saved successfully!", type: "success" });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Settings could not be saved.", type: "error" });
    }
  };

  const handleSaveNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSettings({
        lowStockThreshold: Number(lowStockThreshold),
        enableNotifications,
        enableEmailAlerts,
      });
      setToast({ message: "Notification threshold rules updated!", type: "success" });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Notification settings could not be saved.", type: "error" });
    }
  };

  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateSettings({ passwordStrength, require2FA });
      setToast({ message: "Security preferences saved. Login sessions remain fixed at 24 hours.", type: "success" });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Security preferences could not be saved.", type: "error" });
    }
  };

  // Backup / Restore logic
  const handleExport = async () => {
    try {
      const response = await fetch("/api/app", { cache: "no-store" });
      if (!response.ok) throw new Error("Export failed.");
      const data = await response.json();
      const blob = new Blob(
        [
          JSON.stringify(
            { exportedAt: new Date().toISOString(), data },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pharmacy_export_${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setToast({
        message: "Current database snapshot exported.",
        type: "success",
      });
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "Export failed.",
        type: "error",
      });
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.target.value = "";
    setToast({
      message:
        "Restore is disabled for production. Use database migrations or a verified server restore.",
      type: "error",
    });
  };

  const handleResetApp = () => {
    if (
      window.confirm(
        "This signs out of this browser. Production data remains in the database.",
      )
    ) {
      setToast({
        message: "Signed out. Redirecting to login...",
        type: "success",
      });
      setTimeout(() => {
        signOut({ callbackUrl: "/login" });
      }, 1500);
    }
  };

  const tabs = [
    { id: "company", label: "Company Profile", icon: Globe },
    { id: "theme", label: "App Theme", icon: Palette },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "data", label: "Data Management", icon: Database },
    { id: "security", label: "Security Policies", icon: Shield },
  ] as const;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-5xl pb-12 relative">
      {/* Toast popup */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-xl border text-sm font-bold ${
              toast.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50"
                : "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-400 border-rose-200 dark:border-rose-900/50"
            }`}
          >
            <CheckCircle className="w-5 h-5" />
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
          System Settings
        </h1>
        <p className="text-slate-500 mt-1 font-bold text-xs uppercase tracking-wider">
          Company profile for {currentLocation?.name || "the active business"}. Theme and security apply to the whole login.
        </p>
      </div>

      {/* Tabbed interface layout */}
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8 items-start">
        {/* Left Side: Tabs Selection */}
        <div className="flex flex-col gap-1.5 bg-white dark:bg-zinc-900 p-3 rounded-[2rem] border border-slate-200 dark:border-zinc-800 shadow-sm">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 text-xs font-black uppercase tracking-wider rounded-xl text-left transition-all",
                  active
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/10"
                    : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800/55 hover:text-slate-900 dark:hover:text-white",
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right Side: Tab Contents */}
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2.5rem] p-8 shadow-sm min-h-[460px]">
          {/* Company Profile Tab */}
          {activeTab === "company" && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 dark:border-zinc-800 pb-4">
                <h3 className="text-md font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Company Details
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Configure company and transactional metadata
                </p>
              </div>

              <form onSubmit={handleSaveCompany} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest px-1">
                      Pharmacy Name
                    </label>
                    <input
                      type="text"
                      required
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest px-1">
                      Pharmacy Email
                    </label>
                    <input
                      type="email"
                      required
                      value={companyEmail}
                      onChange={(e) => setCompanyEmail(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest px-1">
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      required
                      value={companyPhone}
                      onChange={(e) => setCompanyPhone(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest px-1">
                      Currency Code
                    </label>
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-900 dark:text-white cursor-pointer"
                    >
                      <option value="ETB">ETB (Ethiopian Birr)</option>
                      <option value="USD">USD (US Dollar)</option>
                      <option value="EUR">EUR (Euro)</option>
                      <option value="GBP">GBP (British Pound)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest px-1">
                      Tax Rate (%)
                    </label>
                    <NumericInput
                      required
                      value={taxRate}
                      onValueChange={setTaxRate}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest px-1">
                      Pharmacy Address
                    </label>
                    <input
                      type="text"
                      required
                      value={companyAddress}
                      onChange={(e) => setCompanyAddress(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-505 active:scale-95 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-500/20 transition-all"
                  >
                    <Save className="w-4 h-4" />
                    Save Settings
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* App Theme Tab */}
          {activeTab === "theme" && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 dark:border-zinc-800 pb-4">
                <h3 className="text-md font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  App Theme
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Choose default layout skin mode
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
                <ThemeCard
                  label="Light"
                  icon={Sun}
                  active={theme === "light"}
                  onClick={() => setTheme("light")}
                />
                <ThemeCard
                  label="Dark"
                  icon={Moon}
                  active={theme === "dark"}
                  onClick={() => setTheme("dark")}
                />
                <ThemeCard
                  label="System"
                  icon={Laptop}
                  active={theme === "system"}
                  onClick={() => setTheme("system")}
                />
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === "notifications" && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 dark:border-zinc-800 pb-4">
                <h3 className="text-md font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Notification Rules
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Configure warning levels and automation
                </p>
              </div>

              <form onSubmit={handleSaveNotifications} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest px-1">
                    Global Low Stock Threshold
                  </label>
                  <NumericInput
                    required
                    value={lowStockThreshold}
                    onValueChange={setLowStockThreshold}
                    className="w-full max-w-md px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-900 dark:text-white"
                  />
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide px-1">
                    System raises stock alerts when location items drop below
                    this number.
                  </p>
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-2xl">
                    <div className="text-left">
                      <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                        Enable In-App alerts
                      </p>
                      <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                        Show notifications in Topbar bell
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEnableNotifications(!enableNotifications)
                      }
                      className={cn(
                        "w-12 h-6.5 rounded-full p-1 transition-colors duration-200 shrink-0",
                        enableNotifications
                          ? "bg-indigo-600"
                          : "bg-slate-250 dark:bg-zinc-800",
                      )}
                    >
                      <div
                        className={cn(
                          "w-4.5 h-4.5 bg-white rounded-full transition-transform duration-200",
                          enableNotifications
                            ? "translate-x-5.5"
                            : "translate-x-0",
                        )}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-2xl">
                    <div className="text-left">
                      <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                        Enable Email Notifications
                      </p>
                      <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                        Send low-stock alerts to business email
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEnableEmailAlerts(!enableEmailAlerts)}
                      className={cn(
                        "w-12 h-6.5 rounded-full p-1 transition-colors duration-200 shrink-0",
                        enableEmailAlerts
                          ? "bg-indigo-600"
                          : "bg-slate-250 dark:bg-zinc-800",
                      )}
                    >
                      <div
                        className={cn(
                          "w-4.5 h-4.5 bg-white rounded-full transition-transform duration-200",
                          enableEmailAlerts
                            ? "translate-x-5.5"
                            : "translate-x-0",
                        )}
                      />
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-505 active:scale-95 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-500/20 transition-all"
                  >
                    <Save className="w-4 h-4" />
                    Save Notification Rules
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Data Management Tab */}
          {activeTab === "data" && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 dark:border-zinc-800 pb-4">
                <h3 className="text-md font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Database Operations
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Export system backup or reset app state
                </p>
              </div>

              <div className="space-y-6 pt-2">
                {/* Export Card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-[2rem] gap-4">
                  <div className="text-left">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                      <Download className="w-4 h-4 text-indigo-500" />
                      Backup Database
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                      Download local database configuration as a JSON file
                    </p>
                  </div>
                  <button
                    onClick={handleExport}
                    className="px-5 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 hover:border-indigo-500 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm"
                  >
                    Export Backup
                  </button>
                </div>

                {/* Import Card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-[2rem] gap-4">
                  <div className="text-left">
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                      <Upload className="w-4 h-4 text-indigo-500" />
                      Restore Database
                    </h4>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                      Upload a previously exported JSON backup file
                    </p>
                  </div>
                  <div className="relative">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImport}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      id="database-upload"
                    />
                    <label
                      htmlFor="database-upload"
                      className="inline-block px-5 py-3 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 hover:border-indigo-500 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer"
                    >
                      Import Backup
                    </label>
                  </div>
                </div>

                {/* Reset App Card */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-rose-50/30 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-950/20 rounded-[2rem] gap-4">
                  <div className="text-left">
                    <h4 className="text-xs font-black text-rose-800 dark:text-rose-400 uppercase tracking-tight flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-500" />
                      System Reset
                    </h4>
                    <p className="text-[10px] text-rose-700/80 dark:text-rose-400/60 font-bold uppercase tracking-wider mt-1">
                      Erase database records and revert defaults
                    </p>
                  </div>
                  <button
                    onClick={handleResetApp}
                    className="px-5 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-md shadow-rose-900/10"
                  >
                    Clear Database
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Security Policies Tab */}
          {activeTab === "security" && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 dark:border-zinc-800 pb-4">
                <h3 className="text-md font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Security & Auth Policies
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Configure password requirements and login security
                </p>
              </div>

              <form onSubmit={handleSaveSecurity} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest px-1">
                      Password Strength Requirements
                    </label>
                    <select
                      value={passwordStrength}
                      onChange={(e) => setPasswordStrength(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-900 dark:text-white cursor-pointer"
                    >
                      <option value="Low">Low (Any text)</option>
                      <option value="Medium">
                        Medium (Min 6 chars + numbers)
                      </option>
                      <option value="Strong">
                        Strong (Min 8 chars + caps + symbols)
                      </option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest px-1">
                      Inactivity Timeout Session
                    </label>
                    <select
                      value={sessionTimeout}
                      onChange={(e) => setSessionTimeout(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-900 dark:text-white cursor-pointer"
                    >
                      <option value="1 Hour">1 Hour</option>
                      <option value="4 Hours">4 Hours</option>
                      <option value="8 Hours">8 Hours (Default workday)</option>
                      <option value="24 Hours">24 Hours</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-800 rounded-2xl">
                  <div className="text-left">
                    <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">
                      Require 2-Factor Authentication (2FA)
                    </p>
                    <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">
                      Enforce simulated OTP verification on sign-in
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRequire2FA(!require2FA)}
                    className={cn(
                      "w-12 h-6.5 rounded-full p-1 transition-colors duration-200 shrink-0",
                      require2FA
                        ? "bg-indigo-600"
                        : "bg-slate-250 dark:bg-zinc-800",
                    )}
                  >
                    <div
                      className={cn(
                        "w-4.5 h-4.5 bg-white rounded-full transition-transform duration-200",
                        require2FA ? "translate-x-5.5" : "translate-x-0",
                      )}
                    />
                  </button>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    type="submit"
                    className="flex items-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-505 active:scale-95 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-500/20 transition-all"
                  >
                    <Save className="w-4 h-4" />
                    Save Policies
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ThemeCard({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: any;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "p-6 rounded-[2rem] border text-center cursor-pointer transition-all flex flex-col items-center gap-3 select-none",
        active
          ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500 text-indigo-600 dark:text-indigo-400 shadow-md"
          : "bg-slate-50 dark:bg-zinc-950 border-slate-100 dark:border-zinc-800 text-slate-500 hover:border-indigo-500/50",
      )}
    >
      <Icon className="w-7 h-7" />
      <span className="text-xs font-black uppercase tracking-wider">
        {label}
      </span>
    </div>
  );
}
