import { db } from "../lib/firebase";
import { ref, onValue, push, update, remove } from "firebase/database";
import { useState, useEffect } from "react";

const DEFAULT_USER = {
  id: "member_4",
  name: "Nisha Kapoor",
  role: "Software Lead",
};

export default function PartsManager() {
  const [parts, setParts] = useState([]);
  const [members, setMembers] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState("inventory");
  const [search, setSearch] = useState("");

  const [requestModal, setRequestModal] = useState(null);
  const [addPartModal, setAddPartModal] = useState(false);
  const [editMember, setEditMember] = useState(null);
  const [editPart, setEditPart] = useState(null);

  const [addMemberModal, setAddMemberModal] = useState(false);
  const [newMember, setNewMember] = useState({
    name: "",
    role: "",
  });

  const [notification, setNotification] = useState(null);

  const [activeUserId, setActiveUserId] = useState(DEFAULT_USER.id);
  const currentUser =
    members.find((m) => m.id === activeUserId) || DEFAULT_USER;

  const [newPart, setNewPart] = useState({
    name: "",
    category: "Sensor",
    qty: 1,
    ownerId: activeUserId,
  });

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

  const showNotification = (msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2500);
  };

  const getMember = (id) => members.find((m) => m.id === id);

  const filteredParts = parts.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

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
    showNotification("Part added");
  };

  const updateMember = async (id, data) => {
    await update(ref(db, `members/${id}`), data);
    showNotification("Member updated");
  };

  const deleteMember = async (id) => {
    await remove(ref(db, `members/${id}`));
    showNotification("Member deleted");
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

  const updatePart = async (id, data) => {
    await update(ref(db, `parts/${id}`), data);
    showNotification("Part updated");
  };

  const deletePart = async (id) => {
    await remove(ref(db, `parts/${id}`));
    showNotification("Part deleted");
  };

  const submitRequest = async (part) => {
    await push(ref(db, "requests"), {
      partId: part.id,
      requesterId: currentUser.id,
      ownerId: part.ownerId,
      qty: 1,
      status: "pending",
      timestamp: Date.now(),
    });

    setRequestModal(null);
    showNotification("Request sent");
  };

  if (loading) return <div style={styles.center}>Loading...</div>;

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <div>INVENTORY</div>

        <nav style={styles.nav}>
          <button onClick={() => setView("inventory")}>Inventory</button>
          <button onClick={() => setView("requests")}>Requests</button>
          <button onClick={() => setView("members")}>Members</button>

          <select
            style={styles.select}
            value={activeUserId}
            onChange={(e) => setActiveUserId(e.target.value)}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </nav>
      </header>

      {notification && <div style={styles.toast}>{notification}</div>}

      <main style={styles.main}>
        {/* INVENTORY */}
        {view === "inventory" && (
          <>
            <input
              placeholder="Search parts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.input}
            />

            <button onClick={() => setAddPartModal(true)}>
              + Add Part
            </button>

            {filteredParts.map((p) => {
              const owner = getMember(p.ownerId);

              return (
                <div key={p.id} style={styles.card}>
                  <div><b>{p.name}</b></div>
                  <div>{p.category}</div>
                  <div>Owner: {owner?.name}</div>

                  <button onClick={() => setRequestModal(p)}>
                    Request
                  </button>

                  <button
                    style={styles.editBtn}
                    onClick={() => setEditPart(p)}
                  >
                    Edit
                  </button>

                  <button
                    style={styles.editBtn}
                    onClick={() => deletePart(p.id)}
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </>
        )}

        {/* MEMBERS */}
        {view === "members" && (
          <>
            <h3 style={{ marginBottom: 10 }}>MEMBERS</h3>

            <button onClick={() => setAddMemberModal(true)}>
              + Add Member
            </button>

            {members.map((m) => (
              <div key={m.id} style={styles.cardRow}>
                <div>
                  <b>{m.name}</b>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    {m.role}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    style={styles.editBtn}
                    onClick={() => setEditMember(m)}
                  >
                    Edit Member
                  </button>

                  <button
                    style={styles.editBtn}
                    onClick={() => deleteMember(m.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* REQUESTS */}
        {view === "requests" && (
          <>
            {requests.map((r) => (
              <div key={r.id} style={styles.card}>
                <div>Request for: {r.partId}</div>
                <div>Status: {r.status}</div>
              </div>
            ))}
          </>
        )}
      </main>

      {/* ADD PART */}
      {addPartModal && (
        <div style={styles.modal}>
          <input
            placeholder="Name"
            onChange={(e) =>
              setNewPart({ ...newPart, name: e.target.value })
            }
          />
          <button onClick={addPart}>Save</button>
          <button onClick={() => setAddPartModal(false)}>Cancel</button>
        </div>
      )}

      {/* ADD MEMBER */}
      {addMemberModal && (
        <div style={styles.modal}>
          <input
            placeholder="Name"
            value={newMember.name}
            onChange={(e) =>
              setNewMember({ ...newMember, name: e.target.value })
            }
          />

          <input
            placeholder="Role"
            value={newMember.role}
            onChange={(e) =>
              setNewMember({ ...newMember, role: e.target.value })
            }
          />

          <button onClick={addMember}>Save</button>
          <button onClick={() => setAddMemberModal(false)}>
            Cancel
          </button>
        </div>
      )}

      {/* EDIT MEMBER */}
      {editMember && (
        <div style={styles.modal}>
          <input
            value={editMember.name}
            onChange={(e) =>
              setEditMember({ ...editMember, name: e.target.value })
            }
          />

          <input
            value={editMember.role}
            onChange={(e) =>
              setEditMember({ ...editMember, role: e.target.value })
            }
          />

          <button
            onClick={() => {
              updateMember(editMember.id, {
                name: editMember.name,
                role: editMember.role,
              });
              setEditMember(null);
            }}
          >
            Save
          </button>

          <button onClick={() => setEditMember(null)}>
            Cancel
          </button>
        </div>
      )}

      {/* EDIT PART */}
      {editPart && (
        <div style={styles.modal}>
          <input
            value={editPart.name}
            onChange={(e) =>
              setEditPart({ ...editPart, name: e.target.value })
            }
          />

          <input
            value={editPart.category}
            onChange={(e) =>
              setEditPart({ ...editPart, category: e.target.value })
            }
          />

          <input
            type="number"
            value={editPart.qty}
            onChange={(e) =>
              setEditPart({ ...editPart, qty: e.target.value })
            }
          />

          <button
            onClick={() => {
              updatePart(editPart.id, {
                name: editPart.name,
                category: editPart.category,
                qty: Number(editPart.qty),
                available: Number(editPart.qty),
              });
              setEditPart(null);
            }}
          >
            Save
          </button>

          <button onClick={() => setEditPart(null)}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------- STYLES ----------------
const styles = {
  root: {
    background: "#000",
    color: "#fff",
    minHeight: "100vh",
    fontFamily: "monospace",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    padding: 20,
    borderBottom: "1px solid #222",
  },
  nav: { display: "flex", gap: 10, alignItems: "center" },
  main: { padding: 20 },

  card: {
    border: "1px solid #222",
    padding: 10,
    marginTop: 10,
  },

  cardRow: {
    border: "1px solid #222",
    padding: 10,
    marginTop: 10,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  input: {
    background: "#000",
    color: "#fff",
    border: "1px solid #333",
    padding: 8,
    marginBottom: 10,
  },

  editBtn: {
    border: "1px solid #fff",
    background: "transparent",
    color: "#fff",
    padding: "6px 10px",
    cursor: "pointer",
  },

  select: {
    background: "#000",
    color: "#fff",
    border: "1px solid #333",
    padding: 5,
  },

  modal: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.9)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    justifyContent: "center",
    alignItems: "center",
  },

  toast: {
    position: "fixed",
    top: 20,
    right: 20,
    background: "#111",
    padding: 10,
    border: "1px solid #333",
  },

  center: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
};