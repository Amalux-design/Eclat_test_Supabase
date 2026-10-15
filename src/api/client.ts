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
    const { data, error } = await supabase
      .from("bookings")
      .select(admin ? ADMIN_SELECT : PUBLIC_SELECT)
      .order("date", { ascending: false });
    if (error) throw toApiError(error, "Couldn't load bookings.");
    return (data as unknown as BookingRow[]).map(fromRow);
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
    if (log.photos.length) await removePhotoFiles(log.photos);
    const { error } = await supabase.from("bookings").delete().eq("id", log.id);
    if (error) throw toApiError(error, "Couldn't delete the booking.");
  },

  /* ---------- photos ---------- */

  async addPhotos(bookingId: string, workDate: string, files: File[]): Promise<void> {
    for (const file of files) {
      const { full, thumb } = await compressPhoto(file);
      const key = generateId();
      const path = `${bookingId}/${key}.jpg`;
      const thumbPath = `${bookingId}/${key}-thumb.jpg`;
      const up1 = await supabase.storage.from(PHOTO_BUCKET).upload(path, full, { contentType: "image/jpeg", upsert: true });
      if (up1.error) throw toApiError(up1.error, "Couldn't upload a photo.");
      const up2 = await supabase.storage.from(PHOTO_BUCKET).upload(thumbPath, thumb, { contentType: "image/jpeg", upsert: true });
      if (up2.error) throw toApiError(up2.error, "Couldn't upload a photo.");
      const { error } = await supabase
        .from("booking_photos")
        .insert({ booking_id: bookingId, path, thumb_path: thumbPath, work_date: workDate });
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
    const { data, error } = await supabase.from("members").select("*").order("created_at");
    if (error) throw toApiError(error, "Couldn't load the team.");
    return (data ?? []).map((m) => ({
      email: m.email,
      name: m.name ?? "",
      role: m.role as Role,
      active: m.active,
      createdAt: m.created_at,
    }));
  },

  async saveMember(m: { email: string; name: string; role: Role; active: boolean }): Promise<void> {
    const { error } = await supabase
      .from("members")
      .upsert({ email: m.email.trim().toLowerCase(), name: m.name.trim(), role: m.role, active: m.active });
    if (error) throw toApiError(error, "Couldn't save the team member.");
  },

  async deleteMember(email: string): Promise<void> {
    const { error } = await supabase.from("members").delete().eq("email", email.toLowerCase());
    if (error) throw toApiError(error, "Couldn't remove the team member.");
  },
};

const urlCache = new Map<string, { url: string; expires: number }>();

async function removePhotoFiles(photos: BookingPhoto[]) {
  const paths = photos.flatMap((p) => [p.path, p.thumbPath]);
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(paths);
  if (error) throw toApiError(error, "Couldn't remove photo files.");
  paths.forEach((p) => urlCache.delete(p));
}
