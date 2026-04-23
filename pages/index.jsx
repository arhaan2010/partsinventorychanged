import { db } from "../lib/firebase";
import {
  getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword,
  sendPasswordResetEmail, updatePassword, onAuthStateChanged,
  setPersistence, browserLocalPersistence, browserSessionPersistence,
} from "firebase/auth";
import { ref, onValue, push, update, remove } from "firebase/database";
import { useState, useEffect, useRef } from "react";

const auth = getAuth();

const CATEGORIES = ["Sensor", "Actuator", "Controller", "Power", "Structure", "Electronics", "Mechanical", "Other"];

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function friendlyError(code) {
  const map = {
    "auth/user-not-found":       "No account found with that email.",
    "auth/wrong-password":       "Incorrect password.",
    "auth/invalid-email":        "Invalid email address.",
    "auth/too-many-requests":    "Too many attempts. Try again later.",
    "auth/invalid-credential":   "Invalid email or password.",
    "auth/email-already-exists": "An account with that email already exists.",
    "auth/email-already-in-use": "An account with that email already exists.",
    "auth/weak-password":        "Password must be at least 6 characters.",
    "auth/network-request-failed": "Network error. Check your connection.",
  };
  return map[code] || "Something went wrong. Try again.";
}

function validate(fields) {
  const errors = {};
  if ("email" in fields && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email))
    errors.email = "Enter a valid email.";
  if ("password" in fields && fields.password.length < 6)
    errors.password = "At least 6 characters.";
  if ("name" in fields && !fields.name.trim())
    errors.name = "Name is required.";
  if ("confirm" in fields && fields.confirm !== fields.password)
    errors.confirm = "Passwords don't match.";
  return errors;
}

// ─────────────────────────────────────────
// AUTH SCREEN  (Login + Sign Up + Reset)
// ─────────────────────────────────────────
function AuthScreen({ onAuthSuccess }) {
  // "login" | "signup" | "reset"
  const [mode, setMode] = useState("login");

  // Login
  const [loginFields, setLoginFields] = useState({ email: "", password: "" });
  const [rememberMe, setRememberMe]   = useState(true);
  const [loginErrors, setLoginErrors] = useState({});
  const [loginGlobal, setLoginGlobal] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Sign Up
  const [signupFields, setSignupFields] = useState({ name: "", role: "", email: "", password: "", confirm: "" });
  const [signupErrors, setSignupErrors] = useState({});
  const [signupGlobal, setSignupGlobal] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);

  // Reset
  const [resetEmail, setResetEmail]   = useState("");
  const [resetSent, setResetSent]     = useState(false);
  const [resetError, setResetError]   = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const setLogin  = patch => setLoginFields(p => ({ ...p, ...patch }));
  const setSignup = patch => setSignupFields(p => ({ ...p, ...patch }));

  // ── Login ──
  const handleLogin = async (e) => {
    e?.preventDefault();
    const errs = validate({ email: loginFields.email, password: loginFields.password });
    setLoginErrors(errs);
    if (Object.keys(errs).length) return;
    setLoginGlobal(""); setLoginLoading(true);
    try {
      const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
      await setPersistence(auth, persistence);
      await signInWithEmailAndPassword(auth, loginFields.email.trim(), loginFields.password);
    } catch (err) {
      setLoginGlobal(friendlyError(err.code));
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Sign Up ──
  const handleSignup = async (e) => {
    e?.preventDefault();
    const errs = validate({
      name:     signupFields.name,
      email:    signupFields.email,
      password: signupFields.password,
      confirm:  signupFields.confirm,
    });
    setSignupErrors(errs);
    if (Object.keys(errs).length) return;
    setSignupGlobal(""); setSignupLoading(true);
    try {
      // Create Firebase Auth account
      const cred = await createUserWithEmailAndPassword(
        auth, signupFields.email.trim().toLowerCase(), signupFields.password
      );
      // Write member record — do this before the auth state listener fires
      await push(ref(db, "members"), {
        name:  signupFields.name.trim(),
        role:  signupFields.role.trim() || "Member",
        email: signupFields.email.trim().toLowerCase(),
        uid:   cred.user.uid,
      });
      // Auth listener in parent will pick up the new user automatically
    } catch (err) {
      setSignupGlobal(friendlyError(err.code));
      setSignupLoading(false);
    }
  };

  // ── Reset ──
  const handleReset = async (e) => {
    e?.preventDefault();
    if (!resetEmail.trim()) { setResetError("Enter your email."); return; }
    setResetError(""); setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetSent(true);
    } catch (err) {
      setResetError(friendlyError(err.code));
    } finally {
      setResetLoading(false);
    }
  };

  const switchMode = (m) => {
    setMode(m);
    setLoginErrors({}); setLoginGlobal("");
    setSignupErrors({}); setSignupGlobal("");
    setResetError(""); setResetSent(false);
  };

  return (
    <div style={ls.root}>
      <div style={ls.card}>
        {/* Header */}
        <div style={ls.logo}>PARTS MANAGER</div>
        <div style={ls.subtitle}>TEAM INVENTORY SYSTEM</div>

        {/* Mode tabs */}
        <div style={ls.modeTabs}>
          {["login", "signup"].map(m => (
            <button
              key={m}
              style={{ ...ls.modeTab, ...(mode === m ? ls.modeTabActive : {}) }}
              onClick={() => switchMode(m)}
              type="button"
            >
              {m === "login" ? "SIGN IN" : "SIGN UP"}
            </button>
          ))}
        </div>

        {/* ── LOGIN ── */}
        {mode === "login" && (
          <form onSubmit={handleLogin} style={ls.form} noValidate>
            <Field label="EMAIL" error={loginErrors.email}>
              <input
                type="email" autoComplete="email"
                value={loginFields.email}
                onChange={e => setLogin({ email: e.target.value })}
                onBlur={() => {
                  const e = validate({ email: loginFields.email });
                  setLoginErrors(p => ({ ...p, email: e.email }));
                }}
                style={{ ...ls.input, ...(loginErrors.email ? ls.inputError : {}) }}
                placeholder="you@example.com"
              />
            </Field>

            <Field label="PASSWORD" error={loginErrors.password}>
              <PasswordInput
                value={loginFields.password}
                onChange={v => setLogin({ password: v })}
                onBlur={() => {
                  const e = validate({ password: loginFields.password });
                  setLoginErrors(p => ({ ...p, password: e.password }));
                }}
                hasError={!!loginErrors.password}
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </Field>

            {/* Remember me */}
            <label style={ls.rememberRow}>
              <span
                style={{ ...ls.checkbox, ...(rememberMe ? ls.checkboxChecked : {}) }}
                onClick={() => setRememberMe(r => !r)}
                role="checkbox"
                aria-checked={rememberMe}
                tabIndex={0}
                onKeyDown={e => e.key === " " && setRememberMe(r => !r)}
              >
                {rememberMe && "✓"}
              </span>
              <span style={ls.rememberLabel} onClick={() => setRememberMe(r => !r)}>REMEMBER ME</span>
            </label>

            {loginGlobal && <div style={ls.globalError}>{loginGlobal}</div>}

            <button type="submit" style={ls.submitBtn} disabled={loginLoading}>
              {loginLoading ? <span style={ls.spinner} /> : null}
              {loginLoading ? "SIGNING IN..." : "SIGN IN"}
            </button>

            <button
              type="button"
              style={ls.linkBtn}
              onClick={() => { setResetEmail(loginFields.email); switchMode("reset"); }}
            >
              Forgot password?
            </button>
          </form>
        )}

        {/* ── SIGN UP ── */}
        {mode === "signup" && (
          <form onSubmit={handleSignup} style={ls.form} noValidate>
            <Field label="FULL NAME" error={signupErrors.name}>
              <input
                type="text" autoComplete="name"
                value={signupFields.name}
                onChange={e => setSignup({ name: e.target.value })}
                onBlur={() => {
                  const e = validate({ name: signupFields.name });
                  setSignupErrors(p => ({ ...p, name: e.name }));
                }}
                style={{ ...ls.input, ...(signupErrors.name ? ls.inputError : {}) }}
                placeholder="Jane Smith"
              />
            </Field>

            <Field label="ROLE (OPTIONAL)">
              <input
                type="text"
                value={signupFields.role}
                onChange={e => setSignup({ role: e.target.value })}
                style={ls.input}
                placeholder="e.g. Hardware Lead"
              />
            </Field>

            <Field label="EMAIL" error={signupErrors.email}>
              <input
                type="email" autoComplete="email"
                value={signupFields.email}
                onChange={e => setSignup({ email: e.target.value })}
                onBlur={() => {
                  const e = validate({ email: signupFields.email });
                  setSignupErrors(p => ({ ...p, email: e.email }));
                }}
                style={{ ...ls.input, ...(signupErrors.email ? ls.inputError : {}) }}
                placeholder="you@example.com"
              />
            </Field>

            <Field label="PASSWORD" error={signupErrors.password}>
              <PasswordInput
                value={signupFields.password}
                onChange={v => setSignup({ password: v })}
                onBlur={() => {
                  const e = validate({ password: signupFields.password });
                  setSignupErrors(p => ({ ...p, password: e.password }));
                }}
                hasError={!!signupErrors.password}
                autoComplete="new-password"
                placeholder="Min. 6 characters"
              />
              <PasswordStrength password={signupFields.password} />
            </Field>

            <Field label="CONFIRM PASSWORD" error={signupErrors.confirm}>
              <PasswordInput
                value={signupFields.confirm}
                onChange={v => setSignup({ confirm: v })}
                onBlur={() => {
                  const e = validate({ confirm: signupFields.confirm, password: signupFields.password });
                  setSignupErrors(p => ({ ...p, confirm: e.confirm }));
                }}
                hasError={!!signupErrors.confirm}
                autoComplete="new-password"
                placeholder="••••••••"
              />
            </Field>

            {signupGlobal && <div style={ls.globalError}>{signupGlobal}</div>}

            <button type="submit" style={ls.submitBtn} disabled={signupLoading}>
              {signupLoading ? <span style={ls.spinner} /> : null}
              {signupLoading ? "CREATING ACCOUNT..." : "CREATE ACCOUNT"}
            </button>
          </form>
        )}

        {/* ── RESET ── */}
        {mode === "reset" && (
          <form onSubmit={handleReset} style={ls.form} noValidate>
            <div style={ls.resetTitle}>RESET PASSWORD</div>
            <div style={ls.resetSub}>We'll send a reset link to your email.</div>

            <Field label="EMAIL" error={resetError}>
              <input
                type="email"
                value={resetEmail}
                onChange={e => setResetEmail(e.target.value)}
                style={{ ...ls.input, ...(resetError ? ls.inputError : {}) }}
                placeholder="you@example.com"
              />
            </Field>

            {resetSent
              ? <div style={ls.successMsg}>✓ Reset email sent. Check your inbox.</div>
              : (
                <button type="submit" style={ls.submitBtn} disabled={resetLoading}>
                  {resetLoading ? <span style={ls.spinner} /> : null}
                  {resetLoading ? "SENDING..." : "SEND RESET EMAIL"}
                </button>
              )
            }

            <button type="button" style={ls.linkBtn} onClick={() => switchMode("login")}>
              ← Back to sign in
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──
function Field({ label, error, children }) {
  return (
    <div style={ls.fieldWrap}>
      <div style={ls.label}>{label}</div>
      {children}
      {error && <div style={ls.fieldError}>{error}</div>}
    </div>
  );
}

function PasswordInput({ value, onChange, onBlur, hasError, autoComplete, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
        style={{ ...ls.input, ...(hasError ? ls.inputError : {}), paddingRight: 44 }}
        placeholder={placeholder}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        style={ls.eyeBtn}
        tabIndex={-1}
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? "○" : "●"}
      </button>
    </div>
  );
}

function PasswordStrength({ password }) {
  if (!password) return null;
  const score = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  const labels = ["", "WEAK", "FAIR", "GOOD", "STRONG"];
  const colors = ["", "#ff4444", "#ff9800", "#8bc34a", "#4caf50"];
  return (
    <div style={{ display: "flex", gap: 4, marginTop: 6, alignItems: "center" }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} style={{ flex: 1, height: 2, background: i <= score ? colors[score] : "#1e1e1e", transition: "background 0.3s" }} />
      ))}
      <span style={{ fontSize: 9, letterSpacing: 2, color: colors[score], marginLeft: 6, minWidth: 44 }}>
        {labels[score]}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────
// CREATE USER MODAL  (in-app, any member)
// ─────────────────────────────────────────
function CreateUserModal({ onClose, onCreated, showNotification }) {
  const [fields, setFields]   = useState({ name: "", role: "", email: "", password: "", confirm: "" });
  const [errors, setErrors]   = useState({});
  const [global, setGlobal]   = useState("");
  const [loading, setLoading] = useState(false);

  const set = patch => setFields(p => ({ ...p, ...patch }));

  const handleCreate = async (e) => {
    e?.preventDefault();
    const errs = validate({ name: fields.name, email: fields.email, password: fields.password, confirm: fields.confirm });
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setGlobal(""); setLoading(true);

    // Save current auth state so we can restore it
    const previousUser = auth.currentUser;

    try {
      const cred = await createUserWithEmailAndPassword(
        auth,
        fields.email.trim().toLowerCase(),
        fields.password
      );

      await push(ref(db, "members"), {
        name:  fields.name.trim(),
        role:  fields.role.trim() || "Member",
        email: fields.email.trim().toLowerCase(),
        uid:   cred.user.uid,
      });

      // Sign back in as the previous user if we got signed out
      // (Firebase automatically signs in the newly created user)
      // We sign out the new account and the auth listener will restore session
      if (previousUser && auth.currentUser?.uid !== previousUser.uid) {
        // The original user's session is restored via their remembered persistence
        // Best UX: just notify and close; the admin stays logged in on next reload
        // For full session restore we'd need their credentials, so instead
        // we reload — this restores from local persistence if "remember me" was set.
        showNotification(`User "${fields.name.trim()}" created — refreshing session...`);
        setTimeout(() => window.location.reload(), 1500);
        return;
      }

      showNotification(`User "${fields.name.trim()}" created`);
      onClose();
    } catch (err) {
      setGlobal(friendlyError(err.code));
      setLoading(false);
    }
  };

  return (
    <Modal onClose={() => !loading && onClose()}>
      <div style={s.modalTitle}>CREATE NEW USER</div>
      <div style={{ fontSize: 11, color: "#444", marginBottom: 4, lineHeight: 1.7 }}>
        Creates a Firebase Auth account and adds the member to the team.<br />
        <span style={{ color: "#333" }}>Note: your session will refresh after creation.</span>
      </div>

      <form onSubmit={handleCreate} noValidate style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        <Field label="FULL NAME" error={errors.name}>
          <input placeholder="Jane Smith" value={fields.name} onChange={e => set({ name: e.target.value })} style={{ ...s.modalInput, ...(errors.name ? s.modalInputError : {}) }} />
        </Field>
        <Field label="ROLE (OPTIONAL)">
          <input placeholder="e.g. Hardware Lead" value={fields.role} onChange={e => set({ role: e.target.value })} style={s.modalInput} />
        </Field>
        <Field label="EMAIL" error={errors.email}>
          <input type="email" placeholder="jane@example.com" value={fields.email} onChange={e => set({ email: e.target.value })} style={{ ...s.modalInput, ...(errors.email ? s.modalInputError : {}) }} />
        </Field>
        <Field label="PASSWORD" error={errors.password}>
          <PasswordInput value={fields.password} onChange={v => set({ password: v })} hasError={!!errors.password} autoComplete="new-password" placeholder="Min. 6 characters" />
          <PasswordStrength password={fields.password} />
        </Field>
        <Field label="CONFIRM PASSWORD" error={errors.confirm}>
          <PasswordInput value={fields.confirm} onChange={v => set({ confirm: v })} hasError={!!errors.confirm} autoComplete="new-password" placeholder="••••••••" />
        </Field>

        {global && (
          <div style={{ fontSize: 11, color: "#ff4444", borderLeft: "2px solid #ff4444", paddingLeft: 10, marginTop: 4 }}>
            {global}
          </div>
        )}

        <div style={{ ...s.modalActions, marginTop: 20 }}>
          <button type="submit" style={s.primaryBtn} disabled={loading}>
            {loading ? "CREATING..." : "CREATE USER"}
          </button>
          <button type="button" style={s.ghostBtn} onClick={onClose} disabled={loading}>CANCEL</button>
        </div>
      </form>
    </Modal>
  );
}

// ─────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────
export default function PartsManager() {
  const [authUser, setAuthUser]   = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [parts, setParts]       = useState([]);
  const [members, setMembers]   = useState([]);
  const [requests, setRequests] = useState([]);

  const [view, setView]                     = useState("inventory");
  const [search, setSearch]                 = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const [requestModal, setRequestModal] = useState(null);
  const [requestQty, setRequestQty]     = useState(1);
  const [requestNote, setRequestNote]   = useState("");

  const [addPartModal, setAddPartModal]   = useState(false);
  const [editPart, setEditPart]           = useState(null);
  const [editMember, setEditMember]       = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [createUserModal, setCreateUserModal] = useState(false);

  const [newPart, setNewPart] = useState({ name: "", category: "Sensor", qty: 1 });

  const [notification, setNotification] = useState(null);
  const [requestsTab, setRequestsTab]   = useState("incoming");
  const [resetPanels, setResetPanels]   = useState({});

  // ── Auth listener ──
  useEffect(() => {
    return onAuthStateChanged(auth, user => { setAuthUser(user); setAuthReady(true); });
  }, []);

  // ── Firebase data ──
  useEffect(() => {
    if (!authUser) return;
    const unsubs = [
      onValue(ref(db, "members"),  snap => { const v = snap.val() || {}; setMembers(Object.entries(v).map(([id, d]) => ({ id, ...d }))); }),
      onValue(ref(db, "parts"),    snap => { const v = snap.val() || {}; setParts(Object.entries(v).map(([id, d]) => ({ id, ...d }))); }),
      onValue(ref(db, "requests"), snap => { const v = snap.val() || {}; setRequests(Object.entries(v).map(([id, d]) => ({ id, ...d }))); }),
    ];
    return () => unsubs.forEach(u => u());
  }, [authUser]);

  const currentUser = members.find(m =>
    m.email?.toLowerCase() === authUser?.email?.toLowerCase()
  ) || null;

  const showNotification = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 2800);
  };

  const getMember = id => members.find(m => m.id === id);
  const getPart   = id => parts.find(p => p.id === id);

  const filteredParts = parts.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) &&
    (categoryFilter === "All" || p.category === categoryFilter)
  );

  const incomingRequests = currentUser
    ? requests.filter(r => { const p = getPart(r.partId); return p && p.ownerId === currentUser.id; })
    : [];
  const outgoingRequests = currentUser ? requests.filter(r => r.requesterId === currentUser.id) : [];
  const pendingIncoming  = incomingRequests.filter(r => r.status === "pending").length;

  // ── Part actions ──
  const addPart = async () => {
    if (!newPart.name.trim() || !currentUser) return;
    await push(ref(db, "parts"), { name: newPart.name, category: newPart.category, qty: Number(newPart.qty), available: Number(newPart.qty), ownerId: currentUser.id });
    setAddPartModal(false); setNewPart({ name: "", category: "Sensor", qty: 1 });
    showNotification("Part added");
  };

  const updatePart = async (id, data) => {
    await update(ref(db, `parts/${id}`), data);
    setEditPart(null); showNotification("Part updated");
  };

  const deletePart = async (id) => {
    await remove(ref(db, `parts/${id}`));
    setConfirmDelete(null); showNotification("Part deleted", "error");
  };

  // ── Member actions ──
  const updateMember = async (id, data) => {
    await update(ref(db, `members/${id}`), data);
    setEditMember(null); showNotification("Member updated");
  };

  const deleteMember = async (id) => {
    await remove(ref(db, `members/${id}`));
    setConfirmDelete(null); showNotification("Member removed", "error");
  };

  // ── Request actions ──
  const submitRequest = async () => {
    const part = requestModal;
    if (!part || !currentUser) return;
    if (part.ownerId === currentUser.id) { showNotification("You own this part", "error"); return; }
    if (requests.find(r => r.partId === part.id && r.requesterId === currentUser.id && r.status === "pending")) {
      showNotification("Request already pending", "error"); setRequestModal(null); return;
    }
    await push(ref(db, "requests"), { partId: part.id, requesterId: currentUser.id, ownerId: part.ownerId, qty: Number(requestQty), note: requestNote.trim(), status: "pending", timestamp: Date.now() });
    setRequestModal(null); setRequestQty(1); setRequestNote("");
    showNotification("Request sent");
  };

  const respondToRequest = async (requestId, status) => {
    const req = requests.find(r => r.id === requestId);
    if (!req) return;
    await update(ref(db, `requests/${requestId}`), { status, respondedAt: Date.now() });
    if (status === "approved") {
      const part = getPart(req.partId);
      if (part) await update(ref(db, `parts/${req.partId}`), { available: Math.max(0, (part.available || 0) - req.qty) });
      showNotification("Request approved");
    } else { showNotification("Request rejected", "error"); }
  };

  const returnPart = async (requestId) => {
    const req = requests.find(r => r.id === requestId);
    if (!req) return;
    const part = getPart(req.partId);
    if (part) await update(ref(db, `parts/${req.partId}`), { available: Math.min(part.qty, (part.available || 0) + req.qty) });
    await update(ref(db, `requests/${requestId}`), { status: "returned", returnedAt: Date.now() });
    showNotification("Part returned");
  };

  const cancelRequest = async (requestId) => {
    await remove(ref(db, `requests/${requestId}`));
    showNotification("Request cancelled", "error");
  };

  // ── Reset-password helpers ──
  const setResetPanel = (memberId, patch) =>
    setResetPanels(prev => ({ ...prev, [memberId]: { ...(prev[memberId] || {}), ...patch } }));

  const sendResetEmail = async (memberId) => {
    const m = getMember(memberId);
    if (!m?.email) { setResetPanel(memberId, { error: "No email on record for this member." }); return; }
    try {
      await sendPasswordResetEmail(auth, m.email);
      setResetPanel(memberId, { sent: true, error: "" });
      showNotification(`Reset email sent to ${m.email}`);
    } catch (err) { setResetPanel(memberId, { error: friendlyError(err.code) }); }
  };

  const setDirectPassword = async (memberId) => {
    const panel = resetPanels[memberId] || {};
    if (!panel.newPwd || panel.newPwd.length < 6) { setResetPanel(memberId, { error: "Password must be at least 6 characters." }); return; }
    if (panel.newPwd !== panel.confirm)            { setResetPanel(memberId, { error: "Passwords do not match." }); return; }
    const isOwnAccount = auth.currentUser?.email?.toLowerCase() === getMember(memberId)?.email?.toLowerCase();
    if (!isOwnAccount) { setResetPanel(memberId, { error: "You can only set your own password this way. Use 'Send Reset Email' for others." }); return; }
    try {
      await updatePassword(auth.currentUser, panel.newPwd);
      setResetPanel(memberId, { newPwd: "", confirm: "", error: "", directSuccess: true });
      showNotification("Password updated");
    } catch (err) { setResetPanel(memberId, { error: friendlyError(err.code) }); }
  };

  if (!authReady) return (
    <div style={s.loadingScreen}>
      <div style={s.loadingDots}>
        <span style={{ ...s.dot, animationDelay: "0s" }} />
        <span style={{ ...s.dot, animationDelay: "0.2s" }} />
        <span style={{ ...s.dot, animationDelay: "0.4s" }} />
      </div>
    </div>
  );

  if (!authUser) return <AuthScreen />;

  const statusColor = status => ({ approved: "#fff", rejected: "#555", returned: "#888" }[status] || "#aaa");
  const statusBg    = status => ({ approved: "#1a1a1a", rejected: "#111", returned: "#0f0f0f" }[status] || "#111");

  return (
    <div style={s.root}>
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* HEADER */}
      <header style={s.header}>
        <div style={s.logo}>PARTS MANAGER</div>
        <nav style={s.nav}>
          {["inventory", "requests", "members"].map(v => (
            <button key={v} style={{ ...s.navBtn, ...(view === v ? s.navBtnActive : {}) }} onClick={() => setView(v)}>
              {v.toUpperCase()}
              {v === "requests" && pendingIncoming > 0 && <span style={s.badge}>{pendingIncoming}</span>}
            </button>
          ))}
          <div style={s.divider} />
          <div style={s.userInfo}>
            <span style={s.userEmail}>{currentUser?.name || authUser.email}</span>
            <button style={s.signOutBtn} onClick={() => signOut(auth)}>SIGN OUT</button>
          </div>
        </nav>
      </header>

      {notification && (
        <div style={{ ...s.toast, borderColor: notification.type === "error" ? "#555" : "#fff" }}>
          {notification.msg}
        </div>
      )}

      <main style={s.main}>

        {/* ═══ INVENTORY ═══ */}
        {view === "inventory" && (
          <div>
            <div style={s.toolbar}>
              <input placeholder="Search parts..." value={search} onChange={e => setSearch(e.target.value)} style={s.searchInput} />
              <select style={s.filterSelect} value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                <option value="All">All Categories</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button style={s.primaryBtn} onClick={() => setAddPartModal(true)}>+ ADD PART</button>
            </div>
            {filteredParts.length === 0 && <div style={s.empty}>No parts found</div>}
            <div style={s.grid}>
              {filteredParts.map(p => {
                const owner    = getMember(p.ownerId);
                const availPct = p.qty > 0 ? ((p.available ?? p.qty) / p.qty) * 100 : 0;
                const isOwner  = p.ownerId === currentUser?.id;
                return (
                  <div key={p.id} style={s.partCard}>
                    <div style={s.partCardTop}>
                      <div>
                        <div style={s.partName}>{p.name}</div>
                        <div style={s.partMeta}>{p.category}</div>
                      </div>
                      <div style={s.partQtyBlock}>
                        <span style={s.partQtyNum}>{p.available ?? p.qty}</span>
                        <span style={s.partQtyOf}>/ {p.qty}</span>
                      </div>
                    </div>
                    <div style={s.progressBarBg}><div style={{ ...s.progressBarFill, width: `${availPct}%` }} /></div>
                    <div style={s.partOwner}>{owner?.name || "Unknown"} — {owner?.role || ""}</div>
                    <div style={s.partActions}>
                      {!isOwner && (
                        <button style={s.primaryBtn} onClick={() => { setRequestModal(p); setRequestQty(1); setRequestNote(""); }} disabled={(p.available ?? p.qty) === 0}>
                          REQUEST
                        </button>
                      )}
                      {isOwner && <span style={s.ownerTag}>YOU OWN THIS</span>}
                      <button style={s.ghostBtn} onClick={() => setEditPart({ ...p })}>EDIT</button>
                      <button style={s.dangerBtn} onClick={() => setConfirmDelete({ type: "part", id: p.id, name: p.name })}>DELETE</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ REQUESTS ═══ */}
        {view === "requests" && (
          <div>
            <div style={s.tabRow}>
              <button style={{ ...s.tabBtn, ...(requestsTab === "incoming" ? s.tabBtnActive : {}) }} onClick={() => setRequestsTab("incoming")}>
                INCOMING {pendingIncoming > 0 && <span style={s.badge}>{pendingIncoming}</span>}
              </button>
              <button style={{ ...s.tabBtn, ...(requestsTab === "outgoing" ? s.tabBtnActive : {}) }} onClick={() => setRequestsTab("outgoing")}>
                OUTGOING
              </button>
            </div>
            {requestsTab === "incoming" && (
              <div>
                {incomingRequests.length === 0 && <div style={s.empty}>No incoming requests</div>}
                {incomingRequests.sort((a, b) => b.timestamp - a.timestamp).map(r => {
                  const requester = getMember(r.requesterId);
                  const part      = getPart(r.partId);
                  return (
                    <div key={r.id} style={{ ...s.requestCard, background: statusBg(r.status) }}>
                      <div style={s.requestHeader}>
                        <div>
                          <div style={s.requestPartName}>{part?.name || r.partId}</div>
                          <div style={s.requestMeta}>Requested by <b>{requester?.name || "Unknown"}</b> &nbsp;·&nbsp; Qty: {r.qty}</div>
                          {r.note && <div style={s.requestNote}>"{r.note}"</div>}
                          <div style={s.requestTime}>{new Date(r.timestamp).toLocaleString()}</div>
                        </div>
                        <div style={{ ...s.statusPill, color: statusColor(r.status), borderColor: statusColor(r.status) }}>{r.status.toUpperCase()}</div>
                      </div>
                      {r.status === "pending" && (
                        <div style={s.requestActions}>
                          <button style={s.approveBtn} onClick={() => respondToRequest(r.id, "approved")}>APPROVE</button>
                          <button style={s.rejectBtn}  onClick={() => respondToRequest(r.id, "rejected")}>REJECT</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {requestsTab === "outgoing" && (
              <div>
                {outgoingRequests.length === 0 && <div style={s.empty}>No outgoing requests</div>}
                {outgoingRequests.sort((a, b) => b.timestamp - a.timestamp).map(r => {
                  const owner = getMember(r.ownerId);
                  const part  = getPart(r.partId);
                  return (
                    <div key={r.id} style={{ ...s.requestCard, background: statusBg(r.status) }}>
                      <div style={s.requestHeader}>
                        <div>
                          <div style={s.requestPartName}>{part?.name || r.partId}</div>
                          <div style={s.requestMeta}>Owner: <b>{owner?.name || "Unknown"}</b> &nbsp;·&nbsp; Qty: {r.qty}</div>
                          {r.note && <div style={s.requestNote}>"{r.note}"</div>}
                          <div style={s.requestTime}>{new Date(r.timestamp).toLocaleString()}</div>
                        </div>
                        <div style={{ ...s.statusPill, color: statusColor(r.status), borderColor: statusColor(r.status) }}>{r.status.toUpperCase()}</div>
                      </div>
                      <div style={s.requestActions}>
                        {r.status === "pending"  && <button style={s.dangerBtn} onClick={() => cancelRequest(r.id)}>CANCEL</button>}
                        {r.status === "approved" && <button style={s.ghostBtn}  onClick={() => returnPart(r.id)}>RETURN PART</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ MEMBERS ═══ */}
        {view === "members" && (
          <div>
            <div style={s.toolbar}>
              <div style={s.sectionTitle}>MEMBERS</div>
              <button style={s.primaryBtn} onClick={() => setCreateUserModal(true)}>
                + CREATE NEW USER
              </button>
            </div>
            {members.length === 0 && <div style={s.empty}>No members found</div>}
            <div style={s.memberList}>
              {members.map(m => {
                const ownedParts    = parts.filter(p => p.ownerId === m.id);
                const isCurrentUser = m.id === currentUser?.id;
                const panel         = resetPanels[m.id] || {};
                return (
                  <div key={m.id} style={{ ...s.memberCard, ...(isCurrentUser ? s.memberCardActive : {}) }}>
                    <div style={s.memberRow}>
                      <div style={s.memberInfo}>
                        <div style={s.memberAvatar}>{m.name.charAt(0).toUpperCase()}</div>
                        <div>
                          <div style={s.memberName}>
                            {m.name}
                            {isCurrentUser && <span style={s.youTag}>&nbsp;YOU</span>}
                          </div>
                          <div style={s.memberRole}>{m.role}</div>
                          <div style={s.memberPartCount}>{ownedParts.length} part{ownedParts.length !== 1 ? "s" : ""} owned</div>
                          {m.email && <div style={s.memberEmail}>{m.email}</div>}
                        </div>
                      </div>
                      <div style={s.memberActions}>
                        <button
                          style={{ ...s.ghostBtn, ...(panel.open ? { borderColor: "#fff", color: "#fff" } : {}) }}
                          onClick={() => setResetPanel(m.id, { open: !panel.open, sent: false, error: "", directSuccess: false })}
                        >
                          RESET PASSWORD
                        </button>
                        <button style={s.ghostBtn}  onClick={() => setEditMember({ ...m })}>EDIT</button>
                        <button style={s.dangerBtn} onClick={() => setConfirmDelete({ type: "member", id: m.id, name: m.name })}>DELETE</button>
                      </div>
                    </div>

                    {panel.open && (
                      <div style={s.resetPanel}>
                        <div style={s.resetPanelTitle}>RESET PASSWORD — {m.name.toUpperCase()}</div>
                        <div style={s.resetSection}>
                          <div style={s.resetSectionLabel}>① SEND RESET EMAIL</div>
                          <div style={s.resetSectionSub}>Sends a Firebase reset link to <b>{m.email || "no email on record"}</b>.</div>
                          {panel.sent
                            ? <div style={s.successMsg}>✓ Reset email sent.</div>
                            : <button style={s.primaryBtn} onClick={() => sendResetEmail(m.id)}>SEND EMAIL</button>}
                        </div>
                        <div style={s.resetSection}>
                          <div style={s.resetSectionLabel}>② SET NEW PASSWORD DIRECTLY</div>
                          <div style={s.resetSectionSub}>
                            {isCurrentUser
                              ? "Sets a new password for your own account immediately."
                              : "Only available for your own account (Firebase security restriction)."}
                          </div>
                          {isCurrentUser && (
                            <>
                              <input type="password" placeholder="New password" value={panel.newPwd || ""} onChange={e => setResetPanel(m.id, { newPwd: e.target.value })} style={{ ...s.resetInput, marginBottom: 8 }} />
                              <input type="password" placeholder="Confirm password" value={panel.confirm || ""} onChange={e => setResetPanel(m.id, { confirm: e.target.value })} style={{ ...s.resetInput, marginBottom: 10 }} />
                              {panel.directSuccess
                                ? <div style={s.successMsg}>✓ Password updated.</div>
                                : <button style={s.primaryBtn} onClick={() => setDirectPassword(m.id)}>SET PASSWORD</button>}
                            </>
                          )}
                        </div>
                        {panel.error && <div style={s.resetError}>{panel.error}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ═══ MODAL: CREATE NEW USER ═══ */}
      {createUserModal && (
        <CreateUserModal
          onClose={() => setCreateUserModal(false)}
          onCreated={() => { setCreateUserModal(false); }}
          showNotification={showNotification}
        />
      )}

      {/* ═══ MODAL: REQUEST PART ═══ */}
      {requestModal && (
        <Modal onClose={() => setRequestModal(null)}>
          <div style={s.modalTitle}>REQUEST PART</div>
          <div style={s.modalPartName}>{requestModal.name}</div>
          <div style={s.modalLabel}>QUANTITY</div>
          <input type="number" min={1} max={requestModal.available ?? requestModal.qty} value={requestQty} onChange={e => setRequestQty(e.target.value)} style={s.modalInput} />
          <div style={s.modalLabel}>NOTE (OPTIONAL)</div>
          <textarea placeholder="Why do you need this part?" value={requestNote} onChange={e => setRequestNote(e.target.value)} style={{ ...s.modalInput, height: 80, resize: "vertical" }} />
          <div style={s.modalActions}>
            <button style={s.primaryBtn} onClick={submitRequest}>SEND REQUEST</button>
            <button style={s.ghostBtn} onClick={() => setRequestModal(null)}>CANCEL</button>
          </div>
        </Modal>
      )}

      {/* ═══ MODAL: ADD PART ═══ */}
      {addPartModal && (
        <Modal onClose={() => setAddPartModal(false)}>
          <div style={s.modalTitle}>ADD PART</div>
          <div style={s.modalLabel}>NAME</div>
          <input placeholder="Part name" value={newPart.name} onChange={e => setNewPart({ ...newPart, name: e.target.value })} style={s.modalInput} />
          <div style={s.modalLabel}>CATEGORY</div>
          <select value={newPart.category} onChange={e => setNewPart({ ...newPart, category: e.target.value })} style={s.modalInput}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div style={s.modalLabel}>QUANTITY</div>
          <input type="number" min={1} value={newPart.qty} onChange={e => setNewPart({ ...newPart, qty: e.target.value })} style={s.modalInput} />
          <div style={s.modalActions}>
            <button style={s.primaryBtn} onClick={addPart}>SAVE</button>
            <button style={s.ghostBtn} onClick={() => setAddPartModal(false)}>CANCEL</button>
          </div>
        </Modal>
      )}

      {/* ═══ MODAL: EDIT PART ═══ */}
      {editPart && (
        <Modal onClose={() => setEditPart(null)}>
          <div style={s.modalTitle}>EDIT PART</div>
          <div style={s.modalLabel}>NAME</div>
          <input value={editPart.name} onChange={e => setEditPart({ ...editPart, name: e.target.value })} style={s.modalInput} />
          <div style={s.modalLabel}>CATEGORY</div>
          <select value={editPart.category} onChange={e => setEditPart({ ...editPart, category: e.target.value })} style={s.modalInput}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div style={s.modalLabel}>TOTAL QUANTITY</div>
          <input type="number" min={0} value={editPart.qty} onChange={e => setEditPart({ ...editPart, qty: e.target.value })} style={s.modalInput} />
          <div style={s.modalActions}>
            <button style={s.primaryBtn} onClick={() => updatePart(editPart.id, { name: editPart.name, category: editPart.category, qty: Number(editPart.qty), available: Number(editPart.qty) })}>SAVE</button>
            <button style={s.ghostBtn} onClick={() => setEditPart(null)}>CANCEL</button>
          </div>
        </Modal>
      )}

      {/* ═══ MODAL: EDIT MEMBER ═══ */}
      {editMember && (
        <Modal onClose={() => setEditMember(null)}>
          <div style={s.modalTitle}>EDIT MEMBER</div>
          <div style={s.modalLabel}>NAME</div>
          <input value={editMember.name} onChange={e => setEditMember({ ...editMember, name: e.target.value })} style={s.modalInput} />
          <div style={s.modalLabel}>ROLE</div>
          <input value={editMember.role} onChange={e => setEditMember({ ...editMember, role: e.target.value })} style={s.modalInput} />
          <div style={s.modalLabel}>EMAIL</div>
          <input type="email" value={editMember.email || ""} onChange={e => setEditMember({ ...editMember, email: e.target.value })} style={s.modalInput} />
          <div style={s.modalActions}>
            <button style={s.primaryBtn} onClick={() => updateMember(editMember.id, { name: editMember.name, role: editMember.role, email: editMember.email })}>SAVE</button>
            <button style={s.ghostBtn} onClick={() => setEditMember(null)}>CANCEL</button>
          </div>
        </Modal>
      )}

      {/* ═══ MODAL: CONFIRM DELETE ═══ */}
      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)}>
          <div style={s.modalTitle}>CONFIRM DELETE</div>
          <div style={{ color: "#aaa", marginBottom: 24, fontSize: 14 }}>
            Are you sure you want to delete <b style={{ color: "#fff" }}>{confirmDelete.name}</b>? This cannot be undone.
          </div>
          <div style={s.modalActions}>
            <button style={s.dangerBtnLg} onClick={() => { if (confirmDelete.type === "part") deletePart(confirmDelete.id); else deleteMember(confirmDelete.id); }}>DELETE</button>
            <button style={s.ghostBtn} onClick={() => setConfirmDelete(null)}>CANCEL</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={s.modalBox} onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────
const s = {
  root: { background: "#0a0a0a", color: "#fff", minHeight: "100vh", fontFamily: "'IBM Plex Mono', 'Courier New', monospace", fontSize: 13 },
  loadingScreen: { height: "100vh", display: "flex", justifyContent: "center", alignItems: "center", background: "#0a0a0a" },
  loadingDots: { display: "flex", gap: 8 },
  dot: { width: 6, height: 6, background: "#333", borderRadius: "50%", animation: "pulse 1s ease-in-out infinite" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 32px", height: 56, borderBottom: "1px solid #1e1e1e", position: "sticky", top: 0, background: "#0a0a0a", zIndex: 100 },
  logo: { fontSize: 13, letterSpacing: 4, fontWeight: 700, color: "#fff" },
  nav: { display: "flex", gap: 4, alignItems: "center" },
  navBtn: { background: "transparent", color: "#555", border: "none", padding: "6px 14px", cursor: "pointer", fontFamily: "inherit", fontSize: 11, letterSpacing: 2, fontWeight: 600 },
  navBtnActive: { color: "#fff", borderBottom: "1px solid #fff" },
  badge: { display: "inline-block", background: "#fff", color: "#000", borderRadius: 10, fontSize: 9, fontWeight: 700, padding: "1px 5px", marginLeft: 5, verticalAlign: "middle" },
  divider: { width: 1, height: 20, background: "#222", margin: "0 8px" },
  userInfo: { display: "flex", alignItems: "center", gap: 12 },
  userEmail: { fontSize: 11, color: "#555", letterSpacing: 1 },
  signOutBtn: { background: "transparent", color: "#444", border: "1px solid #222", padding: "5px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: 10, letterSpacing: 2, fontWeight: 600 },
  main: { padding: "28px 32px", maxWidth: 1100, margin: "0 auto" },
  toolbar: { display: "flex", gap: 10, alignItems: "center", marginBottom: 24, flexWrap: "wrap" },
  sectionTitle: { fontSize: 11, letterSpacing: 3, color: "#888", fontWeight: 700, flex: 1 },
  searchInput: { background: "#111", color: "#fff", border: "1px solid #222", padding: "9px 14px", fontFamily: "inherit", fontSize: 12, flex: 1, minWidth: 200, outline: "none" },
  filterSelect: { background: "#111", color: "#fff", border: "1px solid #222", padding: "9px 14px", fontFamily: "inherit", fontSize: 12, cursor: "pointer" },
  primaryBtn: { background: "#fff", color: "#000", border: "none", padding: "9px 18px", cursor: "pointer", fontFamily: "inherit", fontSize: 11, letterSpacing: 2, fontWeight: 700, whiteSpace: "nowrap" },
  ghostBtn: { background: "transparent", color: "#aaa", border: "1px solid #2a2a2a", padding: "8px 16px", cursor: "pointer", fontFamily: "inherit", fontSize: 11, letterSpacing: 2, fontWeight: 600, whiteSpace: "nowrap" },
  dangerBtn: { background: "transparent", color: "#555", border: "1px solid #2a2a2a", padding: "8px 16px", cursor: "pointer", fontFamily: "inherit", fontSize: 11, letterSpacing: 2, fontWeight: 600, whiteSpace: "nowrap" },
  dangerBtnLg: { background: "#1a1a1a", color: "#ff4444", border: "1px solid #ff4444", padding: "10px 24px", cursor: "pointer", fontFamily: "inherit", fontSize: 11, letterSpacing: 2, fontWeight: 700 },
  approveBtn: { background: "#fff", color: "#000", border: "none", padding: "8px 20px", cursor: "pointer", fontFamily: "inherit", fontSize: 11, letterSpacing: 2, fontWeight: 700 },
  rejectBtn: { background: "transparent", color: "#888", border: "1px solid #333", padding: "8px 20px", cursor: "pointer", fontFamily: "inherit", fontSize: 11, letterSpacing: 2, fontWeight: 600 },
  empty: { color: "#333", textAlign: "center", padding: "60px 0", letterSpacing: 2, fontSize: 12 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 },
  partCard: { border: "1px solid #1e1e1e", padding: "18px 20px", background: "#0f0f0f", display: "flex", flexDirection: "column", gap: 10 },
  partCardTop: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  partName: { fontSize: 14, fontWeight: 700, letterSpacing: 1, marginBottom: 3 },
  partMeta: { fontSize: 11, color: "#555", letterSpacing: 1 },
  partQtyBlock: { textAlign: "right" },
  partQtyNum: { fontSize: 20, fontWeight: 700 },
  partQtyOf: { fontSize: 12, color: "#444", marginLeft: 2 },
  progressBarBg: { height: 2, background: "#1e1e1e", width: "100%" },
  progressBarFill: { height: 2, background: "#fff", transition: "width 0.4s ease" },
  partOwner: { fontSize: 11, color: "#444", letterSpacing: 0.5 },
  partActions: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 4 },
  ownerTag: { fontSize: 9, letterSpacing: 2, color: "#333", border: "1px solid #1e1e1e", padding: "4px 8px" },
  tabRow: { display: "flex", gap: 0, borderBottom: "1px solid #1e1e1e", marginBottom: 24 },
  tabBtn: { background: "transparent", color: "#444", border: "none", borderBottom: "2px solid transparent", padding: "10px 20px", cursor: "pointer", fontFamily: "inherit", fontSize: 11, letterSpacing: 2, fontWeight: 600, marginBottom: -1 },
  tabBtnActive: { color: "#fff", borderBottom: "2px solid #fff" },
  requestCard: { border: "1px solid #1e1e1e", padding: "18px 20px", marginBottom: 10 },
  requestHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 },
  requestPartName: { fontSize: 14, fontWeight: 700, marginBottom: 5, letterSpacing: 0.5 },
  requestMeta: { fontSize: 12, color: "#666", marginBottom: 4 },
  requestNote: { fontSize: 12, color: "#555", fontStyle: "italic", marginBottom: 4 },
  requestTime: { fontSize: 10, color: "#333", letterSpacing: 0.5, marginTop: 4 },
  statusPill: { border: "1px solid", padding: "4px 10px", fontSize: 9, letterSpacing: 2, fontWeight: 700, whiteSpace: "nowrap" },
  requestActions: { display: "flex", gap: 8, marginTop: 14 },
  memberList: { display: "flex", flexDirection: "column", gap: 8 },
  memberCard: { border: "1px solid #1e1e1e", padding: "16px 20px", background: "#0f0f0f" },
  memberCardActive: { borderColor: "#333" },
  memberRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  memberInfo: { display: "flex", gap: 16, alignItems: "center" },
  memberAvatar: { width: 38, height: 38, background: "#1a1a1a", border: "1px solid #2a2a2a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, flexShrink: 0 },
  memberName: { fontSize: 14, fontWeight: 700, marginBottom: 2, letterSpacing: 0.5 },
  memberRole: { fontSize: 11, color: "#555", letterSpacing: 1, marginBottom: 2 },
  memberPartCount: { fontSize: 10, color: "#333", letterSpacing: 1 },
  memberEmail: { fontSize: 10, color: "#333", letterSpacing: 0.5, marginTop: 2 },
  memberActions: { display: "flex", gap: 8 },
  youTag: { fontSize: 9, letterSpacing: 2, color: "#fff", background: "#222", padding: "2px 6px", verticalAlign: "middle" },
  resetPanel: { borderTop: "1px solid #1e1e1e", marginTop: 16, paddingTop: 16, display: "flex", flexDirection: "column", gap: 16 },
  resetPanelTitle: { fontSize: 9, letterSpacing: 3, color: "#444", fontWeight: 700 },
  resetSection: { display: "flex", flexDirection: "column", gap: 8 },
  resetSectionLabel: { fontSize: 10, letterSpacing: 2, color: "#666", fontWeight: 700 },
  resetSectionSub: { fontSize: 11, color: "#444", marginBottom: 4 },
  resetInput: { background: "#111", color: "#fff", border: "1px solid #222", padding: "9px 14px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, outline: "none", width: "100%", maxWidth: 320, boxSizing: "border-box" },
  resetError: { fontSize: 11, color: "#ff4444", letterSpacing: 0.5, borderLeft: "2px solid #ff4444", paddingLeft: 10 },
  successMsg: { fontSize: 11, color: "#4caf50", letterSpacing: 0.5 },
  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 200, backdropFilter: "blur(2px)" },
  modalBox: { background: "#0f0f0f", border: "1px solid #222", padding: "32px 36px", width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 10, maxHeight: "90vh", overflowY: "auto" },
  modalTitle: { fontSize: 12, letterSpacing: 4, fontWeight: 700, color: "#fff", marginBottom: 8, borderBottom: "1px solid #1e1e1e", paddingBottom: 12 },
  modalPartName: { fontSize: 16, fontWeight: 700, marginBottom: 8, letterSpacing: 1 },
  modalLabel: { fontSize: 9, letterSpacing: 3, color: "#555", fontWeight: 700, marginTop: 6 },
  modalInput: { background: "#111", color: "#fff", border: "1px solid #222", padding: "10px 14px", fontFamily: "inherit", fontSize: 13, width: "100%", boxSizing: "border-box", outline: "none" },
  modalInputError: { borderColor: "#ff4444" },
  modalActions: { display: "flex", gap: 10, marginTop: 16 },
  toast: { position: "fixed", top: 66, right: 24, background: "#111", color: "#fff", padding: "10px 18px", border: "1px solid #fff", fontSize: 12, letterSpacing: 1, zIndex: 300, fontFamily: "'IBM Plex Mono', monospace" },
};

const ls = {
  root: { background: "#0a0a0a", minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center", fontFamily: "'IBM Plex Mono', 'Courier New', monospace", padding: "24px 16px", boxSizing: "border-box" },
  card: { border: "1px solid #1e1e1e", background: "#0f0f0f", padding: "40px 44px", width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 6 },
  logo: { fontSize: 14, letterSpacing: 5, fontWeight: 700, color: "#fff", marginBottom: 2 },
  subtitle: { fontSize: 9, letterSpacing: 4, color: "#333", marginBottom: 20 },
  modeTabs: { display: "flex", borderBottom: "1px solid #1e1e1e", marginBottom: 24 },
  modeTab: { flex: 1, background: "transparent", border: "none", borderBottom: "2px solid transparent", padding: "10px 0", cursor: "pointer", fontFamily: "inherit", fontSize: 10, letterSpacing: 3, fontWeight: 700, color: "#444", marginBottom: -1 },
  modeTabActive: { color: "#fff", borderBottomColor: "#fff" },
  form: { display: "flex", flexDirection: "column", gap: 4 },
  fieldWrap: { display: "flex", flexDirection: "column", gap: 0, marginBottom: 4 },
  label: { fontSize: 9, letterSpacing: 3, color: "#555", fontWeight: 700, marginBottom: 5, marginTop: 10 },
  input: { background: "#111", color: "#fff", border: "1px solid #222", padding: "11px 14px", fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box" },
  inputError: { borderColor: "#ff4444" },
  fieldError: { fontSize: 10, color: "#ff4444", letterSpacing: 0.5, marginTop: 4 },
  globalError: { fontSize: 11, color: "#ff4444", borderLeft: "2px solid #ff4444", paddingLeft: 10, marginTop: 4, marginBottom: 4 },
  rememberRow: { display: "flex", alignItems: "center", gap: 10, marginTop: 12, cursor: "pointer", userSelect: "none" },
  checkbox: { width: 16, height: 16, border: "1px solid #333", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#000", cursor: "pointer", flexShrink: 0, background: "transparent" },
  checkboxChecked: { background: "#fff", borderColor: "#fff", color: "#000" },
  rememberLabel: { fontSize: 10, letterSpacing: 2, color: "#444", fontWeight: 600 },
  submitBtn: { background: "#fff", color: "#000", border: "none", padding: "12px 0", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 3, fontWeight: 700, width: "100%", marginTop: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 },
  spinner: { width: 10, height: 10, border: "2px solid #00000044", borderTop: "2px solid #000", borderRadius: "50%", animation: "spin 0.7s linear infinite", display: "inline-block" },
  linkBtn: { background: "transparent", border: "none", color: "#444", cursor: "pointer", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, letterSpacing: 1, marginTop: 12, textAlign: "left", padding: 0 },
  resetTitle: { fontSize: 12, letterSpacing: 4, color: "#fff", fontWeight: 700, marginBottom: 4 },
  resetSub: { fontSize: 11, color: "#444", marginBottom: 12 },
  successMsg: { fontSize: 11, color: "#4caf50", letterSpacing: 0.5, marginTop: 8 },
  eyeBtn: { position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "transparent", border: "none", color: "#444", cursor: "pointer", fontFamily: "inherit", fontSize: 12, padding: 0 },
};