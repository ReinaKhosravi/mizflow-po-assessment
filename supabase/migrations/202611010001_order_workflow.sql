begin;
-- A table remains occupied until service is explicitly closed/cancelled out of band.
-- Existing data must satisfy this invariant; migration fails rather than hiding duplicates.
create unique index one_active_order_per_table on public.orders(restaurant_id,branch_id,table_id)
where status in ('draft','submitted','in_preparation','ready','served');
alter table public.orders add column demo_scenario text;
alter table public.order_items add column submitted_at timestamptz not null default now();
update public.order_items set submitted_at=created_at;
alter table public.order_events add column details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object');
alter table public.order_events drop constraint order_events_event_type_check;
alter table public.order_events add constraint order_events_event_type_check check(event_type in ('order_created','order_submitted','items_added','item_preparing','item_ready','item_served','order_closed','order_cancelled','demo_imported'));

create table private.order_commands (
  restaurant_id uuid not null,
  branch_id uuid not null,
  idempotency_key uuid not null,
  actor_id uuid not null,
  command text not null,
  target_id uuid not null,
  payload jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(restaurant_id,branch_id,idempotency_key),
  foreign key(restaurant_id,branch_id) references public.branches(restaurant_id,id) on delete restrict,
  foreign key(restaurant_id,actor_id) references public.restaurant_memberships(restaurant_id,user_id) on delete restrict
);
alter table private.order_commands enable row level security;
revoke all on private.order_commands from public,anon,authenticated;

-- Membership share locks serialize a concurrent revocation with this transaction.
create function private.require_staff(r uuid,b uuid,staff public.staff_role) returns uuid
language plpgsql set search_path='' as $$
declare actor uuid;
begin
  actor=auth.uid();
  if actor is null then raise exception 'MF_FORBIDDEN' using errcode='42501'; end if;
  perform 1 from public.restaurant_memberships m where m.restaurant_id=r and m.user_id=actor
    and m.role=staff and m.branch_id=b and m.revoked_at is null for share;
  if not found then raise exception 'MF_FORBIDDEN' using errcode='42501'; end if;
  return actor;
end; $$;

-- Lock keys before resource rows. A retry must match actor, command, target AND payload.
create function private.cached_command(r uuid,b uuid,k uuid,a uuid,c text,t uuid,p jsonb) returns jsonb
language plpgsql set search_path='' as $$
declare previous private.order_commands%rowtype;
begin
  if k is null then raise exception 'MF_INVALID' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(r::text||':'||b::text||':'||k::text,0));
  select * into previous from private.order_commands where restaurant_id=r and branch_id=b and idempotency_key=k;
  if found then
    if previous.actor_id<>a or previous.command<>c or previous.target_id<>t or previous.payload<>p then
      raise exception 'MF_IDEMPOTENCY_MISMATCH' using errcode='22023';
    end if;
    return previous.result;
  end if;
  return null;
end; $$;

create function public.open_table_order(p_table_id uuid,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare tbl public.dining_tables%rowtype; actor uuid; result jsonb; oid uuid; ov integer;
begin
  select * into tbl from public.dining_tables where id=p_table_id;
  if not found then raise exception 'MF_FORBIDDEN' using errcode='42501'; end if;
  actor=private.require_staff(tbl.restaurant_id,tbl.branch_id,'waiter');
  result=private.cached_command(tbl.restaurant_id,tbl.branch_id,p_key,actor,'open',p_table_id,'{}');
  if result is not null then return result; end if;
  select * into tbl from public.dining_tables where id=p_table_id for update;
  if not tbl.is_active then raise exception 'MF_CONFLICT' using errcode='40001'; end if;
  if exists(select 1 from public.orders where restaurant_id=tbl.restaurant_id and branch_id=tbl.branch_id and table_id=tbl.id and status in ('draft','submitted','in_preparation','ready','served')) then
    raise exception 'MF_CONFLICT' using errcode='40001';
  end if;
  insert into public.orders(restaurant_id,branch_id,table_id,created_by,idempotency_key)
    values(tbl.restaurant_id,tbl.branch_id,tbl.id,actor,p_key) returning id,version into oid,ov;
  insert into public.order_events(restaurant_id,branch_id,order_id,actor_id,event_type,order_version,idempotency_key,details)
    values(tbl.restaurant_id,tbl.branch_id,oid,actor,'order_created',ov,p_key,jsonb_build_object('table_id',tbl.id));
  result=jsonb_build_object('order_id',oid,'version',ov);
  insert into private.order_commands values(tbl.restaurant_id,tbl.branch_id,p_key,actor,'open',p_table_id,'{}',result,now());
  return result;
end; $$;

create function public.add_order_items(p_order_id uuid,p_items jsonb,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare ord public.orders%rowtype; actor uuid; cached jsonb; entry jsonb; menu public.menu_items%rowtype;
  ids uuid[]='{}'; iid uuid; qty integer; note text; total numeric; added numeric=0; ov integer; result jsonb;
begin
  select * into ord from public.orders where id=p_order_id;
  if not found then raise exception 'MF_FORBIDDEN' using errcode='42501'; end if;
  actor=private.require_staff(ord.restaurant_id,ord.branch_id,'waiter');
  if p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'MF_INVALID' using errcode='22023'; end if;
  if jsonb_array_length(p_items) not between 1 and 30 then raise exception 'MF_INVALID' using errcode='22023'; end if;
  cached=private.cached_command(ord.restaurant_id,ord.branch_id,p_key,actor,'add',p_order_id,p_items);
  if cached is not null then return cached; end if;
  select * into ord from public.orders where id=p_order_id for update;
  if ord.status not in ('draft','submitted','in_preparation','ready') then raise exception 'MF_CONFLICT' using errcode='40001'; end if;
  -- Shared menu locks prevent a concurrent owner price edit during snapshot creation.
  perform 1 from public.menu_items where restaurant_id=ord.restaurant_id and branch_id=ord.branch_id
    and id in(select (value->>'menu_item_id')::uuid from jsonb_array_elements(p_items)) order by id for share;
  select coalesce(sum(unit_price_irr::numeric*quantity),0) into total from public.order_items where order_id=ord.id and status<>'cancelled';
  for entry in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(entry)<>'object' then raise exception 'MF_INVALID' using errcode='22023'; end if;
    if exists(select 1 from jsonb_object_keys(entry) k where k not in ('menu_item_id','quantity','notes')) then raise exception 'MF_INVALID' using errcode='22023'; end if;
    if jsonb_typeof(entry->'quantity') is distinct from 'number' or (entry->>'quantity')!~'^[0-9]{1,3}$' then raise exception 'MF_INVALID' using errcode='22023'; end if;
    qty=(entry->>'quantity')::integer;
    if qty not between 1 and 100 then raise exception 'MF_INVALID' using errcode='22023'; end if;
    if entry ? 'notes' and jsonb_typeof(entry->'notes')<>'string' then raise exception 'MF_INVALID' using errcode='22023'; end if;
    note=coalesce(entry->>'notes','');
    if length(note)>500 then raise exception 'MF_INVALID' using errcode='22023'; end if;
    select * into menu from public.menu_items where id=(entry->>'menu_item_id')::uuid and restaurant_id=ord.restaurant_id and branch_id=ord.branch_id and is_available;
    if not found then raise exception 'MF_MENU_UNAVAILABLE' using errcode='22023'; end if;
    added=added+menu.price_irr::numeric*qty;
    if total+added>9007199254740991 then raise exception 'MF_INVALID_TOTAL' using errcode='22003'; end if;
    insert into public.order_items(restaurant_id,branch_id,order_id,menu_item_id,name_snapshot,unit_price_irr,quantity,notes,idempotency_key,submitted_at)
      values(ord.restaurant_id,ord.branch_id,ord.id,menu.id,menu.name,menu.price_irr,qty,note,gen_random_uuid(),now()) returning id into iid;
    ids=array_append(ids,iid);
  end loop;
  update public.orders set status='submitted',version=version+1 where id=ord.id returning version into ov;
  insert into public.order_events(restaurant_id,branch_id,order_id,actor_id,event_type,order_version,idempotency_key,details)
    values(ord.restaurant_id,ord.branch_id,ord.id,actor,case when ord.status='draft' then 'order_submitted' else 'items_added' end,ov,p_key,jsonb_build_object('item_ids',ids));
  result=jsonb_build_object('order_id',ord.id,'version',ov,'item_ids',ids);
  insert into private.order_commands values(ord.restaurant_id,ord.branch_id,p_key,actor,'add',p_order_id,p_items,result,now());
  return result;
end; $$;

create function public.advance_order_item(p_item_id uuid,p_expected_version integer,p_next_status text,p_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare item public.order_items%rowtype; ord public.orders%rowtype; actor uuid; payload jsonb; result jsonb; iv integer; ov integer; aggregate_status public.order_status;
begin
  select * into item from public.order_items where id=p_item_id;
  if not found then raise exception 'MF_FORBIDDEN' using errcode='42501'; end if;
  actor=private.require_staff(item.restaurant_id,item.branch_id,'kitchen');
  payload=jsonb_build_object('expected_version',p_expected_version,'next_status',p_next_status);
  result=private.cached_command(item.restaurant_id,item.branch_id,p_key,actor,'advance',p_item_id,payload);
  if result is not null then return result; end if;
  select * into ord from public.orders where id=item.order_id for update;
  select * into item from public.order_items where id=p_item_id for update;
  if ord.status not in ('submitted','in_preparation','ready') or p_expected_version is null or item.version<>p_expected_version then raise exception 'MF_CONFLICT' using errcode='40001'; end if;
  if p_next_status is null or not ((item.status='queued' and p_next_status='preparing') or (item.status='preparing' and p_next_status='ready')) then raise exception 'MF_INVALID_TRANSITION' using errcode='22023'; end if;
  update public.order_items set status=p_next_status::public.order_item_status,version=version+1 where id=item.id returning version into iv;
  select case when bool_or(status='queued') then 'submitted'::public.order_status
    when bool_or(status='preparing') then 'in_preparation'::public.order_status else 'ready'::public.order_status end
    into aggregate_status from public.order_items where order_id=ord.id and status<>'cancelled';
  update public.orders set status=aggregate_status,version=version+1 where id=ord.id returning version into ov;
  insert into public.order_events(restaurant_id,branch_id,order_id,order_item_id,actor_id,event_type,order_version,idempotency_key,details)
    values(item.restaurant_id,item.branch_id,ord.id,item.id,actor,case when p_next_status='preparing' then 'item_preparing' else 'item_ready' end,ov,p_key,jsonb_build_object('from',item.status,'to',p_next_status,'item_version',iv));
  result=jsonb_build_object('order_id',ord.id,'version',ov,'item_id',item.id,'item_version',iv);
  insert into private.order_commands values(item.restaurant_id,item.branch_id,p_key,actor,'advance',p_item_id,payload,result,now());
  return result;
end; $$;

revoke all on function private.require_staff(uuid,uuid,public.staff_role),private.cached_command(uuid,uuid,uuid,uuid,text,uuid,jsonb) from public,anon,authenticated;
revoke all on function public.open_table_order(uuid,uuid),public.add_order_items(uuid,jsonb,uuid),public.advance_order_item(uuid,integer,text,uuid) from public,anon,authenticated;
grant execute on function public.open_table_order(uuid,uuid),public.add_order_items(uuid,jsonb,uuid),public.advance_order_item(uuid,integer,text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
