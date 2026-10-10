import {chromium} from 'playwright-core';
import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
const origin=process.env.TALENT_TEST_URL||'http://localhost:5186';
let browser;
before(async()=>{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});});
after(async()=>browser?.close());
const label='Apuntes de Ana para Agente';
const saveLabel='Guardar apuntes de Ana para Agente';
async function setup(failOnce=false){
 const context=await browser.newContext();
 const uid='00000000-0000-4000-8000-000000000001';
 const user={id:uid,email:'company@example.test',aud:'authenticated',role:'authenticated',user_metadata:{role:'company'},app_metadata:{},created_at:new Date().toISOString()};
 const payload=Buffer.from(JSON.stringify({sub:uid,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url');
 const session={user,access_token:`eyJhbGciOiJIUzI1NiJ9.${payload}.test`,refresh_token:'test',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer'};
 await context.addInitScript(session=>{
  const original=Storage.prototype.getItem;
  Storage.prototype.getItem=function(key){return /^sb-.*-auth-token$/.test(key)?JSON.stringify(session):original.call(this,key)};
 },session);
 const applications=[
  {id:'app-a',user_id:'candidate-a',vacancy_id:'vac-a',status:'nuevo',notas:null,vacancy:{title:'Agente'},candidate:{nombre:'Ana',email:'ana@example.test'}},
  {id:'app-b',user_id:'candidate-b',vacancy_id:'vac-b',status:'entrevista',notas:'Disponible lunes',vacancy:{title:'Ajustador'},candidate:{nombre:'Luis',email:'luis@example.test'}},
 ];
 const updates=[];
 await context.route('**/*',r=>{
  const req=r.request(),url=new URL(req.url());
  if(url.origin===origin) return r.continue();
  const send=(body,status=200)=>r.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.pathname==='/auth/v1/user') return send(user);
  if(url.pathname==='/rest/v1/rpc/has_role') return send(req.postDataJSON()._role==='recruiter');
  if(url.pathname==='/rest/v1/applications'){
   if(req.method()==='PATCH'){
    const id=url.searchParams.get('id')?.replace('eq.',''),body=req.postDataJSON();
    updates.push({id,body});
    if(failOnce){failOnce=false;return send({message:'Denied'},403);}
    const app=applications.find(a=>a.id===id);Object.assign(app,body);
    return send(url.searchParams.has('select')?{id:app.id,notas:app.notas}:null);
   }
   return send(applications);
  }
  if(url.pathname==='/rest/v1/profiles') return send([
   {user_id:'candidate-a',nombre:'Ana',ramos:['Vida'],certificaciones:[],cv_url:'candidate-a/cv.pdf'},
   {user_id:'candidate-b',nombre:'Luis',ramos:['Autos'],certificaciones:[],cv_url:null},
  ]);
  if(url.pathname.startsWith('/rest/v1/')) return send([]);
  return r.abort();
 });
 return {context,page:await context.newPage(),applications,updates};
}

test('Table notes save by application, survive reload and appear in Kanban',async()=>{
 const {context,page,applications,updates}=await setup();
 try{
  await page.goto(`${origin}/recruiter/candidates?vacancy=vac-a`);
  await page.getByRole('button',{name:'Tabla de apuntes',exact:true}).click();
  assert.equal(new URL(page.url()).searchParams.get('vacancy'),'vac-a');
  await page.getByLabel(label,{exact:true}).fill('Entrevista el martes\nDisponibilidad inmediata');
  await page.getByRole('button',{name:saveLabel,exact:true}).click();
  await page.getByText('Apuntes guardados',{exact:true}).waitFor();
  assert.equal(updates[0].id,'app-a');
  assert.deepEqual(updates[0].body,{notas:'Entrevista el martes\nDisponibilidad inmediata'});
  assert.equal(applications[1].notas,'Disponible lunes');
  await page.reload();
  await page.getByLabel(label,{exact:true}).waitFor();
  assert.equal(await page.getByLabel(label,{exact:true}).inputValue(),applications[0].notas);
  await page.getByRole('button',{name:'Kanban',exact:true}).click();
  await page.getByText(applications[0].notas,{exact:true}).waitFor();
  await page.getByRole('button',{name:'Tabla de apuntes',exact:true}).click();
  await page.getByLabel(label,{exact:true}).fill('');
  await page.getByRole('button',{name:saveLabel,exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('textarea')?.value==='' && [...document.querySelectorAll('button')].some(b=>b.textContent.includes('Guardar apuntes')&&b.disabled));
  assert.equal(applications[0].notas,null);
 }finally{await context.close();}
});

test('Failed note save preserves draft and allows retry',async()=>{
 const {context,page,applications}=await setup(true);
 try{
  await page.goto(`${origin}/recruiter/candidates?view=table`);
  await page.getByLabel(label,{exact:true}).fill('Apunte pendiente');
  await page.getByRole('button',{name:saveLabel,exact:true}).click();
  await page.getByText('No se pudieron guardar los apuntes',{exact:true}).waitFor();
  assert.equal(await page.getByLabel(label,{exact:true}).inputValue(),'Apunte pendiente');
  assert.equal(applications[0].notas,null);
  await page.getByRole('button',{name:saveLabel,exact:true}).click();
  await page.getByText('Apuntes guardados',{exact:true}).waitFor();
  assert.equal(applications[0].notas,'Apunte pendiente');
 }finally{await context.close();}
});
