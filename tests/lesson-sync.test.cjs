const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { webcrypto } = require('node:crypto');
const goal = 'A specific reflection with an actionable plan for after class. '.repeat(5);
function app(db, opts={}) {
  const memory = new Map();
  const ctx = vm.createContext({console,Date,crypto:webcrypto,location:{origin:'http://test',pathname:'/lesson.html'},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)}});
  ctx.window=ctx;ctx.addEventListener=()=>{};ctx.MOMENTUM_CONFIG={SUPABASE_URL:'test',SUPABASE_ANON_KEY:'test'};
  const uid=opts.user||'user-a'; let calls=0;
  const builder=table=>{
    const filters=[]; let inserted, selection="";
    const result=()=>{
      if ((table==='profiles' && /(^|,)(city|state)(,|$)/.test(selection)) || (table==='profile_private' && /phone|home_address|zip_code|birthdate/.test(selection))) return {data:null,error:{message:'Column does not exist in current schema'}};
      if(opts.failLoad===table) return {data:null,error:{message:'Offline'}};
      if(inserted) { if(opts.failInsert) return {error:{message:'Save rejected'}}; db[table].push(inserted);return {error:null}; }
      let data=(db[table]||[]).filter(row=>filters.every(([k,v])=>row[k]===v));
      if(['habits','lesson_completions','point_events'].includes(table)) data=data.filter(r=>r.profile_id===uid);
      return {data,error:null};
    };
    const b={select:columns=>{selection=columns;return b;},eq:(k,v)=>{filters.push([k,v]);return b;},order:()=>b,in:()=>b,limit:()=>b,insert:r=>{inserted=r;return b;},maybeSingle:async()=>result().error ? result() : ({data:table==='profiles'?{id:uid,auth_user_id:uid,first_name:uid,username:uid,created_at:new Date().toISOString()}:null,error:null}),then:(resolve,reject)=>Promise.resolve(result()).then(resolve,reject)};return b;
  };
  ctx.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:uid}}}})},from:builder,rpc:async(name,args)=>{
    calls++; await Promise.resolve();
    if(opts.failRPC) return {data:null,error:{message:'Save rejected'}};
    const lesson=db.lessons.find(l=>l.number===args.p_number&&l.curriculum_version===2);
    const h={id:'habit-'+uid+'-'+lesson.id,profile_id:uid,title:args.p_habit_title,goal_text:args.p_goal,source_lesson_id:lesson.id,is_active:true,sort_order:1,created_at:new Date().toISOString()};
    db.habits.push(h);db.lesson_completions.push({profile_id:uid,lesson_id:lesson.id,habit_id:h.id,user_goal_response:args.p_goal,completed_at:h.created_at});
    db.point_events.push({id:'point-'+h.id,profile_id:uid,kind:'lesson',points:25,habit_id:h.id,occurred_on:'2026-11-08',created_at:h.created_at});
    return {data:{ok:true,points:25,habitId:h.id},error:null};
  }})};
  vm.runInContext(fs.readFileSync('js/store.js','utf8'),ctx);
  return {Store:ctx.Store,calls:()=>calls};
}
function data(){return {lessons:Array.from({length:6},(_,i)=>({id:101+i,number:i+1,curriculum_version:2})),habits:[],lesson_completions:[],point_events:[],point_values:[{kind:'lesson',points:25}],habit_checkins:[]};}
test('live completion uses database IDs, restores in a fresh browser and shares Home edits',async()=>{
 const db=data(),a=app(db);assert.equal(await a.Store.init(),true);
 const pending=a.Store.completeLesson(1,goal,'Walk after class');const retry=a.Store.completeLesson(1,goal,'Walk after class');
 await Promise.all([pending,retry]);assert.equal(a.calls(),1);
 assert.equal(a.Store.habits()[0].lessonId,101);assert.equal(a.Store.lessonHabit(1).title,'Walk after class');
 db.habits[0].title='Renamed on Home';db.habits[0].is_active=false;
 const fresh=app(db);assert.equal(await fresh.Store.init(),true);assert.equal(fresh.Store.isLessonDone(1),true);assert.equal(fresh.Store.lessonGoal(1),goal.trim());assert.equal(fresh.Store.lessonHabit(1).title,'Renamed on Home');assert.equal(fresh.Store.lessonHabit(1).active,false);assert.equal(fresh.Store.stats().points,25);
 const other=app(db,{user:'user-b'});await other.Store.init();assert.equal(other.Store.isLessonDone(1),false);assert.equal(other.Store.habits().length,0);
});
test('failed completion and Home habit writes do not claim success or mutate state',async()=>{
 const db=data(),a=app(db,{failRPC:true,failInsert:true});await a.Store.init();
 const result=await a.Store.completeLesson(1,goal,'Walk');assert.equal(result.ok,false);assert.equal(a.Store.isLessonDone(1),false);assert.equal(a.Store.habits().length,0);
 await assert.rejects(a.Store.addHabit('Read'),/Save rejected/);assert.equal(a.Store.habits().length,0);
});
test('failed progress restoration blocks the live UI instead of accepting cached progress',async()=>{
 const a=app(data(),{failLoad:'lesson_completions'});assert.equal(await a.Store.init(),'syncerror');
});
test('signup requires age confirmation and accepts the current required fields',()=>{
 const source=fs.readFileSync('js/pages/login.js','utf8');
 const match=source.match(/function validateSignup\(v\) \{[\s\S]*?\n  \}/);
 const validate=vm.runInNewContext('('+match[0]+')');
 const fields={first_name:'Test',last_name:'Person',email:'test@example.invalid',password:'Dummy-test-123!',password_confirm:'Dummy-test-123!',sex:'prefer_not_to_say',age_ok:true};
 assert.equal(Object.keys(validate(fields)).length,0);
 assert.ok(validate({...fields,age_ok:false}).age_ok);
});

test('reflections accept short text and enforce the character cap',async()=>{
 const db=data(),a=app(db);await a.Store.init();
 assert.equal((await a.Store.completeLesson(1,'   ','Walk')).ok,false);
 assert.equal((await a.Store.completeLesson(1,'x'.repeat(1001),'Walk')).ok,false);
 assert.equal(a.calls(),0);
 assert.equal((await a.Store.completeLesson(1,'I will walk after class.','Walk')).ok,true);
 const db2=data(),b=app(db2);await b.Store.init();
 assert.equal((await b.Store.completeLesson(1,'x'.repeat(1000),'Walk')).ok,true);
});
