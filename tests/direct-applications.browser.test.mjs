import {chromium} from 'playwright-core';
import {after,before,test} from 'node:test';
import assert from 'node:assert/strict';
const origin=process.env.TALENT_TEST_URL||'http://localhost:5185';
let browser;
before(async()=>{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});});
after(async()=>browser?.close());
const uid='00000000-0000-4000-8000-000000000021';
const vacancy='00000000-0000-4000-8000-000000000010';
async function setup(result){
 const context=await browser.newContext();
 const user={id:uid,email:'test@example.test',aud:'authenticated',role:'authenticated',user_metadata:{role:'candidate'},app_metadata:{},created_at:new Date().toISOString()};
 const payload=Buffer.from(JSON.stringify({sub:uid,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
 const session={user,access_token:`eyJhbGciOiJIUzI1NiJ9.${payload}.test`,refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer'};
 await context.addInitScript(session=>{
  const original=Storage.prototype.getItem;
  Storage.prototype.getItem=function(key){return /^sb-.*-auth-token$/.test(key)?JSON.stringify(session):original.call(this,key)};
 },session);
 const calls=[];
 await context.route('**/*',r=>{
  const req=r.request(),url=new URL(req.url());
  if(url.origin===origin) return r.continue();
  const send=body=>r.fulfill({contentType:'application/json',body:JSON.stringify(body)});
  calls.push(url.pathname);
  if(url.pathname==='/auth/v1/user') return send(user);
  if(url.pathname==='/rest/v1/rpc/has_role') return send(false);
  if(url.pathname==='/rest/v1/vacancies') return send(url.searchParams.get('limit')==='1'?{id:vacancy,title:'Agente',slug:'agente',description:'Vacante de prueba'}:[]);
  if(url.pathname==='/rest/v1/profiles') return send({user_id:uid,nombre:'Candidato',email:user.email,telefono:'5551234567',ciudad:'Mexico',cv_url:`${uid}/cv.pdf`,accepted_privacy_policy:true});
  if(url.pathname==='/rest/v1/rpc/apply_to_vacancy') {assert.equal(req.postDataJSON()._vacancy_id,vacancy);return send(result);}
  if(url.pathname.startsWith('/rest/v1/')) return send([]);
  return r.abort();
 });
 return {context,page:await context.newPage(),calls};
}
for(const result of [{application_id:'test-application'},{application_id:'test-application',evaluation_id:'legacy-evaluation',completed:false}]){
 test(`Direct confirmation with ${result.evaluation_id?'legacy':'new'} RPC response`,async()=>{
  const {context,page,calls}=await setup(result);
  try{
   await page.goto(`${origin}/apply?vacancy=agente`);
   await page.getByRole('button',{name:'Postularme',exact:true}).click();
   await page.getByRole('heading',{name:'Postulación enviada'}).waitFor();
   assert.equal(new URL(page.url()).pathname,'/apply');
   assert.equal(calls.filter(p=>p==='/rest/v1/rpc/apply_to_vacancy').length,1);
   assert.equal(calls.some(p=>/evaluation|question/.test(p)),false);
   assert.equal(await page.getByRole('button',{name:'Postularme',exact:true}).count(),0);
  }finally{await context.close();}
 });
}
for(const path of ['/evaluation','/evaluation-result?id=00000000-0000-4000-8000-000000000030']){
 test(`Old exam link ${path} returns to jobs`,async()=>{
  const {context,page,calls}=await setup({});
  try{await page.goto(`${origin}${path}`);await page.waitForURL(`${origin}/jobs`);assert.equal(calls.some(p=>/evaluation|question/.test(p)),false);}finally{await context.close();}
 });
}
