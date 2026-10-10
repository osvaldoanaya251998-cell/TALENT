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
   {user_id:'candidate-a',nombre:'Ana',email:'ana@example.test',telefono:'5551234567',ciudad:'Monterrey',experiencia:4,resumen:'Experiencia en seguros y atención a clientes.',skills:['Ventas'],ramos:['Vida'],certificaciones:['Cédula B'],cv_url:'candidate-a/cv.pdf'},
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


test('Clicking a candidate opens the summary and interview notes without visiting admin',async()=>{
 const {context,page,applications}=await setup();
 try{
  await page.goto(`${origin}/recruiter/candidates`);
  // Clicking the card body also opens the candidate, not just the name.
  await page.locator('article').filter({hasText:'Ana'}).getByText('Agente',{exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Ana',exact:true});
  await dialog.waitFor();
  await dialog.getByText('Experiencia en seguros y atención a clientes.',{exact:true}).waitFor();
  await dialog.getByText('Monterrey',{exact:true}).waitFor();
  await dialog.getByText('4 años',{exact:true}).waitFor();
  assert.equal(new URL(page.url()).pathname,'/recruiter/candidates');
  const notes=dialog.getByRole('textbox',{name:'Apuntes de entrevista',exact:true});
  await notes.fill('Entrevistador: José\nBuena comunicación. Segunda entrevista el viernes.');
  await dialog.getByRole('button',{name:'Guardar apuntes',exact:true}).click();
  await dialog.getByText('Apuntes guardados',{exact:true}).waitFor();
  assert.equal(applications[0].notas,'Entrevistador: José\nBuena comunicación. Segunda entrevista el viernes.');
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Ver resumen de Ana para Agente',exact:true}).click();
  assert.equal(await dialog.getByRole('textbox',{name:'Apuntes de entrevista',exact:true}).inputValue(),applications[0].notas);
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.reload();
  await page.getByRole('button',{name:'Ver resumen de Ana para Agente',exact:true}).click();
  assert.equal(await dialog.getByRole('textbox',{name:'Apuntes de entrevista',exact:true}).inputValue(),applications[0].notas);
  await dialog.evaluate(async (el) => { await Promise.all(el.getAnimations().map((animation) => animation.finished.catch(() => {}))); });
  await page.screenshot({path:'/tmp/talent-candidate-summary.png'});
  await page.setViewportSize({width:390,height:844});
  await dialog.screenshot({path:'/tmp/talent-candidate-summary-mobile.png'});
  const box=await dialog.boundingBox();
  assert.ok(box.x>=0 && box.x+box.width<=390);
  assert.ok(box.y>=0 && box.y+box.height<=844);
 }finally{await context.close();}
});

test('Candidate name in the table opens the same summary, and controls keep working',async()=>{
 const {context,page,updates}=await setup();
 try{
  await page.goto(`${origin}/recruiter/candidates?view=table`);
  await page.getByRole('button',{name:'Ver resumen de Ana para Agente',exact:true}).click();
  await page.getByRole('dialog',{name:'Ana',exact:true}).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.getByLabel('Estado de Ana para Agente',{exact:true}).selectOption('entrevista');
  assert.equal(await page.getByRole('dialog').count(),0);
  assert.deepEqual(updates[0].body,{status:'entrevista'});
 }finally{await context.close();}
});
