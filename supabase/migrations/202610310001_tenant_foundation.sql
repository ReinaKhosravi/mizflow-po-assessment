-- Applied by the migration administrator, never by an ordinary user request.
begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
revoke create on schema public from public, anon, authenticated;

create type public.staff_role as enum ('owner', 'waiter', 'kitchen');
create type public.order_status as enum ('draft', 'submitted', 'in_preparation', 'ready', 'served', 'closed', 'cancelled');
create type public.order_item_status as enum ('queued', 'preparing', 'ready', 'served', 'cancelled');

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.branches (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  name text not null check (length(trim(name)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, id),
  unique (restaurant_id, name)
);
create table public.restaurant_memberships (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  branch_id uuid,
  role public.staff_role not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, user_id),
  foreign key (restaurant_id, branch_id) references public.branches(restaurant_id, id) on delete restrict,
  -- Owners are restaurant-wide. Other staff have exactly one assigned branch.
  check ((role = 'owner' and branch_id is null) or (role <> 'owner' and branch_id is not null))
);
create index memberships_user_active on public.restaurant_memberships(user_id, restaurant_id) where revoked_at is null;
create index memberships_branch on public.restaurant_memberships(restaurant_id, branch_id);

create table public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  branch_id uuid not null,
  label text not null check (length(trim(label)) between 1 and 60),
  seats smallint not null check (seats between 1 and 30),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, branch_id) references public.branches(restaurant_id, id) on delete restrict,
  unique (restaurant_id, branch_id, id),
  unique (restaurant_id, branch_id, label)
);
create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  branch_id uuid not null,
  name text not null check (length(trim(name)) between 1 and 120),
  category text not null check (length(trim(category)) between 1 and 80),
  description text not null default '' check (length(description) <= 1000),
  price_irr bigint not null check (price_irr between 0 and 9007199254740991),
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, branch_id) references public.branches(restaurant_id, id) on delete restrict,
  unique (restaurant_id, branch_id, id),
  unique (restaurant_id, branch_id, name)
);
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  branch_id uuid not null,
  table_id uuid not null,
  created_by uuid not null,
  status public.order_status not null default 'draft',
  version integer not null default 1 check (version > 0),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, branch_id) references public.branches(restaurant_id, id) on delete restrict,
  foreign key (restaurant_id, branch_id, table_id) references public.dining_tables(restaurant_id, branch_id, id) on delete restrict,
  foreign key (restaurant_id, created_by) references public.restaurant_memberships(restaurant_id, user_id) on delete restrict,
  unique (restaurant_id, branch_id, id),
  unique (restaurant_id, branch_id, idempotency_key)
);
create index orders_board on public.orders(restaurant_id, branch_id, status, created_at);
create index orders_table on public.orders(restaurant_id, branch_id, table_id);
create index orders_author on public.orders(restaurant_id, created_by);
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  branch_id uuid not null,
  order_id uuid not null,
  menu_item_id uuid not null,
  name_snapshot text not null check (length(trim(name_snapshot)) between 1 and 120),
  unit_price_irr bigint not null check (unit_price_irr between 0 and 9007199254740991),
  quantity smallint not null check (quantity between 1 and 100),
  status public.order_item_status not null default 'queued',
  version integer not null default 1 check (version > 0),
  idempotency_key uuid not null,
  notes text not null default '' check (length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (restaurant_id, branch_id, order_id) references public.orders(restaurant_id, branch_id, id) on delete restrict,
  foreign key (restaurant_id, branch_id, menu_item_id) references public.menu_items(restaurant_id, branch_id, id) on delete restrict,
  unique (restaurant_id, branch_id, order_id, id),
  unique (restaurant_id, branch_id, order_id, idempotency_key)
);
create index order_items_menu on public.order_items(restaurant_id, branch_id, menu_item_id);
create index order_items_board on public.order_items(restaurant_id, branch_id, status, created_at);
create table public.order_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null,
  branch_id uuid not null,
  order_id uuid not null,
  order_item_id uuid,
  actor_id uuid not null,
  event_type text not null check (event_type in ('order_created','order_submitted','item_preparing','item_ready','item_served','order_closed','order_cancelled','demo_imported')),
  order_version integer not null check (order_version > 0),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  foreign key (restaurant_id, branch_id, order_id) references public.orders(restaurant_id, branch_id, id) on delete restrict,
  foreign key (restaurant_id, branch_id, order_id, order_item_id) references public.order_items(restaurant_id, branch_id, order_id, id) on delete restrict,
  foreign key (restaurant_id, actor_id) references public.restaurant_memberships(restaurant_id, user_id) on delete restrict,
  unique (restaurant_id, branch_id, order_id, idempotency_key)
);
create index order_events_history on public.order_events(restaurant_id, branch_id, order_id, created_at, id);
create index order_events_actor on public.order_events(restaurant_id, actor_id);

create function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
create function private.reject_event_mutation() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'order_events is append-only' using errcode = '42501'; end; $$;
create trigger order_events_immutable before update or delete on public.order_events for each row execute function private.reject_event_mutation();
-- Also deny bulk truncation to normal SQL clients; the migration administrator can still alter schema.
create trigger order_events_no_truncate before truncate on public.order_events for each statement execute function private.reject_event_mutation();

do $$ declare t text; begin
  foreach t in array array['restaurants','branches','restaurant_memberships','dining_tables','menu_items','orders','order_items'] loop
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()', t);
  end loop;
end; $$;

-- Relationship validation is independent of RLS: an author must belong to this branch
-- (or be a restaurant-wide owner). Existing history survives later role revocation.
create function private.validate_actor_scope() returns trigger language plpgsql set search_path = '' as $$
declare actor uuid;
begin
  if tg_table_name = 'orders' then actor = new.created_by; else actor = new.actor_id; end if;
  if not exists(select 1 from public.restaurant_memberships m
    where m.restaurant_id = new.restaurant_id and m.user_id = actor
      and (m.role = 'owner' or m.branch_id = new.branch_id)) then
    raise exception 'actor outside branch scope' using errcode = '23503';
  end if;
  return new;
end; $$;
create trigger order_actor_scope before insert or update of restaurant_id, branch_id, created_by on public.orders for each row execute function private.validate_actor_scope();
create trigger event_actor_scope before insert on public.order_events for each row execute function private.validate_actor_scope();

-- Deliberately narrow SECURITY DEFINER helpers avoid recursive membership policies.
-- Never accept a user/role supplied by the caller. No row or secret is returned.
create function private.has_restaurant_access(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.restaurant_memberships m where m.restaurant_id = target and m.user_id = (select auth.uid()) and m.revoked_at is null);
$$;
create function private.is_owner(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.restaurant_memberships m where m.restaurant_id = target and m.user_id = (select auth.uid()) and m.revoked_at is null and m.role = 'owner');
$$;
create function private.has_branch_access(target uuid, target_branch uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.restaurant_memberships m where m.restaurant_id = target and m.user_id = (select auth.uid()) and m.revoked_at is null and (m.role = 'owner' or m.branch_id = target_branch));
$$;
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.has_restaurant_access(uuid), private.is_owner(uuid), private.has_branch_access(uuid, uuid) to authenticated;

-- Supabase may have broad default grants: revoke explicitly before least-privilege grants.
revoke all on public.restaurants, public.branches, public.restaurant_memberships, public.dining_tables, public.menu_items, public.orders, public.order_items, public.order_events from public, anon, authenticated;
grant select on public.restaurants, public.branches, public.restaurant_memberships, public.dining_tables, public.menu_items, public.orders, public.order_items, public.order_events to authenticated;
grant update (name) on public.restaurants to authenticated;
grant insert on public.branches, public.dining_tables, public.menu_items to authenticated;
grant update (name) on public.branches to authenticated;
grant update (label, seats, is_active) on public.dining_tables to authenticated;
grant update (name, category, description, price_irr, is_available) on public.menu_items to authenticated;
-- No membership mutation (even for owners), hard deletion, order mutation, event insertion or truncation grants.

do $$ declare t text; begin
  foreach t in array array['restaurants','branches','restaurant_memberships','dining_tables','menu_items','orders','order_items','order_events'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end; $$;
create policy restaurant_read on public.restaurants for select to authenticated using (private.has_restaurant_access(id));
create policy restaurant_edit on public.restaurants for update to authenticated using (private.is_owner(id)) with check (private.is_owner(id));
create policy membership_read on public.restaurant_memberships for select to authenticated using ((user_id = (select auth.uid()) and revoked_at is null) or private.is_owner(restaurant_id));
create policy branch_read on public.branches for select to authenticated using (private.has_branch_access(restaurant_id, id));
create policy branch_insert on public.branches for insert to authenticated with check (private.is_owner(restaurant_id));
create policy branch_edit on public.branches for update to authenticated using (private.is_owner(restaurant_id)) with check (private.is_owner(restaurant_id));

do $$ declare t text; begin
  foreach t in array array['dining_tables','menu_items'] loop
    execute format('create policy scoped_read on public.%I for select to authenticated using (private.has_branch_access(restaurant_id, branch_id))', t);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check (private.is_owner(restaurant_id))', t);
    execute format('create policy owner_edit on public.%I for update to authenticated using (private.is_owner(restaurant_id)) with check (private.is_owner(restaurant_id))', t);
  end loop;
  foreach t in array array['orders','order_items','order_events'] loop
    execute format('create policy scoped_read on public.%I for select to authenticated using (private.has_branch_access(restaurant_id, branch_id))', t);
  end loop;
end; $$;
commit;
