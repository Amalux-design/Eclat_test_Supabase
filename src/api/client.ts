// Data layer on Supabase. Online-only: every call goes straight to the
// database, and row-level security (supabase/schema.sql) decides what each
// signed-in person may read or change.
import { PHOTO_BUCKET, supabase } from "../lib/supabase";
import type { BookingPhoto, Member, Role, WorkLog, WorkLogInput } from "../types";
import { compressPhoto } from "../utils/image";
import { generateId } from "../utils/id";

export type ApiErrorCode = "AUTH" | "CONFLICT" | "NOT_FOUND" | "VALIDATION" | "NETWORK" | "ERROR";

export class ApiError extends Error {
  code: ApiErrorCode;
  constructor(message: string, code: ApiErrorCode) {
    super(message);
    this.code = code;
  }
}

/** Map a Supabase/Postgres error to one of our codes and plain-English text. */
function toApiError(err: { message?: string; code?: string } | null | undefined, fallback: string): ApiError {
  const msg = err?.message ?? "";
  if (/^CONFLICT/.test(msg)) return new ApiError("This booking was changed on another device.", "CONFLICT");
  if (/^NOT_FOUND/.test(msg)) return new ApiError("This booking was deleted on another device.", "NOT_FOUND");
  if (/^VALIDATION/.test(msg)) return new ApiError(msg.replace(/^VALIDATION:\s*/, ""), "VALIDATION");
  if (err?.code === "42501" || /row-level security|permission denied|JWT/i.test(msg))
    return new ApiError("You don't have permission to do that.", "AUTH");
  if (/Failed to fetch|NetworkError|network|fetch/i.test(msg))
    return new ApiError("Couldn't reach the server. Check your connection and try again.", "NETWORK");
  return new ApiError(msg || fallback, "ERROR");
}

// One key per picked file, so a retried upload replaces itself instead of adding a copy.
const photoKeys = new WeakMap<File, string>();

/* ---------- row ↔ WorkLog mapping ---------- */

interface BookingRow {
  id: string;
  date: string;
  client_name: string;
  work: string;
  event_type: string;
  location: string;
  bridesmaids: number;
  status: "RESERVED" | "WORKED";
  start_time: string;
  end_time: string;
  notes: string;
  created_at: string;
  updated_at: string;
  booking_private?: PrivateRow | PrivateRow[] | null;
  booking_photos?: { id: string; path: string; thumb_path: string }[] | null;
}

interface PrivateRow {
  client_phone: string;
  alt_phone: string;
  qty: number;
  price: number | string;
  amount: number | string;
  paid_amount: number | string;
  payment_status: "PENDING" | "PAID";
  own: boolean;
  referrer_name: string;
  private_notes: string;
}

function fromRow(r: BookingRow): WorkLog {
  const p = Array.isArray(r.booking_private) ? r.booking_private[0] : r.booking_private;
  return {
    id: r.id,
    date: String(r.date).slice(0, 10),
    clientName: r.client_name ?? "",
    work: r.work ?? "",
    eventType: r.event_type ?? "",
    location: r.location ?? "",
    bridesmaids: Number(r.bridesmaids) || 0,
    status: r.status ?? "RESERVED",
    startTime: r.start_time ?? "",
    endTime: r.end_time ?? "",
    notes: r.notes ?? "",
    // Team members never receive the private row; neutral defaults keep the UI simple.
    clientPhone: p?.client_phone ?? "",
    altPhone: p?.alt_phone ?? "",
    qty: Number(p?.qty) || 1,
    price: Number(p?.price) || 0,
    amount: Number(p?.amount) || 0,
    paidAmount: Number(p?.paid_amount) || 0,
    paymentStatus: p?.payment_status ?? "PENDING",
    own: p?.own ?? true,
    referrerName: p?.referrer_name ?? "",
    privateNotes: p?.private_notes ?? "",
    photos: (r.booking_photos ?? []).map((ph) => ({ id: ph.id, path: ph.path, thumbPath: ph.thumb_path })),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function publicPart(log: WorkLogInput & { id: string }) {
  return {
    id: log.id,
    date: log.date,
    client_name: log.clientName,
    work: log.work,
    event_type: log.eventType,
    location: log.location,
    bridesmaids: log.bridesmaids,
    status: log.status,
    start_time: log.startTime,
    end_time: log.endTime,
    notes: log.notes,
  };
}

function privatePart(log: WorkLogInput) {
  return {
    client_phone: log.clientPhone,
    alt_phone: log.altPhone,
    qty: log.qty,
    price: log.price,
    amount: log.amount,
    paid_amount: log.paidAmount,
    payment_status: log.paymentStatus,
    own: log.own,
    referrer_name: log.referrerName,
    private_notes: log.privateNotes,
  };
}

const PUBLIC_SELECT = "*, booking_photos(id, path, thumb_path)";
const ADMIN_SELECT = "*, booking_photos(id, path, thumb_path), booking_private(*)";

/* ---------- bookings ---------- */

export const api = {
  async fetchBookings(admin: boolean): Promise<WorkLog[]> {
    // The server returns at most 1,000 rows per request. Page by id (stable while
    // others add or delete) until the count from the first page is reached.
    const all: BookingRow[] = [];
    let total = Infinity;
    while (all.length < total) {
      let query = supabase
        .from("bookings")
        .select(admin ? ADMIN_SELECT : PUBLIC_SELECT, all.length ? undefined : { count: "exact" });
      if (all.length) query = query.gt("id", all[all.length - 1].id);
      const { data, error, count } = await query.order("id").limit(1000);
      if (error) throw toApiError(error, "Couldn't load bookings.");
      const page = (data ?? []) as unknown as BookingRow[];
      if (!all.length && count != null) total = count;
      all.push(...page);
      if (!page.length) break;
    }
    return all.map(fromRow).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  },

  async fetchBooking(id: string, admin: boolean): Promise<WorkLog | null> {
    const { data, error } = await supabase
      .from("bookings")
      .select(admin ? ADMIN_SELECT : PUBLIC_SELECT)
      .eq("id", id)
      .maybeSingle();
    if (error) throw toApiError(error, "Couldn't load the booking.");
    return data ? fromRow(data as unknown as BookingRow) : null;
  },

  /**
   * Create (base = null) or update (base = the updatedAt the edit started
   * from). Booking and private details save together in one transaction.
   */
  async saveBooking(log: WorkLogInput & { id: string }, base: string | null): Promise<string> {
    const { data, error } = await supabase.rpc("save_booking", {
      b: publicPart(log),
      p: privatePart(log),
      base,
    });
    if (error) throw toApiError(error, "Couldn't save the booking.");
    return data as string;
  },

  async deleteBooking(log: Pick<WorkLog, "id" | "photos">): Promise<void> {
    const { data, error } = await supabase.from("bookings").delete().eq("id", log.id).select("id");
    if (error) throw toApiError(error, "Couldn't delete the booking.");
    if (!data?.length) {
      // Nothing deleted: fine if it's already gone, refused if it's still there.
      const check = await supabase.from("bookings").select("id").eq("id", log.id).maybeSingle();
      if (check.error) throw toApiError(check.error, "Couldn't delete the booking.");
      if (check.data) throw new ApiError("You don't have permission to delete this booking.", "AUTH");
    }
    // Only now: files can't be brought back. A failure here leaves an unused file, nothing worse.
    if (log.photos.length) await removePhotoFiles(log.photos).catch((e) => console.warn("Photo files left behind:", e));
  },

  /* ---------- photos ---------- */

  async addPhotos(bookingId: string, workDate: string, files: File[]): Promise<void> {
    for (const file of files) {
      const { full, thumb } = await compressPhoto(file);
      const key = photoKeys.get(file) ?? generateId();
      photoKeys.set(file, key);
      const path = `${bookingId}/${key}.jpg`;
      const thumbPath = `${bookingId}/${key}-thumb.jpg`;
      const up1 = await supabase.storage.from(PHOTO_BUCKET).upload(path, full, { contentType: "image/jpeg", upsert: true });
      if (up1.error) throw toApiError(up1.error, "Couldn't upload a photo.");
      const up2 = await supabase.storage.from(PHOTO_BUCKET).upload(thumbPath, thumb, { contentType: "image/jpeg", upsert: true });
      if (up2.error) throw toApiError(up2.error, "Couldn't upload a photo.");
      const { error } = await supabase
        .from("booking_photos")
        .upsert({ id: key, booking_id: bookingId, path, thumb_path: thumbPath, work_date: workDate });
      if (error) throw toApiError(error, "Couldn't save a photo.");
    }
  },

  async removePhotos(photos: BookingPhoto[]): Promise<void> {
    if (!photos.length) return;
    await removePhotoFiles(photos);
    const { error } = await supabase.from("booking_photos").delete().in("id", photos.map((p) => p.id));
    if (error) throw toApiError(error, "Couldn't remove a photo.");
  },

  /** Short-lived links to private photos (cached for the session). */
  async photoUrls(paths: string[]): Promise<Record<string, string>> {
    const now = Date.now();
    const missing = paths.filter((p) => !urlCache.has(p) || urlCache.get(p)!.expires < now);
    if (missing.length) {
      const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(missing, 3600);
      if (error) throw toApiError(error, "Couldn't load photos.");
      for (const item of data ?? []) {
        if (item.signedUrl && item.path) urlCache.set(item.path, { url: item.signedUrl, expires: now + 50 * 60 * 1000 });
      }
    }
    return Object.fromEntries(paths.filter((p) => urlCache.has(p)).map((p) => [p, urlCache.get(p)!.url]));
  },

  /**
   * Remove photos whose work date is more than 2 months ago, files and rows.
   * Run from admin devices (at most once a day); the team can't delete.
   */
  async cleanupExpiredPhotos(): Promise<number> {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 2);
    const iso = cutoff.toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from("booking_photos")
      .select("id, path, thumb_path")
      .lt("work_date", iso)
      .limit(200);
    if (error) throw toApiError(error, "Couldn't check old photos.");
    const photos = (data ?? []).map((p) => ({ id: p.id, path: p.path, thumbPath: p.thumb_path }));
    await api.removePhotos(photos);
    return photos.length;
  },

  /* ---------- team ---------- */

  /** The signed-in person's current role (null if removed). */
  async myRole(): Promise<Role | null> {
    const { data, error } = await supabase.rpc("app_role");
    if (error) throw toApiError(error, "Couldn't check your access.");
    return (data as Role | null) ?? null;
  },

  async myMembership(email: string): Promise<{ role: Role; name: string } | null> {
    const { data, error } = await supabase
      .from("members")
      .select("role, name, active")
      .eq("email", email.toLowerCase())
      .maybeSingle();
    if (error) throw toApiError(error, "Couldn't check your access.");
    if (!data || !data.active) return null;
    return { role: data.role as Role, name: data.name ?? "" };
  },

  async listMembers(): Promise<Member[]> {
    const { data, error } = await supabase.from("members").select("*").eq("archived", false).order("created_at");
    if (error) throw toApiError(error, "Couldn't load the team.");
    return (data ?? []).map((m) => ({
      email: m.email,
      name: m.name ?? "",
      role: m.role as Role,
      active: m.active,
      createdAt: m.created_at,
    }));
  },

  /** Add someone new, or bring back someone who was deleted. Never overwrites a person still on the list. */
  async addMember(m: { email: string; name: string; role: Role }): Promise<void> {
    const email = m.email.trim().toLowerCase();
    const row = { name: m.name.trim(), role: m.role, active: true, archived: false };
    const { error } = await supabase.from("members").insert({ email, ...row });
    if (!error) return;
    // 23505 = that email already has a row.
    if (error.code !== "23505") throw toApiError(error, "Couldn't add the team member.");
    const revived = await supabase.from("members").update(row).eq("email", email).eq("archived", true).select("email");
    if (revived.error) throw toApiError(revived.error, "Couldn't add the team member.");
    if (!revived.data?.length)
      throw new ApiError("That email is already on the team. Use the list to change their role or restore them.", "VALIDATION");
  },

  /** Change one thing, only if the person is still as this screen showed them (an old screen can't undo a removal). */
  async updateMember(seen: Member, change: { role: Role } | { active: boolean }): Promise<void> {
    const { data, error } = await supabase
      .from("members")
      .update(change)
      .eq("email", seen.email)
      .eq("role", seen.role)
      .eq("active", seen.active)
      .eq("archived", false)
      .select("email");
    if (error) throw toApiError(error, "Couldn't save the team member.");
    if (!data?.length)
      throw new ApiError("Nothing changed: this person was updated on another device. Check the list and try again.", "CONFLICT");
  },

  /** Owner only: hide a removed member from the list and delete their login (see supabase/archive-members.sql). */
  async deleteMember(email: string): Promise<void> {
    const { error } = await supabase.rpc("archive_member", { p_email: email.toLowerCase() });
    if (error) throw toApiError(error, "Couldn't delete the team member.");
  },
};

const urlCache = new Map<string, { url: string; expires: number }>();

async function removePhotoFiles(photos: BookingPhoto[]) {
  const paths = photos.flatMap((p) => [p.path, p.thumbPath]);
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(paths);
  if (error) throw toApiError(error, "Couldn't remove photo files.");
  paths.forEach((p) => urlCache.delete(p));
}
