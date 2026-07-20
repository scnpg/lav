-- Adds two access categories requested for the submission wizard's access
-- picker: 'id_required' (show ID, no purchase/staff-ask needed) and
-- 'student_faculty_only' (campus buildings gated by student/staff status) -
-- distinct from the existing 'customer_only'/'employee_only'/'ask_staff'
-- values, which don't cover either case. Additive only: every existing row's
-- access_type is already one of the values below, so this can't invalidate
-- any current data.
alter table bathrooms drop constraint bathrooms_access_type_check;

alter table bathrooms add constraint bathrooms_access_type_check
  check (access_type in (
    'public', 'customer_only', 'purchase_required', 'receipt_code', 'ask_staff',
    'key_required', 'code_required', 'employee_only', 'ticket_required',
    'hotel_guest_only', 'event_only', 'private_rare', 'id_required',
    'student_faculty_only', 'unknown'
  ));
