export type AttendanceStatus = "present" | "absent";
export type AbsenceReason = "sick" | "vacation" | "unexcused";
export type UserRole = "owner" | "teacher";

export interface Child {
  id: string;
  kindergarten_id: string;
  group_id: string | null;
  full_name: string;
  monthly_fee: number | null;
  active: boolean;
  parent_chat_id: number | null;
  parent_link_code: string | null;
  parent_linked_at: string | null;
  created_at: string;
}

export interface Group {
  id: string;
  kindergarten_id: string;
  name: string;
  teacher_id: string | null;
  sort_order: number;
}

export interface AttendanceRow {
  id: string;
  kindergarten_id: string;
  child_id: string;
  day: string;
  status: AttendanceStatus;
  arrived_at: string | null;
  photo_path: string | null;
  photo_uploaded_at: string | null;
  absence_reason: AbsenceReason | null;
  marked_by: string | null;
  parent_notified_at: string | null;
  created_at: string;
  updated_at: string;
}
