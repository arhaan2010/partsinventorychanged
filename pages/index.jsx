import { db } from "../lib/firebase";
import { ref, onValue, push, update, remove } from "firebase/database";
import { useState, useEffect } from "react";

const DEFAULT_USER = {
  id: "member_4",
  name: "Nisha Kapoor",
  role: "Software Lead",
};

const CATEGORIES = ["Sensor", "Actuator", "Controller", "Power", "Structure", "Electronics", "Mechanical", "Other"];

export default function PartsManager() {
  const [parts, setParts] = useState([]);
  const [members, setMembers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState("inventory");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");

  const [requestModal, setRequestModal] = useState(null);
  const [requestQty, setRequestQty] = useState(1);
  const [requestNote, setRequestNote] = useState("");

  const [addPartModal, setAddPartModal] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [editPart, setEditPart] = useState(null);
  const [addMemberModal, setAddMemberModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null); // { type: 'part'|'member', id, name }

  const [newMember, setNewMember] = useState({ name: "", role: "" });
  const [newPart, setNewPart] = useState({ name: "", category: "Sensor", qty: 1 });

  const [notification, setNotification] = useState(null);
  const [requestsTab, setRequestsTab] = useState("incoming"); // incoming | outgoing

  const [activeUserId, setActiveUserId] = useState(DEFAULT_USER.id);
  const currentUser = members.find((m) => m.id === activeUserId) || DEFAULT_USER;

  // ---------------- FIREBASE ----------------
  useEffect(() => {
    const membersRef = ref(db, "members");
    const partsRef = ref(db, "parts");
    const requestsRef = ref(db, "requests");

    onValue(membersRef, (snap) => {
      const v = snap.val() || {};
      setMembers(Object.entries(v).map(([id, data]) => ({ id, ...data })));
    });

    onValue(partsRef, (snap) => {
      const v = snap.val() || {};
      setParts(Object.entries(v).map(([id, data]) => ({ id, ...data })));
    });

    onValue(requestsRef, (snap) => {
      const v = snap.val() || {};
      setRequests(Object.entries(v).map(([id, data]) => ({ id, ...data })));
    });

    setLoading(false);
  }, []);

  const showNotification = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 2800);
  };

  const getMember = (id) => members.find((m) => m.id === id);
  const getPart = (id) => parts.find((p) => p.id === id);

  const filteredParts = parts.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "All" || p.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const incomingRequests = requests.filter((r) => {
    const part = getPart(r.partId);
    return part && part.ownerId === currentUser.id;
  });

  const outgoingRequests = requests.filter((r) => r.requesterId === currentUser.id);

  const pendingIncoming = incomingRequests.filter((r) => r.status === "pending").length;

  // ---------------- ACTIONS ----------------
  const addPart = async () => {
    if (!newPart.name.trim()) return;
    await push(ref(db, "parts"), {
      name: newPart.name,
      category: newPart.category,
      qty: Number(newPart.qty),
      available: Number(newPart.qty),
      ownerId: currentUser.id,
    });
    setAddPartModal(false);
    setNewPart({ name: "", category: "Sensor", qty: 1 });
    showNotification("Part added successfully");
  };

  const updatePart = async (id, data) => {
    await update(ref(db, `parts/${id}`), data);
    setEditPart(null);
    showNotification("Part updated");
  };

  const deletePart = async (id) => {
    await remove(ref(db, `parts/${id}`));
    setConfirmDelete(null);
    showNotification("Part deleted", "error");
  };

  const addMember = async () => {
    if (!newMember.name.trim()) return;
    await push(ref(db, "members"), {
      name: newMember.name,
      role: newMember.role || "Member",
    });
    setAddMemberModal(false);
    setNewMember({ name: "", role: "" });
    showNotification("Member added");
  };

  const updateMember = async (id, data) => {
    await update(ref(db, `members/${id}`), data);
    setEditMember(null);
    showNotification("Member updated");
  };

  const deleteMember = async (id) => {
    await remove(ref(db, `members/${id}`));
    setConfirmDelete(null);
    showNotification("Member removed", "error");
  };

  const submitRequest = async () => {
    const part = requestModal;
    if (!part) return;
    if (part.ownerId === currentUser.id) {
      showNotification("You own this part", "error");
      return;
    }
    const alreadyPending = requests.find(
      (r) => r.partId === part.id && r.requesterId === currentUser.id && r.status === "pending"
    );
    if (alreadyPending) {
      showNotification("Request already pending", "error");
      setRequestModal(null);
      return;
    }
    await push(ref(db, "requests"), {
      partId: part.id,
      requesterId: currentUser.id,
      ownerId: part.ownerId,
      qty: Number(requestQty),
      note: requestNote.trim(),
      status: "pending",
      timestamp: Date.now(),
    });
    setRequestModal(null);
    setRequestQty(1);
    setRequestNote("");
    showNotification("Request sent");
  };

  const respondToRequest = async (requestId, status) => {
    const req = requests.find((r) => r.id === requestId);
    if (!req) return;

    await update(ref(db, `requests/${requestId}`), {
      status,
      respondedAt: Date.now(),
    });

    if (status === "approved") {
      const part = getPart(req.partId);
      if (part) {
        const newAvailable = Math.max(0, (part.available || 0) - req.qty);
        await update(ref(db, `parts/${req.partId}`), { available: newAvailable });
      }
      showNotification("Request approved");
    } else {
      showNotification("Request rejected", "error");
    }
  };

  const returnPart = async (requestId) => {
    const req = requests.find((r) => r.id === requestId);
    if (!req) return;
    const part = getPart(req.partId);
    if (part) {
      const newAvailable = Math.min(part.qty, (part.available || 0) + req.qty);
      await update(ref(db, `parts/${req.partId}`), { available: newAvailable });
    }
    await update(ref(db, `requests/${requestId}`), {
      status: "returned",
      returnedAt: Date.now(),
    });
    showNotification("Part returned");
  };

  const cancelRequest = async (requestId) => {
    await remove(ref(db, `requests/${requestId}`));
    showNotification("Request cancelled", "error");
  };

  if (loading) return <div style={s.loadingScreen}>Loading...</div>;

  const statusColor = (status) => {
    if (status === "approved") return "#fff";
    if (status === "rejected") return "#555";
    if (status === "returned") return "#888";
    return "#aaa";
  };

  const statusBg = (status) => {
    if (status === "approved") return "#1a1a1a";
    if (status === "rejected") return "#111";
    if (status === "returned") return "#0f0f0f";
    return "#111";
  };

  return (
    <div style={s.root}>
      {/* HEADER */}
      <header style={s.header}>
        <div style={s.logo}>PARTS MANAGER</div>
        <nav style={s.nav}>
          {["inventory", "requests", "members"].map((v) => (
            <button
              key={v}
              style={{ ...s.navBtn, ...(view === v ? s.navBtnActive : {}) }}
              onClick={() => setView(v)}
            >
              {v.toUpperCase()}
              {v === "requests" && pendingIncoming > 0 && (
                <span style={s.badge}>{pendingIncoming}</span>
              )}
            </button>
          ))}
          <div style={s.divider} />
          <select
            style={s.select}
            value={activeUserId}
            onChange={(e) => setActiveUserId(e.target.value)}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </nav>
      </header>

      {/* NOTIFICATION */}
      {notification && (
        <div style={{ ...s.toast, borderColor: notification.type === "error" ? "#555" : "#fff" }}>
          {notification.msg}
        </div>
      )}

      <main style={s.main}>

        {/* ===== INVENTORY ===== */}
        {view === "inventory" && (
          <div>
            <div style={s.toolbar}>
              <input
                placeholder="Search parts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={s.searchInput}
              />
              <select
                style={s.filterSelect}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                <option value="All">All Categories</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button style={s.primaryBtn} onClick={() => setAddPartModal(true)}>
                + ADD PART
              </button>
            </div>

            {filteredParts.length === 0 && (
              <div style={s.empty}>No parts found</div>
            )}

            <div style={s.grid}>
              {filteredParts.map((p) => {
                const owner = getMember(p.ownerId);
                const availPct = p.qty > 0 ? ((p.available ?? p.qty) / p.qty) * 100 : 0;
                const isOwner = p.ownerId === currentUser.id;

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

                    <div style={s.progressBarBg}>
                      <div style={{ ...s.progressBarFill, width: `${availPct}%` }} />
                    </div>

                    <div style={s.partOwner}>
                      {owner?.name || "Unknown"} — {owner?.role || ""}
                    </div>

                    <div style={s.partActions}>
                      {!isOwner && (
                        <button
                          style={s.primaryBtn}
                          onClick={() => { setRequestModal(p); setRequestQty(1); setRequestNote(""); }}
                          disabled={(p.available ?? p.qty) === 0}
                        >
                          REQUEST
                        </button>
                      )}
                      {isOwner && <span style={s.ownerTag}>YOU OWN THIS</span>}
                      <button style={s.ghostBtn} onClick={() => setEditPart({ ...p })}>EDIT</button>
                      <button
                        style={s.dangerBtn}
                        onClick={() => setConfirmDelete({ type: "part", id: p.id, name: p.name })}
                      >
                        DELETE
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== REQUESTS ===== */}
        {view === "requests" && (
          <div>
            <div style={s.tabRow}>
              <button
                style={{ ...s.tabBtn, ...(requestsTab === "incoming" ? s.tabBtnActive : {}) }}
                onClick={() => setRequestsTab("incoming")}
              >
                INCOMING
                {pendingIncoming > 0 && <span style={s.badge}>{pendingIncoming}</span>}
              </button>
              <button
                style={{ ...s.tabBtn, ...(requestsTab === "outgoing" ? s.tabBtnActive : {}) }}
                onClick={() => setRequestsTab("outgoing")}
              >
                OUTGOING
              </button>
            </div>

            {/* INCOMING */}
            {requestsTab === "incoming" && (
              <div>
                {incomingRequests.length === 0 && <div style={s.empty}>No incoming requests</div>}
                {incomingRequests
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .map((r) => {
                    const requester = getMember(r.requesterId);
                    const part = getPart(r.partId);
                    return (
                      <div key={r.id} style={{ ...s.requestCard, background: statusBg(r.status) }}>
                        <div style={s.requestHeader}>
                          <div>
                            <div style={s.requestPartName}>{part?.name || r.partId}</div>
                            <div style={s.requestMeta}>
                              Requested by <b>{requester?.name || "Unknown"}</b> &nbsp;&middot;&nbsp; Qty: {r.qty}
                            </div>
                            {r.note && <div style={s.requestNote}>"{r.note}"</div>}
                            <div style={s.requestTime}>{new Date(r.timestamp).toLocaleString()}</div>
                          </div>
                          <div style={{ ...s.statusPill, color: statusColor(r.status), borderColor: statusColor(r.status) }}>
                            {r.status.toUpperCase()}
                          </div>
                        </div>

                        {r.status === "pending" && (
                          <div style={s.requestActions}>
                            <button style={s.approveBtn} onClick={() => respondToRequest(r.id, "approved")}>
                              APPROVE
                            </button>
                            <button style={s.rejectBtn} onClick={() => respondToRequest(r.id, "rejected")}>
                              REJECT
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}

            {/* OUTGOING */}
            {requestsTab === "outgoing" && (
              <div>
                {outgoingRequests.length === 0 && <div style={s.empty}>No outgoing requests</div>}
                {outgoingRequests
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .map((r) => {
                    const owner = getMember(r.ownerId);
                    const part = getPart(r.partId);
                    return (
                      <div key={r.id} style={{ ...s.requestCard, background: statusBg(r.status) }}>
                        <div style={s.requestHeader}>
                          <div>
                            <div style={s.requestPartName}>{part?.name || r.partId}</div>
                            <div style={s.requestMeta}>
                              Owner: <b>{owner?.name || "Unknown"}</b> &nbsp;&middot;&nbsp; Qty: {r.qty}
                            </div>
                            {r.note && <div style={s.requestNote}>"{r.note}"</div>}
                            <div style={s.requestTime}>{new Date(r.timestamp).toLocaleString()}</div>
                          </div>
                          <div style={{ ...s.statusPill, color: statusColor(r.status), borderColor: statusColor(r.status) }}>
                            {r.status.toUpperCase()}
                          </div>
                        </div>

                        <div style={s.requestActions}>
                          {r.status === "pending" && (
                            <button style={s.dangerBtn} onClick={() => cancelRequest(r.id)}>
                              CANCEL
                            </button>
                          )}
                          {r.status === "approved" && (
                            <button style={s.ghostBtn} onClick={() => returnPart(r.id)}>
                              RETURN PART
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ===== MEMBERS ===== */}
        {view === "members" && (
          <div>
            <div style={s.toolbar}>
              <div style={s.sectionTitle}>MEMBERS</div>
              <button style={s.primaryBtn} onClick={() => setAddMemberModal(true)}>+ ADD MEMBER</button>
            </div>

            {members.length === 0 && <div style={s.empty}>No members found</div>}

            <div style={s.memberList}>
              {members.map((m) => {
                const ownedParts = parts.filter((p) => p.ownerId === m.id);
                const isCurrentUser = m.id === currentUser.id;
                return (
                  <div key={m.id} style={{ ...s.memberCard, ...(isCurrentUser ? s.memberCardActive : {}) }}>
                    <div style={s.memberInfo}>
                      <div style={s.memberAvatar}>{m.name.charAt(0).toUpperCase()}</div>
                      <div>
                        <div style={s.memberName}>
                          {m.name}
                          {isCurrentUser && <span style={s.youTag}>&nbsp;YOU</span>}
                        </div>
                        <div style={s.memberRole}>{m.role}</div>
                        <div style={s.memberPartCount}>{ownedParts.length} part{ownedParts.length !== 1 ? "s" : ""} owned</div>
                      </div>
                    </div>
                    <div style={s.memberActions}>
                      <button style={s.ghostBtn} onClick={() => setEditMember({ ...m })}>EDIT</button>
                      <button
                        style={s.dangerBtn}
                        onClick={() => setConfirmDelete({ type: "member", id: m.id, name: m.name })}
                      >
                        DELETE
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* ===== MODAL: REQUEST PART ===== */}
      {requestModal && (
        <Modal onClose={() => setRequestModal(null)}>
          <div style={s.modalTitle}>REQUEST PART</div>
          <div style={s.modalPartName}>{requestModal.name}</div>
          <div style={s.modalLabel}>QUANTITY</div>
          <input
            type="number"
            min={1}
            max={requestModal.available ?? requestModal.qty}
            value={requestQty}
            onChange={(e) => setRequestQty(e.target.value)}
            style={s.modalInput}
          />
          <div style={s.modalLabel}>NOTE (OPTIONAL)</div>
          <textarea
            placeholder="Why do you need this part?"
            value={requestNote}
            onChange={(e) => setRequestNote(e.target.value)}
            style={{ ...s.modalInput, height: 80, resize: "vertical" }}
          />
          <div style={s.modalActions}>
            <button style={s.primaryBtn} onClick={submitRequest}>SEND REQUEST</button>
            <button style={s.ghostBtn} onClick={() => setRequestModal(null)}>CANCEL</button>
          </div>
        </Modal>
      )}

      {/* ===== MODAL: ADD PART ===== */}
      {addPartModal && (
        <Modal onClose={() => setAddPartModal(false)}>
          <div style={s.modalTitle}>ADD PART</div>
          <div style={s.modalLabel}>NAME</div>
          <input
            placeholder="Part name"
            value={newPart.name}
            onChange={(e) => setNewPart({ ...newPart, name: e.target.value })}
            style={s.modalInput}
          />
          <div style={s.modalLabel}>CATEGORY</div>
          <select
            value={newPart.category}
            onChange={(e) => setNewPart({ ...newPart, category: e.target.value })}
            style={s.modalInput}
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div style={s.modalLabel}>QUANTITY</div>
          <input
            type="number"
            min={1}
            value={newPart.qty}
            onChange={(e) => setNewPart({ ...newPart, qty: e.target.value })}
            style={s.modalInput}
          />
          <div style={s.modalActions}>
            <button style={s.primaryBtn} onClick={addPart}>SAVE</button>
            <button style={s.ghostBtn} onClick={() => setAddPartModal(false)}>CANCEL</button>
          </div>
        </Modal>
      )}

      {/* ===== MODAL: EDIT PART ===== */}
      {editPart && (
        <Modal onClose={() => setEditPart(null)}>
          <div style={s.modalTitle}>EDIT PART</div>
          <div style={s.modalLabel}>NAME</div>
          <input
            value={editPart.name}
            onChange={(e) => setEditPart({ ...editPart, name: e.target.value })}
            style={s.modalInput}
          />
          <div style={s.modalLabel}>CATEGORY</div>
          <select
            value={editPart.category}
            onChange={(e) => setEditPart({ ...editPart, category: e.target.value })}
            style={s.modalInput}
          >
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div style={s.modalLabel}>TOTAL QUANTITY</div>
          <input
            type="number"
            min={0}
            value={editPart.qty}
            onChange={(e) => setEditPart({ ...editPart, qty: e.target.value })}
            style={s.modalInput}
          />
          <div style={s.modalActions}>
            <button
              style={s.primaryBtn}
              onClick={() =>
                updatePart(editPart.id, {
                  name: editPart.name,
                  category: editPart.category,
                  qty: Number(editPart.qty),
                  available: Number(editPart.qty),
                })
              }
            >
              SAVE
            </button>
            <button style={s.ghostBtn} onClick={() => setEditPart(null)}>CANCEL</button>
          </div>
        </Modal>
      )}

      {/* ===== MODAL: ADD MEMBER ===== */}
      {addMemberModal && (
        <Modal onClose={() => setAddMemberModal(false)}>
          <div style={s.modalTitle}>ADD MEMBER</div>
          <div style={s.modalLabel}>NAME</div>
          <input
            placeholder="Full name"
            value={newMember.name}
            onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
            style={s.modalInput}
          />
          <div style={s.modalLabel}>ROLE</div>
          <input
            placeholder="Role"
            value={newMember.role}
            onChange={(e) => setNewMember({ ...newMember, role: e.target.value })}
            style={s.modalInput}
          />
          <div style={s.modalActions}>
            <button style={s.primaryBtn} onClick={addMember}>SAVE</button>
            <button style={s.ghostBtn} onClick={() => setAddMemberModal(false)}>CANCEL</button>
          </div>
        </Modal>
      )}

      {/* ===== MODAL: EDIT MEMBER ===== */}
      {editMember && (
        <Modal onClose={() => setEditMember(null)}>
          <div style={s.modalTitle}>EDIT MEMBER</div>
          <div style={s.modalLabel}>NAME</div>
          <input
            value={editMember.name}
            onChange={(e) => setEditMember({ ...editMember, name: e.target.value })}
            style={s.modalInput}
          />
          <div style={s.modalLabel}>ROLE</div>
          <input
            value={editMember.role}
            onChange={(e) => setEditMember({ ...editMember, role: e.target.value })}
            style={s.modalInput}
          />
          <div style={s.modalActions}>
            <button
              style={s.primaryBtn}
              onClick={() => updateMember(editMember.id, { name: editMember.name, role: editMember.role })}
            >
              SAVE
            </button>
            <button style={s.ghostBtn} onClick={() => setEditMember(null)}>CANCEL</button>
          </div>
        </Modal>
      )}

      {/* ===== MODAL: CONFIRM DELETE ===== */}
      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)}>
          <div style={s.modalTitle}>CONFIRM DELETE</div>
          <div style={{ color: "#aaa", marginBottom: 24, fontSize: 14 }}>
            Are you sure you want to delete <b style={{ color: "#fff" }}>{confirmDelete.name}</b>?
            This action cannot be undone.
          </div>
          <div style={s.modalActions}>
            <button
              style={s.dangerBtnLg}
              onClick={() => {
                if (confirmDelete.type === "part") deletePart(confirmDelete.id);
                else deleteMember(confirmDelete.id);
              }}
            >
              DELETE
            </button>
            <button style={s.ghostBtn} onClick={() => setConfirmDelete(null)}>CANCEL</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Reusable modal wrapper
function Modal({ children, onClose }) {
  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={s.modalBox} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

// ---------------- STYLES ----------------
const s = {
  root: {
    background: "#0a0a0a",
    color: "#fff",
    minHeight: "100vh",
    fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
    fontSize: 13,
  },
  loadingScreen: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#0a0a0a",
    color: "#fff",
    fontFamily: "monospace",
    letterSpacing: 4,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "0 32px",
    height: 56,
    borderBottom: "1px solid #1e1e1e",
    position: "sticky",
    top: 0,
    background: "#0a0a0a",
    zIndex: 100,
  },
  logo: {
    fontSize: 13,
    letterSpacing: 4,
    fontWeight: 700,
    color: "#fff",
  },
  nav: {
    display: "flex",
    gap: 4,
    alignItems: "center",
  },
  navBtn: {
    background: "transparent",
    color: "#555",
    border: "none",
    padding: "6px 14px",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: 600,
    position: "relative",
    transition: "color 0.15s",
  },
  navBtnActive: {
    color: "#fff",
    borderBottom: "1px solid #fff",
  },
  badge: {
    display: "inline-block",
    background: "#fff",
    color: "#000",
    borderRadius: 10,
    fontSize: 9,
    fontWeight: 700,
    padding: "1px 5px",
    marginLeft: 5,
    verticalAlign: "middle",
  },
  divider: {
    width: 1,
    height: 20,
    background: "#222",
    margin: "0 8px",
  },
  select: {
    background: "#111",
    color: "#fff",
    border: "1px solid #2a2a2a",
    padding: "6px 10px",
    fontFamily: "inherit",
    fontSize: 11,
    cursor: "pointer",
    letterSpacing: 1,
  },
  main: {
    padding: "28px 32px",
    maxWidth: 1100,
    margin: "0 auto",
  },
  toolbar: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    marginBottom: 24,
    flexWrap: "wrap",
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 3,
    color: "#888",
    fontWeight: 700,
    flex: 1,
  },
  searchInput: {
    background: "#111",
    color: "#fff",
    border: "1px solid #222",
    padding: "9px 14px",
    fontFamily: "inherit",
    fontSize: 12,
    flex: 1,
    minWidth: 200,
    outline: "none",
  },
  filterSelect: {
    background: "#111",
    color: "#fff",
    border: "1px solid #222",
    padding: "9px 14px",
    fontFamily: "inherit",
    fontSize: 12,
    cursor: "pointer",
  },
  primaryBtn: {
    background: "#fff",
    color: "#000",
    border: "none",
    padding: "9px 18px",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: 700,
    whiteSpace: "nowrap",
    transition: "opacity 0.15s",
  },
  ghostBtn: {
    background: "transparent",
    color: "#aaa",
    border: "1px solid #2a2a2a",
    padding: "8px 16px",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: 600,
    whiteSpace: "nowrap",
    transition: "border-color 0.15s, color 0.15s",
  },
  dangerBtn: {
    background: "transparent",
    color: "#555",
    border: "1px solid #2a2a2a",
    padding: "8px 16px",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  dangerBtnLg: {
    background: "#1a1a1a",
    color: "#ff4444",
    border: "1px solid #ff4444",
    padding: "10px 24px",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: 700,
  },
  approveBtn: {
    background: "#fff",
    color: "#000",
    border: "none",
    padding: "8px 20px",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: 700,
  },
  rejectBtn: {
    background: "transparent",
    color: "#888",
    border: "1px solid #333",
    padding: "8px 20px",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: 600,
  },
  empty: {
    color: "#333",
    textAlign: "center",
    padding: "60px 0",
    letterSpacing: 2,
    fontSize: 12,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
    gap: 12,
  },
  partCard: {
    border: "1px solid #1e1e1e",
    padding: "18px 20px",
    background: "#0f0f0f",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  partCardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  partName: {
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: 1,
    marginBottom: 3,
  },
  partMeta: {
    fontSize: 11,
    color: "#555",
    letterSpacing: 1,
  },
  partQtyBlock: {
    textAlign: "right",
  },
  partQtyNum: {
    fontSize: 20,
    fontWeight: 700,
  },
  partQtyOf: {
    fontSize: 12,
    color: "#444",
    marginLeft: 2,
  },
  progressBarBg: {
    height: 2,
    background: "#1e1e1e",
    width: "100%",
  },
  progressBarFill: {
    height: 2,
    background: "#fff",
    transition: "width 0.4s ease",
  },
  partOwner: {
    fontSize: 11,
    color: "#444",
    letterSpacing: 0.5,
  },
  partActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    marginTop: 4,
  },
  ownerTag: {
    fontSize: 9,
    letterSpacing: 2,
    color: "#333",
    border: "1px solid #1e1e1e",
    padding: "4px 8px",
  },
  tabRow: {
    display: "flex",
    gap: 0,
    borderBottom: "1px solid #1e1e1e",
    marginBottom: 24,
  },
  tabBtn: {
    background: "transparent",
    color: "#444",
    border: "none",
    borderBottom: "2px solid transparent",
    padding: "10px 20px",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: 600,
    marginBottom: -1,
    position: "relative",
  },
  tabBtnActive: {
    color: "#fff",
    borderBottom: "2px solid #fff",
  },
  requestCard: {
    border: "1px solid #1e1e1e",
    padding: "18px 20px",
    marginBottom: 10,
  },
  requestHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
  },
  requestPartName: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 5,
    letterSpacing: 0.5,
  },
  requestMeta: {
    fontSize: 12,
    color: "#666",
    marginBottom: 4,
  },
  requestNote: {
    fontSize: 12,
    color: "#555",
    fontStyle: "italic",
    marginBottom: 4,
  },
  requestTime: {
    fontSize: 10,
    color: "#333",
    letterSpacing: 0.5,
    marginTop: 4,
  },
  statusPill: {
    border: "1px solid",
    padding: "4px 10px",
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  requestActions: {
    display: "flex",
    gap: 8,
    marginTop: 14,
  },
  memberList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  memberCard: {
    border: "1px solid #1e1e1e",
    padding: "16px 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "#0f0f0f",
  },
  memberCardActive: {
    borderColor: "#333",
  },
  memberInfo: {
    display: "flex",
    gap: 16,
    alignItems: "center",
  },
  memberAvatar: {
    width: 38,
    height: 38,
    background: "#1a1a1a",
    border: "1px solid #2a2a2a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 15,
    fontWeight: 700,
    flexShrink: 0,
  },
  memberName: {
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  memberRole: {
    fontSize: 11,
    color: "#555",
    letterSpacing: 1,
    marginBottom: 2,
  },
  memberPartCount: {
    fontSize: 10,
    color: "#333",
    letterSpacing: 1,
  },
  memberActions: {
    display: "flex",
    gap: 8,
  },
  youTag: {
    fontSize: 9,
    letterSpacing: 2,
    color: "#fff",
    background: "#222",
    padding: "2px 6px",
    verticalAlign: "middle",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.85)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 200,
    backdropFilter: "blur(2px)",
  },
  modalBox: {
    background: "#0f0f0f",
    border: "1px solid #222",
    padding: "32px 36px",
    width: "100%",
    maxWidth: 420,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  modalTitle: {
    fontSize: 12,
    letterSpacing: 4,
    fontWeight: 700,
    color: "#fff",
    marginBottom: 8,
    borderBottom: "1px solid #1e1e1e",
    paddingBottom: 12,
  },
  modalPartName: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 8,
    letterSpacing: 1,
  },
  modalLabel: {
    fontSize: 9,
    letterSpacing: 3,
    color: "#555",
    fontWeight: 700,
    marginTop: 6,
  },
  modalInput: {
    background: "#111",
    color: "#fff",
    border: "1px solid #222",
    padding: "10px 14px",
    fontFamily: "inherit",
    fontSize: 13,
    width: "100%",
    boxSizing: "border-box",
    outline: "none",
  },
  modalActions: {
    display: "flex",
    gap: 10,
    marginTop: 16,
  },
  toast: {
    position: "fixed",
    top: 66,
    right: 24,
    background: "#111",
    color: "#fff",
    padding: "10px 18px",
    border: "1px solid #fff",
    fontSize: 12,
    letterSpacing: 1,
    zIndex: 300,
    fontFamily: "'IBM Plex Mono', monospace",
  },
};