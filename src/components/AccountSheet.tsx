import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Sheet } from "./Sheet";
import { useAuth } from "../context/AuthContext";
import { useConfirm } from "./ConfirmDialog";
import { useNotice } from "./Notice";
import { api } from "../api/client";
import type { Member, Role } from "../types";

const ROLE_LABEL: Record<Role, string> = { owner: "Owner", admin: "Admin", team: "Team" };
const ROLE_HINT: Record<Role, string> = {
  owner: "Everything, plus managing the team",
  admin: "Everything: contacts, payments, editing",
  team: "Schedule, services, notes and photos only",
};

/** Account details, sign out, and (for the owner) team access. */
export function AccountSheet({ onClose }: { onClose: () => void }) {
  const { email, name, role, isOwner, signOut } = useAuth();
  const confirm = useConfirm();
  const notify = useNotice();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ email: "", name: "", role: "team" as Role });
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setMembers(await api.listMembers());
    } catch (e) {
      notify(e instanceof Error ? e.message : "Couldn't load the team.", "error");
    }
  }

  useEffect(() => {
    if (isOwner) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner]);

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(draft.email.trim())) {
      notify("Enter a valid email address.", "error");
      return;
    }
    setBusy(true);
    try {
      await api.saveMember({ ...draft, active: true });
      notify(`${draft.name || draft.email} can now sign in with ${draft.email.trim().toLowerCase()}.`);
      setDraft({ email: "", name: "", role: "team" });
      setAdding(false);
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Couldn't add them.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(m: Member) {
    const removing = m.active;
    if (
      removing &&
      !(await confirm({
        title: `Remove ${m.name || m.email}?`,
        message: "They'll lose access straight away, on every device. You can restore them later.",
        confirmLabel: "Remove access",
        destructive: true,
      }))
    )
      return;
    try {
      await api.saveMember({ ...m, active: !m.active });
      notify(removing ? "Access removed." : "Access restored.");
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Couldn't update access.", "error");
    }
  }

  async function changeRole(m: Member, next: Role) {
    try {
      await api.saveMember({ ...m, role: next });
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Couldn't change the role.", "error");
    }
  }

  return (
    <Sheet label="Account" onClose={onClose}>
      {(close) => (
        <>
          <div className="modal-header">
            <span />
            <h2 className="modal-title">Account</h2>
            <button className="icon-btn" onClick={close} aria-label="Close">
              <X size={20} />
            </button>
          </div>
          <div className="modal-body">
            <div className="group account-card">
              <p className="account-name">{name || email}</p>
              <p className="account-meta">
                {email} · {role ? ROLE_LABEL[role] : ""}
              </p>
            </div>

            {isOwner && (
              <section className="team">
                <div className="section-head">
                  <h3 className="section-title">Team access</h3>
                  {!adding && (
                    <button className="agenda-add" onClick={() => setAdding(true)}>
                      + Add
                    </button>
                  )}
                </div>

                {adding && (
                  <form className="group team-add" onSubmit={addMember}>
                    <input
                      className="field-input"
                      placeholder="Name"
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                      aria-label="Name"
                    />
                    <input
                      className="field-input"
                      type="email"
                      inputMode="email"
                      placeholder="Email they'll sign in with"
                      value={draft.email}
                      onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                      aria-label="Email"
                    />
                    <div className="segmented">
                      {(["team", "admin"] as Role[]).map((r) => (
                        <button
                          key={r}
                          type="button"
                          className={`segmented-btn ${draft.role === r ? "active" : ""}`}
                          onClick={() => setDraft({ ...draft, role: r })}
                        >
                          {ROLE_LABEL[r]}
                        </button>
                      ))}
                    </div>
                    <p className="field-hint">{ROLE_HINT[draft.role]}</p>
                    <div className="team-add-actions">
                      <button type="button" className="text-btn" onClick={() => setAdding(false)}>
                        Cancel
                      </button>
                      <button type="submit" className="save-pill" disabled={busy}>
                        {busy ? "Adding…" : "Add"}
                      </button>
                    </div>
                  </form>
                )}

                <div className="group list">
                  {(members ?? []).map((m) => (
                    <div key={m.email} className={`member ${m.active ? "" : "inactive"}`}>
                      <div className="member-info">
                        <p className="member-name">{m.name || m.email}</p>
                        <p className="member-email">{m.email}</p>
                      </div>
                      {m.role === "owner" ? (
                        <span className="pill pill-worked">Owner</span>
                      ) : (
                        <div className="member-actions">
                          {m.active && (
                            <button
                              className="text-btn member-role"
                              onClick={() => void changeRole(m, m.role === "admin" ? "team" : "admin")}
                              aria-label={`Change role, now ${ROLE_LABEL[m.role]}`}
                            >
                              {ROLE_LABEL[m.role]}
                            </button>
                          )}
                          <button
                            className={`text-btn member-toggle ${m.active ? "danger" : ""}`}
                            onClick={() => void toggle(m)}
                          >
                            {m.active ? "Remove" : "Restore"}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {members === null && <p className="agenda-empty">Loading team…</p>}
                </div>
                <p className="field-hint">
                  Tap a role to switch between Team and Admin. Removing someone signs them out of the
                  bookings on every device right away.
                </p>
              </section>
            )}

            <button
              className="ghost-btn full"
              onClick={async () => {
                close();
                await signOut();
              }}
            >
              Sign out
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
