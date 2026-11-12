// Isolated Postgres regression. Install @electric-sql/pglite@0.3.14 outside the
// checkout, then run with PGLITE_MODULE=/absolute/path/to/module node this-file.
const { PGlite } = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
(async () => {
 const db = new PGlite();
 try {
  await db.exec(`
   create role anon; create role authenticated;
   create schema auth;
   create function auth.uid() returns uuid language sql stable as $$
     select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
   $$;
   grant usage on schema auth to authenticated,anon;
   create table public.profiles(id uuid primary key,auth_user_id uuid unique not null);
   create table public.activities(id uuid primary key,title text);
   create table public.rsvps(id uuid primary key,activity_id uuid references activities(id),attended boolean);
   create table public.posts(id uuid primary key,caption text);
   create function public.current_profile_id() returns uuid language sql stable as $$
     select id from public.profiles where auth_user_id=auth.uid();
   $$;
  `);
  const schema=read('database/schema.sql');
  await db.exec(schema.slice(schema.indexOf('create table lessons ('),schema.indexOf('-- ---------- System')) || '');
  await db.exec(`
   insert into profiles values
     ('00000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001'),
     ('00000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002'),
     ('00000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000003');
   insert into activities values ('20000000-0000-4000-8000-000000000001','Preserved activity');
   insert into rsvps values ('30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',true);
   insert into posts values ('40000000-0000-4000-8000-000000000001','Preserved post');
   insert into habits(id,profile_id,title) values ('50000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','Preserved habit');
   insert into habit_checkins(habit_id,check_date) values ('50000000-0000-4000-8000-000000000001',(now() at time zone 'America/Denver')::date-1);
   alter table habits enable row level security;
   alter table habit_checkins enable row level security;
   alter table point_events enable row level security;
  `);
  await db.exec(read('database/002_habits.sql'));
  await db.exec(read('database/003_habit_order.sql'));
  await db.exec('grant select,insert,update,delete on all tables in schema public to authenticated;');
  await db.exec(read('database/007_lesson_sync.sql'));
  await db.exec(read('database/008_reflection_character_limit.sql'));
  await db.exec(`select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',false);
    select public.complete_momentum_lesson(1,'A preserved reflection.','Preserved lesson habit');`);
  const snapshot=async()=> (await db.query(`select jsonb_build_object(
    'activities',(select jsonb_agg(t order by id) from activities t),
    'rsvps',(select jsonb_agg(t order by id) from rsvps t),
    'posts',(select jsonb_agg(t order by id) from posts t),
    'habits',(select jsonb_agg(t order by id) from habits t),
    'checkins',(select jsonb_agg(t order by habit_id,check_date) from habit_checkins t),
    'lessons',(select jsonb_agg(t order by id) from lessons t),
    'completions',(select jsonb_agg(t order by profile_id,lesson_id) from lesson_completions t)) as records`)).rows;
  const before=await snapshot();
  const migration=read('database/016_remove_points.sql');
  assert.equal(read('supabase/migrations/20261112214356_remove_points.sql'),migration);
  await db.exec('begin;'+migration+'commit;');
  assert.deepEqual(await snapshot(),before,'all non-reward records must survive unchanged');
  assert.equal((await db.query(`select count(*)::int as n from information_schema.tables where table_schema='public' and table_name like 'point_%'`)).rows[0].n,0);
  assert.equal((await db.query(`select count(*)::int as n from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','momentum_private') and (p.proname ilike '%point%' or p.prosrc ilike '%point_events%' or p.prosrc ilike '%point_values%')`)).rows[0].n,0);
  await db.exec(read('database/internal/verify_lesson_sync.sql'));
  assert.deepEqual(await snapshot(),before,'integration checks must roll back their writes');
  // Exercise the new validator as an authenticated user, including ownership.
  await db.exec(`begin; set local role authenticated;
    select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
    insert into habit_checkins(habit_id) values ('50000000-0000-4000-8000-000000000001');
    delete from habit_checkins where habit_id='50000000-0000-4000-8000-000000000001' and check_date=public.momentum_today();
    do $$ declare rejected boolean := false; begin
      begin insert into habit_checkins(habit_id,check_date) values ('50000000-0000-4000-8000-000000000001',public.momentum_today()-2); exception when check_violation then rejected:=true; end;
      if not rejected then raise exception 'Backdated check-in accepted'; end if;
      rejected:=false;
      begin delete from habit_checkins where habit_id='50000000-0000-4000-8000-000000000001' and check_date=public.momentum_today()-1; exception when check_violation then rejected:=true; end;
      if not rejected then raise exception 'Historical check-in removed'; end if;
    end $$;
    select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
    do $$ declare rejected boolean := false; begin
      if exists(select 1 from habits where id='50000000-0000-4000-8000-000000000001') then raise exception 'Cross-account read'; end if;
      begin insert into habit_checkins(habit_id) values ('50000000-0000-4000-8000-000000000001'); exception when insufficient_privilege then rejected:=true; end;
      if not rejected then raise exception 'Cross-account check-in accepted'; end if;
    end $$;
    rollback;`);
  assert.deepEqual(await snapshot(),before);
  console.log('PASS: removal, record preservation, six lessons, retries, rollback, ownership, and today-only check-ins.');
 } finally { await db.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
