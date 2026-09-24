"use client";
 
import React, { useState, useEffect } from "react";
import { User, Shield, CheckCircle, MapPin, Lock, Save, KeyRound } from "lucide-react";
import { useAppData } from "@/lib/client/useAppData";
import { PasswordInput } from "@/components/password-input";
import { motion, AnimatePresence } from "motion/react";
import { useSession } from "next-auth/react";
 
export default function ProfilePage() {
  const { data: session } = useSession();
  const user = session?.user as any;
  const { users, updateUser, changePassword, locations, availableLocations } = useAppData();
  const assignedBusinesses = availableLocations?.length ? availableLocations : locations;
  
  // Profile Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  
  // Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // feedback states
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  
  // Populate form on load
  useEffect(() => {
    if (user) {
      // Find full info in users list if available
      const fullInfo = users.find((u) => u.id === user.id) || user;
      setFirstName(fullInfo.firstName || "");
      setLastName(fullInfo.lastName || "");
      setUsername(fullInfo.username || "");
      setPhone(fullInfo.phone || "");
    }
  }, [user, users]);
 
  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);
 
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-slate-500 font-bold">Please log in to view your profile.</div>
      </div>
    );
  }
 
  // Calculate password strength
  const getPasswordStrength = () => {
    if (!newPassword) return { score: 0, label: "None", color: "bg-slate-200" };
    let score = 0;
    if (newPassword.length >= 6) score += 1;
    if (newPassword.length >= 8) score += 1;
    if (/[A-Z]/.test(newPassword)) score += 1;
    if (/[0-9]/.test(newPassword)) score += 1;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 1;
 
    if (score <= 2) return { score, label: "Weak", color: "bg-rose-500" };
    if (score <= 4) return { score, label: "Medium", color: "bg-amber-500" };
    return { score, label: "Strong", color: "bg-emerald-500" };
  };
  
  const passwordStrength = getPasswordStrength();
 
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setToast({ message: "First and last names are required.", type: "error" });
      return;
    }
    
    const updatedUser = {
      ...user,
      id: user.id,
      firstName,
      lastName,
      username,
      phone,
      role: user.role,
      assignedLocations: user.assignedLocations,
    };
 
    try {
      await updateUser(updatedUser);
      setToast({ message: "Profile details updated successfully!", type: "success" });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Profile update failed.", type: "error" });
    }
  };
 
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    // If all are blank, do nothing except show a notice that previous was kept
    if (!currentPassword && !newPassword && !confirmPassword) {
      setToast({ message: "Password kept as is (no change).", type: "success" });
      return;
    }

    // If any is filled, they must all be filled
    if (!currentPassword || !newPassword || !confirmPassword) {
      setToast({ message: "Please fill out all password fields to update your password.", type: "error" });
      return;
    }

    if (newPassword.length < 4) {
      setToast({ message: "New password must be at least 4 characters long.", type: "error" });
      return;
    }

    if (newPassword !== confirmPassword) {
      setToast({ message: "Passwords do not match.", type: "error" });
      return;
    }

    try {
      await changePassword({ id: user.id, currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setToast({ message: "Password updated successfully!", type: "success" });
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : "Password update failed.", type: "error" });
    }
  };
 
  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl pb-12 relative">
      
      {/* Toast Alert Popups */}
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
 
      {/* Header Info */}
      <div>
        <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <User className="text-indigo-600 w-8 h-8" />
          My Profile
        </h1>
        <p className="text-slate-500 mt-1 font-bold text-xs uppercase tracking-wider">
          Manage your account credentials and system settings
        </p>
      </div>
 
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Side: Avatar/Summary & Permissions */}
        <div className="space-y-8">
          
          {/* Summary Card */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-8 shadow-sm flex flex-col items-center text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl" />
            
            <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center text-3xl font-black border border-indigo-100 dark:border-indigo-900 mb-4 select-none">
              {firstName.charAt(0).toUpperCase()}
              {lastName.charAt(0).toUpperCase()}
            </div>
 
            <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
              {firstName} {lastName}
            </h3>
            <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest mt-1 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full">
              {user.role}
            </p>
            <p className="text-[10px] font-mono text-slate-400 mt-3">ID: {user.id}</p>
          </div>
 
          {/* Permissions / Access Levels */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-6 shadow-sm space-y-4">
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-500" />
              Role Permissions
            </h4>
            <div className="space-y-2">
              {(user.permissions || []).slice(0, 12).map((permission: string) => (
                <PermissionItem key={permission} label={permission} active />
              ))}
              {(user.permissions || []).length === 0 && <PermissionItem label="No permissions assigned" active={false} />}
            </div>
          </div>
 
          {/* Location Assignments */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-6 shadow-sm space-y-4">
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <MapPin className="w-4 h-4 text-indigo-500" />
              Assigned Locations
            </h4>
            <div className="space-y-2">
              {user.assignedLocations.map((locId) => {
                const locObj = assignedBusinesses.find((l) => l.id === locId);
                return (
                  <div key={locId} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-100 dark:border-zinc-800">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <div className="text-left">
                      <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">{locObj?.name || locId}</p>
                      <p className="text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-widest">{locObj?.type || "SHOP"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
 
        </div>
 
        {/* Right Side: Editable Details */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Profile Form */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-8 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-zinc-800 pb-4 mb-6">
              <User className="text-slate-400 w-5 h-5" />
              <div>
                <h3 className="text-md font-black text-slate-900 dark:text-white uppercase tracking-tight">Personal Details</h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Update your public contact info</p>
              </div>
            </div>
 
            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest px-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-900 dark:text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest px-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-900 dark:text-white"
                  />
                </div>
              </div>
 
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest px-1">Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-900 dark:text-white"
                    placeholder="Enter custom username"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest px-1">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-900 dark:text-white"
                    placeholder="Enter phone number"
                  />
                </div>
              </div>
 
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-500/20 transition-all"
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </form>
          </div>
 
          {/* Password Form */}
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-[2rem] p-8 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-zinc-800 pb-4 mb-6">
              <KeyRound className="text-slate-400 w-5 h-5" />
              <div>
                <h3 className="text-md font-black text-slate-900 dark:text-white uppercase tracking-tight">Security Credentials</h3>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Update password for account security</p>
              </div>
            </div>
 
            <form onSubmit={handleUpdatePassword} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest px-1">Current Password <span className="text-slate-350 dark:text-slate-500 font-bold lowercase tracking-normal">(leave blank to keep previous)</span></label>
                <PasswordInput
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full pl-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-900 dark:text-white"
                  />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest px-1">New Password <span className="text-slate-350 dark:text-slate-500 font-bold lowercase tracking-normal">(leave blank to keep previous)</span></label>
                  <PasswordInput
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-900 dark:text-white"
                    />
                  
                  {/* Strength Bar */}
                  {newPassword && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-tight">Strength</span>
                        <span className="text-[9px] font-black uppercase tracking-tight text-slate-600 dark:text-slate-300">
                          {passwordStrength.label}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 dark:bg-zinc-950 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${passwordStrength.color} transition-all duration-300`}
                          style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest px-1">Confirm New Password <span className="text-slate-350 dark:text-slate-500 font-bold lowercase tracking-normal">(leave blank to keep previous)</span></label>
                  <PasswordInput
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-900 dark:text-white"
                  />
                </div>
              </div>
 
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="flex items-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-500/20 transition-all"
                >
                  <Lock className="w-4 h-4" />
                  Update Password
                </button>
              </div>
            </form>
          </div>
 
        </div>
      </div>
    </div>
  );
}
 
function PermissionItem({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between text-xs font-bold">
      <span className={active ? "text-slate-700 dark:text-zinc-200" : "text-slate-400 dark:text-zinc-600 line-through"}>
        {label}
      </span>
      <div className={`w-2 h-2 rounded-full ${active ? "bg-emerald-500" : "bg-slate-200 dark:bg-zinc-800"}`} />
    </div>
  );
}
