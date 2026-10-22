begin;
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
declare
 payload jsonb:=jsonb_build_object('service_key','targeted-validation','icon_key','design','sort_order',7,'accepts_inquiries',false,'title_hy','Ծառայություն 😀','title_en','Service 😀','title_ru','Услуга 😀','description_hy','Ծառայության նկարագրություն։','description_en',E'Service description.\nSecond line.','description_ru','Описание услуги.');
 row_data jsonb;
 changed jsonb;
 field text;
 blank text;
 bad text;
 key text;
 failure_constraint text;
 previous_revision integer;
 blank_cases integer:=0;
 invalid_cases integer:=0;
begin
 foreach key in array array['surveying','construction','design','furniture','doorsWindows','realEstate'] loop
  begin
   perform public.save_service(null,null,jsonb_set(payload,'{service_key}',to_jsonb(key)));
   raise exception 'Reserved core draft creation succeeded: %',key;
  exception when check_violation then
   get stacked diagnostics failure_constraint=constraint_name;
   if failure_constraint<>'services_core_published' then raise exception 'Unexpected reserved-key rejection: %',failure_constraint; end if;
  end;
 end loop;
 foreach key in array array['doorswindows','realestate'] loop
  begin
   perform public.save_service(null,null,jsonb_set(payload,'{service_key}',to_jsonb(key)));
   raise exception 'Case-folded reserved identity accepted: %',key;
  exception when unique_violation then null; end;
 end loop;
 if (select count(*) from public.services where is_core and status='published')<>6 then raise exception 'Core rows changed'; end if;
 row_data:=public.save_service(null,null,payload);
 if row_data->>'status'<>'draft' or (row_data->>'is_core')::boolean then raise exception 'Additional creation did not produce noncore draft'; end if;
 perform set_config('parametr.targeted_service_id',row_data->>'id',true);
 foreach field in array array['title_hy','title_en','title_ru','description_hy','description_en','description_ru'] loop
  foreach blank in array array['',' ',E'\t\n\r',chr(160),chr(8195),chr(65279),chr(8203),chr(173)] loop
   changed:=jsonb_set(payload,array[field],to_jsonb(blank));
   if field='title_hy' then
    begin
     perform public.save_service((row_data->>'id')::uuid,(row_data->>'revision')::integer,changed);
     raise exception 'Blank Armenian draft title accepted';
    exception when check_violation then null; end;
   else
    row_data:=public.save_service((row_data->>'id')::uuid,(row_data->>'revision')::integer,changed);
    previous_revision:=(row_data->>'revision')::integer;
    begin
     perform public.set_service_status((row_data->>'id')::uuid,previous_revision,'published');
     raise exception 'Blank publication accepted: %',field;
    exception when check_violation then null; end;
    if not exists(select 1 from public.services where id=(row_data->>'id')::uuid and status='draft' and revision=previous_revision) then raise exception 'Failed publication changed status or revision'; end if;
    row_data:=public.save_service((row_data->>'id')::uuid,previous_revision,payload);
   end if;
   blank_cases:=blank_cases+1;
  end loop;
  foreach bad in array array['<script>x</script>',chr(1),repeat(chr(128512),case when field like 'title_%' then 201 else 2001 end)] loop
   begin
    perform public.save_service((row_data->>'id')::uuid,(row_data->>'revision')::integer,jsonb_set(payload,array[field],to_jsonb(bad)));
    raise exception 'Invalid service text accepted: %',field;
   exception when check_violation then null; end;
   invalid_cases:=invalid_cases+1;
  end loop;
  begin
   perform public.save_service((row_data->>'id')::uuid,(row_data->>'revision')::integer,payload-field);
   raise exception 'Missing service field accepted: %',field;
  exception when check_violation then null; end;
  begin
   perform public.save_service((row_data->>'id')::uuid,(row_data->>'revision')::integer,jsonb_set(payload,array[field],'null'::jsonb));
   raise exception 'Null service field accepted: %',field;
  exception when check_violation then null; end;
  changed:=jsonb_set(payload,array[field],to_jsonb(repeat(chr(128512),case when field like 'title_%' then 200 else 2000 end)));
  row_data:=public.save_service((row_data->>'id')::uuid,(row_data->>'revision')::integer,changed);
  row_data:=public.set_service_status((row_data->>'id')::uuid,(row_data->>'revision')::integer,'published');
  if row_data->>'status'<>'published' then raise exception 'Valid Unicode boundary publication failed'; end if;
  row_data:=public.set_service_status((row_data->>'id')::uuid,(row_data->>'revision')::integer,'draft');
  row_data:=public.save_service((row_data->>'id')::uuid,(row_data->>'revision')::integer,payload);
 end loop;
 row_data:=public.set_service_status((row_data->>'id')::uuid,(row_data->>'revision')::integer,'published');
 if row_data->>'status'<>'published' then raise exception 'Complete multilingual service failed publication'; end if;
 if blank_cases<>48 or invalid_cases<>18 then raise exception 'Validation coverage incomplete'; end if;
 raise notice 'PASS: six reserved core inserts rejected by core-published CHECK; 48 blank-field cases; 18 invalid-text cases; 12 missing/null fields; six exact Unicode publication boundaries; valid multilingual draft/publication.';
end $$;
reset role;
do $$ declare key text; begin
 foreach key in array array['surveying','construction','design','furniture','doorsWindows','realEstate'] loop
  begin
   insert into public.services(service_key,icon_key,sort_order,status,title_hy,title_en,title_ru,description_hy,description_en,description_ru)
   select service_key,icon_key,sort_order,'published',title_hy,title_en,title_ru,description_hy,description_en,description_ru from public.services where service_key=key;
   raise exception 'Published duplicate core identity accepted';
  exception when unique_violation then null; end;
 end loop;
end $$;
insert into auth.users(id,email) values('50000000-0000-4000-8000-000000000002','targeted-editor@example.invalid');
insert into public.admin_users(user_id,role) values('50000000-0000-4000-8000-000000000002','editor');
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
 begin
  perform public.set_service_status(current_setting('parametr.targeted_service_id')::uuid,0,'published');
  raise exception 'Editor publication authorized';
 exception when insufficient_privilege then null; end;
 begin
  perform public.save_service(null,null,'{"service_key":"construction","icon_key":"construction","sort_order":1,"accepts_inquiries":false,"title_hy":"Test","title_en":"Test","title_ru":"Test","description_hy":"Test","description_en":"Test","description_ru":"Test"}');
  raise exception 'Editor core creation authorized';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 if (select count(*) from public.services where service_key='targeted-validation')<>1 then raise exception 'Valid published addition not publicly visible'; end if;
 begin perform public.set_service_status(null,0,'published'); raise exception 'Anonymous publication authorized'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
do $$ begin
 if exists(select 1 from public.services where service_key='targeted-validation') or exists(select 1 from auth.users where id='50000000-0000-4000-8000-000000000002') then raise exception 'Targeted fixtures survived rollback'; end if;
 if (select count(*) from public.services where is_core and status='published')<>6 then raise exception 'Core inventory changed'; end if;
 raise notice 'PASS: independent core uniqueness, editor/anonymous authorization, public positive case and fixture rollback.';
end $$;
