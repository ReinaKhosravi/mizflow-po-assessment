begin;
alter table public.order_items add column served_at timestamptz, add column served_by uuid;
update public.order_items i set served_at=i.updated_at,served_by=o.created_by from public.orders o where o.id=i.order_id and i.status='served';
alter table public.order_items add foreign key(restaurant_id,served_by) references public.restaurant_memberships(restaurant_id,user_id) on delete restrict;
alter table public.order_items add check ((served_at is null)=(served_by is null));
alter table public.order_items add check (status<>'served' or served_at is not null);
create function private.validate_served_actor_scope() returns trigger language plpgsql set search_path='' as $$
begin
 if new.served_by is not null and not exists(select 1 from public.restaurant_memberships m where m.restaurant_id=new.restaurant_id and m.user_id=new.served_by and (m.role='owner' or m.branch_id=new.branch_id)) then
  raise exception 'server outside branch scope' using errcode='23503';
 end if;
 return new;
end; $$;
revoke all on function private.validate_served_actor_scope() from public,anon,authenticated;
create trigger item_served_actor_scope before insert or update of restaurant_id,branch_id,served_by on public.order_items for each row execute function private.validate_served_actor_scope();
-- Guests may order another round after earlier items were served, until the table is closed.
do $$ declare definition text; begin
  definition=pg_get_functiondef('public.add_order_items(uuid,jsonb,uuid)'::regprocedure);
  if position($guard$ord.status not in ('draft','submitted','in_preparation','ready')$guard$ in definition)=0 then raise exception 'Unexpected order command'; end if;
  execute replace(definition,$guard$ord.status not in ('draft','submitted','in_preparation','ready')$guard$,$guard$ord.status not in ('draft','submitted','in_preparation','ready','served')$guard$);
end $$;

create function public.serve_order_item(p_item_id uuid,p_expected_version integer,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item public.order_items%rowtype; ord public.orders%rowtype; actor uuid; result jsonb; payload jsonb; iv integer; ov integer; aggregate_status public.order_status;
begin
  select * into item from public.order_items where id=p_item_id;
  if not found then raise exception 'MF_FORBIDDEN' using errcode='42501'; end if;
  actor=private.require_staff(item.restaurant_id,item.branch_id,'waiter');
  payload=jsonb_build_object('expected_version',p_expected_version);
  result=private.cached_command(item.restaurant_id,item.branch_id,p_key,actor,'serve_item',p_item_id,payload);
  if result is not null then return result; end if;
  select * into ord from public.orders where id=item.order_id for update;
  select * into item from public.order_items where id=p_item_id for update;
  if ord.status not in ('submitted','in_preparation','ready') or p_expected_version is null or item.version<>p_expected_version then raise exception 'MF_CONFLICT' using errcode='PT409'; end if;
  if item.status<>'ready' then raise exception 'MF_INVALID_TRANSITION' using errcode='22023'; end if;
  update public.order_items set status='served',served_at=now(),served_by=actor,version=version+1 where id=item.id returning version into iv;
  select case when bool_or(status='queued') then 'submitted'::public.order_status
    when bool_or(status='preparing') then 'in_preparation'::public.order_status
    when bool_or(status='ready') then 'ready'::public.order_status else 'served'::public.order_status end
    into aggregate_status from public.order_items where order_id=ord.id and status<>'cancelled';
  update public.orders set status=aggregate_status,version=version+1 where id=ord.id returning version into ov;
  insert into public.order_events(restaurant_id,branch_id,order_id,order_item_id,actor_id,event_type,order_version,idempotency_key,details)
    values(item.restaurant_id,item.branch_id,ord.id,item.id,actor,'item_served',ov,p_key,jsonb_build_object('from','ready','to','served','item_version',iv,'served_at',now()));
  result=jsonb_build_object('order_id',ord.id,'version',ov,'item_id',item.id,'item_version',iv);
  insert into private.order_commands values(ord.restaurant_id,ord.branch_id,p_key,actor,'serve_item',item.id,payload,result,now());
  return result;
end; $$;

create function public.close_table_service(p_order_id uuid,p_expected_version integer,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ord public.orders%rowtype; actor uuid; result jsonb; payload jsonb; ov integer;
begin
  select * into ord from public.orders where id=p_order_id;
  if not found then raise exception 'MF_FORBIDDEN' using errcode='42501'; end if;
  actor=private.require_staff(ord.restaurant_id,ord.branch_id,'waiter');
  payload=jsonb_build_object('expected_version',p_expected_version);
  result=private.cached_command(ord.restaurant_id,ord.branch_id,p_key,actor,'close_table',ord.id,payload);
  if result is not null then return result; end if;
  perform 1 from public.dining_tables where id=ord.table_id for update;
  select * into ord from public.orders where id=p_order_id for update;
  if p_expected_version is null or ord.version<>p_expected_version or ord.status not in ('draft','served')
    or exists(select 1 from public.order_items where order_id=ord.id and status not in ('served','cancelled')) then
    raise exception 'MF_CONFLICT' using errcode='PT409';
  end if;
  update public.orders set status='closed',version=version+1 where id=ord.id returning version into ov;
  insert into public.order_events(restaurant_id,branch_id,order_id,actor_id,event_type,order_version,idempotency_key,details)
    values(ord.restaurant_id,ord.branch_id,ord.id,actor,'order_closed',ov,p_key,jsonb_build_object('reason','guests_departed','table_id',ord.table_id));
  result=jsonb_build_object('order_id',ord.id,'version',ov);
  insert into private.order_commands values(ord.restaurant_id,ord.branch_id,p_key,actor,'close_table',ord.id,payload,result,now());
  return result;
end; $$;
revoke all on function public.serve_order_item(uuid,integer,uuid),public.close_table_service(uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.serve_order_item(uuid,integer,uuid),public.close_table_service(uuid,integer,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
