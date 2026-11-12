const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { webcrypto } = require('node:crypto');
const goal = 'A specific reflection with an actionable plan for after class. '.repeat(5);
function app(db, opts={}) {
  const memory = opts.memory || new Map();
  const ctx = vm.createContext({console,Date,crypto:webcrypto,location:{origin:'http://test',pathname:'/lesson.html'},localStorage:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)}});
  ctx.window=ctx;ctx.addEventListener=()=>{};ctx.MOMENTUM_CONFIG={SUPABASE_URL:'test',SUPABASE_ANON_KEY:'test'};
  const uid=opts.user||'user-a'; let calls=0;
  const builder=table=>{
    const filters=[]; let inserted, deleting=false, single=false, selection="";
    const result=()=>{
      if ((table==='profiles' && /(^|,)(city|state)(,|$)/.test(selection)) || (table==='profile_private' && /phone|home_address|zip_code|birthdate/.test(selection))) return {data:null,error:{message:'Column does not exist in current schema'}};
      if(opts.failLoad===table) return {data:null,error:{message:'Offline'}};
      if(inserted) {
        if(opts.failInsert) return {error:{message:'Save rejected'}};
        const row={id:webcrypto.randomUUID(),created_at:new Date().toISOString(),...inserted};
        if(table==='habit_checkins') row.check_date=ctx.Store.today();
        (db[table] ||= []).push(row);return {data:single?row:[row],error:null};
      }
      if(deleting) { db[table]=(db[table]||[]).filter(row=>!filters.every(([k,v])=>row[k]===v));return {data:[],error:null}; }
      let data=(db[table]||[]).filter(row=>filters.every(([k,v])=>row[k]===v));
      if(['habits','lesson_completions'].includes(table)) data=data.filter(r=>r.profile_id===uid);
      return {data,error:null};
    };
    const b={select:columns=>{selection=columns;return b;},eq:(k,v)=>{filters.push([k,v]);return b;},order:()=>b,in:()=>b,limit:()=>b,insert:r=>{inserted=r;return b;},delete:()=>{deleting=true;return b;},single:async()=>{single=true;return result();},maybeSingle:async()=>result().error ? result() : ({data:table==='profiles'?{id:uid,auth_user_id:uid,first_name:uid,username:uid,created_at:new Date().toISOString()}:null,error:null}),then:(resolve,reject)=>Promise.resolve(result()).then(resolve,reject)};return b;
  };
  ctx.supabase={createClient:()=>({auth:{getSession:async()=>({data:{session:{user:{id:uid}}}})},from:builder,rpc:async(name,args)=>{
    calls++; await Promise.resolve();
    if(opts.failRPC) return {data:null,error:{message:'Save rejected'}};
    const lesson=db.lessons.find(l=>l.number===args.p_number&&l.curriculum_version===2);
    const h={id:'habit-'+uid+'-'+lesson.id,profile_id:uid,title:args.p_habit_title,goal_text:args.p_goal,source_lesson_id:lesson.id,is_active:true,sort_order:1,created_at:new Date().toISOString()};
    db.habits.push(h);db.lesson_completions.push({profile_id:uid,lesson_id:lesson.id,habit_id:h.id,user_goal_response:args.p_goal,completed_at:h.created_at});
    return {data:{ok:true,habitId:h.id},error:null};
  }})};
  vm.runInContext(fs.readFileSync('js/store.js','utf8'),ctx);
  return {Store:ctx.Store,calls:()=>calls,memory};
}
function data(){return {lessons:Array.from({length:6},(_,i)=>({id:101+i,number:i+1,curriculum_version:2})),habits:[],lesson_completions:[],habit_checkins:[],posts:[],activities:[]};}
test('live completion uses database IDs, restores in a fresh browser and shares Home edits',async()=>{
 const db=data(),a=app(db);assert.equal(await a.Store.init(),true);
 const pending=a.Store.completeLesson(1,goal,'Walk after class');const retry=a.Store.completeLesson(1,goal,'Walk after class');
 await Promise.all([pending,retry]);assert.equal(a.calls(),1);
 assert.equal(a.Store.habits()[0].lessonId,101);assert.equal(a.Store.lessonHabit(1).title,'Walk after class');
 db.habits[0].title='Renamed on Home';db.habits[0].is_active=false;
 const fresh=app(db);assert.equal(await fresh.Store.init(),true);assert.equal(fresh.Store.isLessonDone(1),true);assert.equal(fresh.Store.lessonGoal(1),goal.trim());assert.equal(fresh.Store.lessonHabit(1).title,'Renamed on Home');assert.equal(fresh.Store.lessonHabit(1).active,false);assert.equal(fresh.Store.stats().lessonPercent,17);
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

test('all six lessons save without reward tables and progress runs from zero to 100 percent', async () => {
 const db=data(),a=app(db);
 assert.equal(await a.Store.init(),true);
 assert.equal(a.Store.stats().lessonPercent,0);
 for(let n=1;n<=6;n++) {
   assert.equal((await a.Store.completeLesson(n,'My next action.','Practice '+n)).ok,true);
   assert.equal(a.Store.stats().lessonPercent,Math.round(n/6*100));
 }
 assert.equal(a.Store.currentLesson(),null);
 assert.equal(db.habits.length,6);
 assert.equal(db.lesson_completions.length,6);
 assert.equal(a.Store.stats().points,undefined);
});

test('restoring old browser data discards awards and preserves commitments and settings', async () => {
 const db=data(),a=app(db);await a.Store.init();
 // Emulate a pre-change cache persisted by an older version.
 a.Store.state.points=[{kind:'post',points:5}];
 a.Store.state.rsvps.push({id:'old-rsvp',profileId:'user-a',activityId:'old-activity',status:'committed',attended:null});
 a.Store.state.settings.checkinTime='18:00';
 a.Store.saveReport('old-activity','Saved report');
 // A fresh Store instance must read the same cache.
 const saved=a.memory;
 const restored=app(db,{memory:saved});await restored.Store.init();
 assert.equal('points' in restored.Store.state,false);
 assert.equal(restored.Store.state.rsvps[0].id,'old-rsvp');
 assert.equal(restored.Store.state.settings.checkinTime,'18:00');
 assert.equal(restored.Store.state.reports[0].body,'Saved report');
});

test('habit check-ins still save, restore a streak, and can be unchecked', async () => {
 const db=data(),a=app(db);await a.Store.init();
 await a.Store.completeLesson(1,'A small action.','Walk');
 const id=a.Store.habits()[0].id;
 assert.equal(a.Store.toggleHabit(id).done,true);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(db.habit_checkins.length,1);
 assert.equal(a.Store.stats().streak,1);
 const fresh=app(db);await fresh.Store.init();
 assert.equal(fresh.Store.isHabitDone(id),true);
 assert.equal(fresh.Store.stats().streak,1);
 assert.equal(fresh.Store.toggleHabit(id).done,false);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(db.habit_checkins.length,0);
 assert.equal(fresh.Store.stats().streak,0);
});

test('commitments, cancellation, plus-one acceptance, attendance, and posting still work', async () => {
 const db=data(),a=app(db);await a.Store.init();
 const starts=new Date(Date.now()+72*3600000),ends=new Date(starts.getTime()+3600000);
 db.activities.push({id:'activity-a',host_id:'host',title:'Walk',starts_at:starts.toISOString(),ends_at:ends.toISOString(),min_participants:2,max_participants:10});
 await a.Store.loadActivities();
 assert.equal(a.Store.commit('activity-a',{type:'guest',name:'Guest'}).ok,true);
 assert.equal(a.Store.isGoing('activity-a'),true);
 assert.equal(a.Store.state.guests.length,1);
 assert.equal(a.Store.cancel('activity-a').ok,true);
 assert.equal(a.Store.isGoing('activity-a'),false);
 assert.equal(a.Store.state.guests.length,0);
 assert.equal(a.Store.commit('activity-a').ok,true);
 assert.equal(a.Store.checkIn('activity-a',true).ok,true);
 assert.equal(a.Store.stats().attended,1);
 a.Store.state.rsvps=[];
 a.Store.state.rsvps.push({id:'friend-rsvp',activityId:'activity-a',profileId:'friend',status:'committed',attended:null});
 a.Store.state.guests.push({id:'invite',rsvpId:'friend-rsvp',guestProfileId:'user-a',status:'pending'});
 assert.equal(a.Store.respondPlusOne('invite',true).ok,true);
 assert.equal(a.Store.isGoing('activity-a'),true);
 assert.equal((await a.Store.createPost({caption:'We went for a walk.'})).ok,true);
 assert.equal((await a.Store.createPost({caption:'Another update.'})).ok,true);
 assert.equal(db.posts.length,2);
 assert.equal('points' in a.Store.state,false);
});

test('lesson and streak pages render percent complete without reward displays', () => {
 for(const done of [0,1,3,6]) {
   for(const page of ['lessons','streak']) {
     const main={innerHTML:''};
     const ctx=vm.createContext({window:null,document:{getElementById:()=>main,querySelectorAll:()=>[]},requestAnimationFrame:()=>{},UI:{mount:(_,render)=>render(),icon:()=>'',esc:s=>s},Store:{isLessonDone:n=>n<=done,isLessonUnlocked:n=>n<=done+1,LESSON_COUNT:6,lastDays:()=>[],stats:()=>({streak:1,longest:1,doneToday:true,goalsMetDays:1,attended:1,upcoming:1,habitsChecked:1,lessonPercent:Math.round(done/6*100)})}});
     ctx.window=ctx;ctx.LESSONS=Array.from({length:6},(_,i)=>({n:i+1,title:'Lesson '+(i+1),minutes:8}));
     vm.runInContext(fs.readFileSync('js/pages/'+page+'.js','utf8'),ctx);
     assert.ok(main.innerHTML.includes(Math.round(done/6*100)+'%'));
     assert.doesNotMatch(main.innerHTML,/points|undefined|NaN/);
   }
 }
});
