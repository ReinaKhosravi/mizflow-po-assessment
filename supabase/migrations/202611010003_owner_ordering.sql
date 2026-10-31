begin;
-- Managers can operate all staff workflows, only in their own restaurant.
create or replace function private.require_staff(r uuid,b uuid,staff public.staff_role) returns uuid
language plpgsql set search_path='' as $$
declare actor uuid;
begin
  actor=auth.uid();
  if actor is null then raise exception 'MF_FORBIDDEN' using errcode='42501'; end if;
  perform 1 from public.restaurant_memberships m where m.restaurant_id=r and m.user_id=actor
    and m.revoked_at is null and (
      (m.role=staff and m.branch_id=b)
      or (m.role='owner' and m.branch_id is null)
    ) for share;
  if not found then raise exception 'MF_FORBIDDEN' using errcode='42501'; end if;
  return actor;
end; $$;
revoke all on function private.require_staff(uuid,uuid,public.staff_role) from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
