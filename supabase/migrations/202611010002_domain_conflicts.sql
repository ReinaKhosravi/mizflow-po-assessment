begin;
-- 40001 is a database serialization failure: PostgREST may retry the transaction.
-- A business conflict is final for this command, and must return promptly as HTTP 409.
-- Replace only the reviewed three functions; preserve bodies, ownership and grants.
do $$
declare signature regprocedure; definition text;
begin
  foreach signature in array array[
    'public.open_table_order(uuid,uuid)'::regprocedure,
    'public.add_order_items(uuid,jsonb,uuid)'::regprocedure,
    'public.advance_order_item(uuid,integer,text,uuid)'::regprocedure
  ] loop
    definition=pg_get_functiondef(signature);
    if position('errcode=''40001''' in definition)=0 then
      raise exception 'Expected workflow conflict definition missing';
    end if;
    execute replace(definition,'errcode=''40001''','errcode=''PT409''');
  end loop;
end $$;
notify pgrst,'reload schema';
commit;
