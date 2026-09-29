import React, { useState, useEffect, useRef } from 'react';
import { useAuth, apiFetch } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { useTheme } from '../context/ThemeContext';
import { User, Shield, Layout, Settings2, Database, Trash2, LogOut, Coffee, Moon, Flame, Smile, AlertTriangle, Sun, Camera, Check, X, Copy, Loader, Edit2 } from 'lucide-react';
import { validateImage, uploadImage, getOptimizedUrl } from '../services/cloudinaryService';
import useDocumentTitle from '../hooks/useDocumentTitle';

const GENRES = [
  'Action', 'Adventure', 'Animation', 'Children', 'Comedy', 'Crime',
  'Documentary', 'Drama', 'Fantasy', 'Film-Noir', 'Horror', 'IMAX',
  'Musical', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'War', 'Western'
];

const LANGUAGES = ['English', 'Hindi', 'Spanish', 'French', 'Korean', 'Japanese', 'German', 'Italian', 'Portuguese', 'Arabic'];

const MOODS = [
  { key: 'Light', icon: Coffee, desc: 'Feel-good, easy watching' },
  { key: 'Dark', icon: Moon, desc: 'Intense, thought-provoking' },
  { key: 'Thriller-heavy', icon: Flame, desc: 'Edge of your seat' },
  { key: 'Comedy-heavy', icon: Smile, desc: 'Laughs only' }
];

const Settings = () => {
  const { user, token, logout, updateUser } = useAuth();
  const { preferences, updatePreferences } = usePreferences();
  const { toggleTheme, isDark } = useTheme();
  useDocumentTitle('Settings');

  const [activeTab, setActiveTab] = useState('account');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Section 1: Account
  const [username, setUsername] = useState(user?.username || '');
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [editedUsername, setEditedUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user?.username) setUsername(user.username);
  }, [user?.username]);

  const handleAvatarClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validation = validateImage(file);
    if (!validation.valid) {
      setUploadError(validation.error);
      return;
    }

    setIsUploading(true);
    setUploadError('');
    try {
      const url = await uploadImage(file);
      const optimizedUrl = getOptimizedUrl(url);

      await apiFetch('/api/users/profile', {
        method: 'PUT',
        body: JSON.stringify({ avatar_url: optimizedUrl })
      }, token);

      updateUser({ avatar_url: optimizedUrl });
    } catch {
      setUploadError("Upload failed. Try again.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const copyEmail = () => {
    if (!user?.email) return;
    navigator.clipboard.writeText(user.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Section 2: UI
  const [cardSize, setCardSize] = useState(localStorage.getItem('cardSize') || 'Comfortable');

  // Section 3: Recommendations
  const [genres, setGenres] = useState(new Set(preferences?.preferred_genres || []));
  const [languages, setLanguages] = useState(new Set(preferences?.favorite_languages || []));
  const [contentType, setContentType] = useState(preferences?.content_type || 'Movies');
  const [runtime, setRuntime] = useState(preferences?.runtime_preference || 'Medium');
  const [mood, setMood] = useState(preferences?.mood_preference || 'Light');

  // Section 4: Privacy
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const showMsg = (msg, isErr = false) => {
    isErr ? setErrorMsg(msg) : setSuccessMsg(msg);
    setTimeout(() => { setErrorMsg(''); setSuccessMsg(''); }, 3000);
  };

  const handleAccountSave = async () => {
    if (newPassword && newPassword !== confirmPassword) {
      return showMsg("New passwords don't match", true);
    }
    const usernameChanged = username !== user?.username;
    const passwordAttempt = !!(currentPassword && newPassword);

    if (!usernameChanged && !passwordAttempt) {
      return showMsg("No changes to save");
    }

    setIsSaving(true);
    try {
      const body = {};
      if (usernameChanged) body.username = username;
      if (passwordAttempt) {
        body.current_password = currentPassword;
        body.new_password = newPassword;
      }

      const res = await apiFetch('/api/users/profile', { method: 'PUT', body: JSON.stringify(body) }, token);

      if (usernameChanged && res.data) updateUser({ username: res.data.username });

      showMsg('Changes saved!');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      showMsg(err.message || 'Failed to update account', true);
    } finally {
      setIsSaving(false);
    }
  };

  const getInitials = (name) => name ? name.charAt(0).toUpperCase() : '?';

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const handleCardSizeChange = (size) => {
    setCardSize(size);
    localStorage.setItem('cardSize', size);
  };

  const handlePrefSave = async () => {
    try {
      await updatePreferences({
        preferred_genres: Array.from(genres),
        favorite_languages: Array.from(languages),
        content_type: contentType,
        runtime_preference: runtime,
        mood_preference: mood
      });
      showMsg('Preferences saved!');
    } catch {
      showMsg('Failed to save preferences', true);
    }
  };

  const toggleSet = (set, setFn, item) => {
    const nextSet = new Set(set);
    if (nextSet.has(item)) nextSet.delete(item);
    else nextSet.add(item);
    setFn(nextSet);
  };

  const handleResetData = async () => {
    if (window.confirm("Are you sure you want to reset all recommendation data? You will have to do onboarding again.")) {
      try {
        await apiFetch('/api/users/ratings', { method: 'DELETE' }, token);
        await updatePreferences({ onboarding_complete: false });
        window.location.href = '/';
      } catch {
        showMsg("Failed to reset data", true);
      }
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== user?.username) {
      return showMsg("Username does not match", true);
    }
    if (window.confirm("Are you sure you want to permanently delete your account? This action is immediate and cannot be undone.")) {
      try {
        await apiFetch('/api/users/profile', { method: 'DELETE' }, token);
        localStorage.clear();
        window.location.href = '/';
      } catch {
        showMsg("Failed to delete account", true);
      }
    }
  };

  const tabItems = [
    { key: 'account', label: 'Account', icon: User },
    { key: 'ui', label: 'UI Preferences', icon: Layout },
    { key: 'prefs', label: 'Recommendations', icon: Settings2 },
    { key: 'data', label: 'Data & Privacy', icon: Database },
  ];

  // ── Shared styling ──────────────────────────────────────────────────────
  const inputClass = 'w-full bg-ink border border-line rounded-sm px-md h-control text-body text-fg focus:border-accent transition-colors duration-fast outline-none';
  const fieldLabel = 'block label text-fg-muted mb-xs';
  const chipClass = (active) => `px-sm h-control-sm rounded-xs text-small font-medium border transition-colors duration-fast ${active
    ? 'bg-accent border-accent text-accent-ink'
    : 'bg-transparent border-line text-fg-muted hover:text-fg hover:border-line-strong'}`;
  const segmentClass = (active) => `flex-1 h-control rounded-xs text-small font-medium border transition-colors duration-fast ${active
    ? 'bg-fg border-fg text-ink'
    : 'bg-transparent border-line text-fg-muted hover:text-fg hover:border-line-strong'}`;
  const panelHeading = (index, title, action) => (
    <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-sm border-b border-line pb-md mb-xl">
      <div>
        <div className="label text-fg-subtle mb-xs"><span className="text-accent">{index}</span> / Settings</div>
        <h2 className="font-display text-section text-fg tracking-tight">{title}</h2>
      </div>
      {action}
    </div>
  );
  // Column-count preview for each card size
  const sizePreview = { Compact: 7, Comfortable: 5, Large: 4 };

  return (
    <div className="px-gutter py-xl">
      <header className="mb-xl animate-rise">
        <div className="label text-fg-subtle mb-sm"><span className="text-accent">05</span> / Preferences</div>
        <h1 className="font-display text-display text-fg tracking-tightest">Settings</h1>
      </header>

      <div className="flex flex-col md:flex-row gap-lg md:gap-2xl">
        {/* Sidebar — becomes horizontal scrollable tabs on mobile */}
        <nav className="w-full md:w-settings-nav shrink-0" aria-label="Settings sections">
          <div className="flex md:flex-col gap-2xs overflow-x-auto no-scrollbar border-b md:border-b-0 border-line">
            {/* eslint-disable-next-line no-unused-vars -- Icon is rendered as <Icon /> */}
            {tabItems.map(({ key, label, icon: Icon }, i) => {
              const active = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`group relative flex items-center gap-sm px-sm py-sm rounded-sm transition-colors duration-fast font-medium text-small whitespace-nowrap shrink-0 ${active
                    ? 'text-fg md:bg-surface'
                    : 'text-fg-muted hover:text-fg hover:bg-surface'
                    }`}
                >
                  <span className={`absolute transition-colors duration-fast inset-x-sm bottom-0 h-rule md:left-0 md:right-auto md:top-xs md:bottom-xs md:h-auto md:w-rule ${active ? 'bg-accent' : 'bg-transparent'}`} aria-hidden="true" />
                  <span className={`hidden md:inline font-mono text-micro tabular-nums ${active ? 'text-accent' : 'text-fg-subtle'}`}>{String(i + 1).padStart(2, '0')}</span>
                  <Icon size={16} strokeWidth={1.75} className={active ? 'text-accent' : 'text-fg-subtle group-hover:text-fg-muted'} />
                  {label}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Main Content */}
        <div className="flex-1 min-w-0 max-w-panel">
          <div className="relative min-h-panel-min transition-colors duration-base">

            {/* Status Messages */}
            {successMsg && (
              <div className="fixed bottom-dock-clearance right-gutter lg:bottom-xl lg:right-xl bg-surface-raised border border-positive/50 border-l-rule border-l-positive text-fg px-md py-sm rounded-sm text-small font-medium z-toast shadow-lift animate-rise flex items-center gap-xs" role="status">
                <Check size={16} className="text-positive" />
                {successMsg}
              </div>
            )}
            {errorMsg && (
              <div className="fixed bottom-dock-clearance right-gutter lg:bottom-xl lg:right-xl bg-surface-raised border border-negative/50 border-l-rule border-l-negative text-fg px-md py-sm rounded-sm text-small font-medium z-toast shadow-lift animate-rise flex items-center gap-xs" role="alert">
                <AlertTriangle size={16} className="text-negative" />
                {errorMsg}
              </div>
            )}

            {/* Account Settings */}
            {activeTab === 'account' && (
              <div className="animate-fade">
                {panelHeading('01', 'Account')}

                {/* Profile Card Area Component */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-lg pb-xl border-b border-line">

                  {/* Avatar Section */}
                  <div className="flex flex-col items-center">
                    <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                    <div
                      onClick={handleAvatarClick}
                      className="relative group size-avatar-lg lg:size-avatar-xl rounded-full overflow-hidden cursor-pointer bg-accent flex items-center justify-center shrink-0 border border-line-strong"
                    >
                      {isUploading ? (
                        <div className="absolute inset-0 bg-scrim flex items-center justify-center z-raised">
                          <Loader className="size-xl text-accent animate-spin" />
                        </div>
                      ) : null}

                      {user?.avatar_url ? (
                        <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-display text-display text-accent-ink">{getInitials(user?.username)}</span>
                      )}

                      <div className="absolute inset-0 bg-scrim-soft opacity-0 group-hover:opacity-100 transition-opacity duration-fast flex items-center justify-center w-full h-full">
                        <Camera className="size-xl text-on-image" />
                      </div>
                    </div>
                    <div className="mt-xs label text-fg-subtle text-center">Click to change photo</div>
                    {uploadError && <div className="mt-2xs text-caption text-negative font-medium text-center">{uploadError}</div>}
                  </div>

                  {/* Info Section */}
                  <div className="flex flex-col sm:flex-row w-full justify-between items-center sm:items-start pt-xs gap-md sm:gap-0">
                    <div className="flex flex-col w-full text-center sm:text-left min-w-0">
                      {/* Username Row */}
                      <div className="mb-xs min-h-control flex flex-wrap items-center justify-center sm:justify-start">
                        {isEditingUsername ? (
                          <div className="flex items-center gap-xs">
                            <input
                              type="text"
                              autoFocus
                              value={editedUsername}
                              onChange={(e) => setEditedUsername(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  setUsername(editedUsername);
                                  setIsEditingUsername(false);
                                } else if (e.key === 'Escape') {
                                  setIsEditingUsername(false);
                                }
                              }}
                              className="bg-ink border border-accent rounded-sm px-sm h-control text-fg outline-none w-field-sm text-lead font-semibold"
                            />
                            <button onClick={() => { setUsername(editedUsername); setIsEditingUsername(false); }} className="flex items-center justify-center size-control-sm text-positive hover:bg-positive/15 rounded-xs transition-colors duration-fast" aria-label="Confirm username"><Check size={18} /></button>
                            <button onClick={() => setIsEditingUsername(false)} className="flex items-center justify-center size-control-sm text-fg-muted hover:bg-surface-hover rounded-xs transition-colors duration-fast" aria-label="Cancel"><X size={18} /></button>
                          </div>
                        ) : (
                          <h3 className="font-display text-heading text-fg tracking-tight truncate">{username}</h3>
                        )}
                      </div>

                      {/* Email Row */}
                      <div className="flex items-center justify-center sm:justify-start gap-xs font-mono text-caption mb-sm">
                        <span
                          onClick={copyEmail}
                          className="text-fg-muted cursor-pointer hover:text-fg transition-colors duration-fast truncate"
                        >
                          {user?.email}
                        </span>
                        <button
                          onClick={copyEmail}
                          className="flex items-center justify-center size-control-sm text-fg-subtle hover:text-fg hover:bg-surface-hover rounded-xs transition-colors duration-fast"
                          title="Copy Email"
                        >
                          {copied ? <Check size={14} className="text-positive" /> : <Copy size={14} />}
                        </button>
                        {copied && <span className="text-micro text-positive font-medium animate-fade">Copied!</span>}
                      </div>

                      {/* Join Date */}
                      <div className="label text-fg-subtle">
                        Member since {formatDate(user?.created_at)}
                      </div>
                    </div>

                    {/* Edit Profile Button (Right side) */}
                    {!isEditingUsername && (
                      <button
                        onClick={() => { setEditedUsername(username); setIsEditingUsername(true); }}
                        className="px-md h-control border border-line-strong rounded-sm text-small font-medium text-fg hover:border-accent hover:text-accent transition-colors duration-fast flex items-center gap-xs whitespace-nowrap"
                      >
                        <Edit2 size={14} />
                        Edit Profile
                      </button>
                    )}
                  </div>
                </div>

                {/* Change Password Area */}
                <div className="pt-xl space-y-lg">
                  <h3 className="font-display text-title text-fg">Change Password</h3>

                  <div className="space-y-md max-w-prose">
                    <div>
                      <label className={fieldLabel}>Current Password</label>
                      <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={inputClass} />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-md">
                      <div className="flex-1">
                        <label className={fieldLabel}>New Password</label>
                        <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputClass} />
                      </div>
                      <div className="flex-1">
                        <label className={fieldLabel}>Confirm New Password</label>
                        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputClass} />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleAccountSave}
                    disabled={isSaving}
                    className="w-full sm:w-auto px-lg h-control bg-accent text-accent-ink font-semibold text-small rounded-sm hover:bg-accent-strong transition-colors duration-fast flex items-center justify-center gap-xs disabled:opacity-muted disabled:cursor-not-allowed"
                  >
                    {isSaving ? <Loader className="size-md animate-spin" /> : null}
                    Save Changes
                  </button>
                </div>

              </div>
            )}

            {/* UI Settings */}
            {activeTab === 'ui' && (
              <div className="animate-fade">
                {panelHeading('02', 'Interface Customization')}

                <div className="space-y-xl">
                  {/* Theme Toggle */}
                  <div className="flex items-center justify-between gap-md py-md border-b border-line">
                    <div className="flex items-center gap-md">
                      <div className="flex items-center justify-center size-control-lg rounded-sm border border-line text-accent">
                        {isDark ? <Moon size={20} strokeWidth={1.75} /> : <Sun size={20} strokeWidth={1.75} />}
                      </div>
                      <div>
                        <div className="text-fg font-semibold text-body">{isDark ? 'Dark Mode' : 'Light Mode'}</div>
                        <div className="text-small text-fg-muted">{isDark ? 'Easy on the eyes for night viewing' : 'Bright and clean daytime interface'}</div>
                      </div>
                    </div>

                    {/* Toggle switch */}
                    <button
                      onClick={toggleTheme}
                      role="switch"
                      aria-checked={isDark}
                      className={`relative inline-flex w-3xl h-xl p-2xs items-center rounded-full border transition-colors duration-base shrink-0 ${isDark ? 'bg-accent border-accent' : 'bg-surface-hover border-line-strong'}`}
                      aria-label="Toggle theme"
                    >
                      <span
                        className={`inline-flex items-center justify-center size-lg rounded-full transition-transform duration-base ease-out ${isDark
                          ? 'translate-x-xl bg-accent-ink text-accent'
                          : 'translate-x-0 bg-fg text-ink'
                          }`}
                      >
                        {isDark ? <Moon size={12} /> : <Sun size={12} />}
                      </span>
                    </button>
                  </div>

                  <div className="space-y-sm">
                    <label className="label text-fg-muted">Movie Card Size</label>
                    <div className="grid grid-cols-3 gap-xs">
                      {['Compact', 'Comfortable', 'Large'].map(size => {
                        const active = cardSize === size;
                        return (
                          <button
                            key={size}
                            onClick={() => handleCardSizeChange(size)}
                            aria-pressed={active}
                            className={`flex flex-col items-stretch gap-sm p-sm rounded-sm border text-small font-medium transition-colors duration-fast ${active ? 'border-accent bg-accent-wash text-fg' : 'border-line text-fg-muted hover:text-fg hover:border-line-strong'}`}
                          >
                            <span className="flex gap-3xs h-lg" aria-hidden="true">
                              {Array.from({ length: sizePreview[size] }).map((_, i) => (
                                <span key={i} className={`flex-1 rounded-xs ${active ? 'bg-accent' : 'bg-line-strong'}`} />
                              ))}
                            </span>
                            {size}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Recommendation Settings */}
            {activeTab === 'prefs' && (
              <div className="animate-fade">
                {panelHeading('03', 'Recommendation Preferences',
                  <button onClick={handlePrefSave} className="px-md h-control bg-accent text-accent-ink font-semibold rounded-sm hover:bg-accent-strong transition-colors duration-fast text-small">Save Preferences</button>
                )}

                <div className="space-y-xl">
                  <div className="space-y-sm">
                    <label className="label text-fg-muted">Preferred Genres</label>
                    <div className="flex flex-wrap gap-xs">
                      {GENRES.map(g => (
                        <button key={g} onClick={() => toggleSet(genres, setGenres, g)} aria-pressed={genres.has(g)} className={chipClass(genres.has(g))}>
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-sm">
                    <label className="label text-fg-muted">Preferred Languages</label>
                    <div className="flex flex-wrap gap-xs">
                      {LANGUAGES.map(l => (
                        <button key={l} onClick={() => toggleSet(languages, setLanguages, l)} aria-pressed={languages.has(l)} className={chipClass(languages.has(l))}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-lg">
                    <div className="flex-1 space-y-sm">
                      <label className="label text-fg-muted">Content Type</label>
                      <div className="flex gap-xs">
                        {['Movies', 'Series', 'Both'].map(type => (
                          <button key={type} onClick={() => setContentType(type)} className={segmentClass(contentType === type)}>
                            {type}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="flex-1 space-y-sm">
                      <label className="label text-fg-muted">Runtime</label>
                      <div className="flex gap-xs">
                        {['Short', 'Medium', 'Long'].map(rt => (
                          <button key={rt} onClick={() => setRuntime(rt)} className={segmentClass(runtime === rt)}>
                            {rt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-sm">
                    <label className="label text-fg-muted">Mood Bias</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-xs">
                      {/* eslint-disable-next-line no-unused-vars -- Icon is rendered as <Icon /> */}
                      {MOODS.map(({ key, icon: Icon }) => (
                        <button key={key} onClick={() => setMood(key)} aria-pressed={mood === key} className={`p-sm text-left rounded-sm transition-colors duration-fast border flex gap-sm items-center ${mood === key ? 'bg-accent-wash border-accent' : 'bg-transparent border-line hover:border-line-strong'}`}>
                          <Icon size={18} strokeWidth={1.75} className={mood === key ? 'text-accent' : 'text-fg-subtle'} />
                          <div>
                            <div className={`text-small font-semibold ${mood === key ? 'text-fg' : 'text-fg-muted'}`}>{key}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Data & Privacy */}
            {activeTab === 'data' && (
              <div className="animate-fade">
                {panelHeading('04', 'Data & Privacy Control')}

                <div className="space-y-lg">
                  <div className="p-lg rounded-sm border border-line border-l-rule border-l-brass">
                    <div className="flex flex-col sm:flex-row items-start gap-md">
                      <AlertTriangle size={20} className="text-brass shrink-0" />
                      <div>
                        <h3 className="font-display text-title text-fg pb-2xs">Reset AI Recommendations</h3>
                        <p className="text-small text-fg-muted mb-md">This will delete all your ratings and watched history. You will be asked to complete the onboarding flow again.</p>
                        <button onClick={handleResetData} className="px-md h-control border border-brass text-brass rounded-sm text-small font-semibold hover:bg-brass hover:text-ink transition-colors duration-fast">Reset All Feedback Data</button>
                      </div>
                    </div>
                  </div>

                  <div className="p-lg rounded-sm border border-line border-l-rule border-l-negative">
                    <div className="flex flex-col sm:flex-row items-start gap-md">
                      <Shield size={20} className="text-negative shrink-0" />
                      <div className="w-full">
                        <h3 className="font-display text-title text-fg pb-2xs">Delete Account</h3>
                        <p className="text-small text-fg-muted mb-md">Permanently and immediately delete your account and all associated data. This action cannot be undone.</p>

                        <div className="flex flex-col sm:flex-row gap-sm items-stretch sm:items-center">
                          <input
                            type="text"
                            placeholder="Type your username to confirm"
                            value={deleteConfirm}
                            onChange={e => setDeleteConfirm(e.target.value)}
                            className="flex-1 min-w-0 bg-ink border border-negative/40 rounded-sm px-md h-control text-fg focus:border-negative outline-none font-mono text-small placeholder:text-fg-subtle"
                          />
                          <button
                            onClick={handleDeleteAccount}
                            disabled={deleteConfirm !== user?.username}
                            className="px-md h-control bg-negative text-ink rounded-sm text-small font-semibold hover:opacity-muted disabled:opacity-disabled disabled:cursor-not-allowed transition-opacity duration-fast whitespace-nowrap"
                          >
                            Delete Account
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-lg border-t border-line flex">
                    <button onClick={logout} className="flex items-center gap-xs px-md h-control border border-line-strong rounded-sm font-semibold text-small text-fg hover:border-accent hover:text-accent transition-colors duration-fast ml-auto mr-0">
                      <LogOut size={16} /> Log out
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
