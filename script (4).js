// ---------- General tree: zones ----------
var Z={},zc=0,ROOT=null,lockdown=false;
function addZone(name,lv,par){var id='z'+(++zc);Z[id]={id:id,name:name,lv:+lv,par:par,ch:[]};if(par)Z[par].ch.push(id);return id}
function path(id){var p=[];while(id){p.unshift(id);id=Z[id].par}return p}
function subtree(id,a){a=a||[];a.push(id);Z[id].ch.forEach(function(c){subtree(c,a)});return a}
function depth(id){return 1+Math.max(0,Math.max.apply(null,Z[id].ch.map(depth).concat([0])))}
function pre(id,a){a.push(Z[id].name);Z[id].ch.forEach(function(c){pre(c,a)});return a}
function post(id,a){Z[id].ch.forEach(function(c){post(c,a)});a.push(Z[id].name);return a}
ROOT=addZone('Facility',1,null);
var wl=addZone('Wet Lab',2,ROOT);addZone('Cell Culture',3,wl);addZone('BSL-3 Suite',4,wl);
var gn=addZone('Genomics',2,ROOT);addZone('Sequencing',3,gn);
var st=addZone('Storage',2,ROOT);addZone('Cold Storage',3,st);addZone('Sample Vault',4,st);
var ad=addZone('Administration',1,ROOT);addZone('Records',2,ad);

// ---------- AVL + BST ----------
var rotations=0;
function H(n){return n?n.h:0}
function fix(n){n.h=1+Math.max(H(n.l),H(n.r))}
function rotR(y){var x=y.l;y.l=x.r;x.r=y;fix(y);fix(x);rotations++;return x}
function rotL(x){var y=x.r;x.r=y.l;y.l=x;fix(x);fix(y);rotations++;return y}
function avlIns(n,k,v){
 if(!n)return {k:k,v:v,l:null,r:null,h:1};
 if(k<n.k)n.l=avlIns(n.l,k,v);else n.r=avlIns(n.r,k,v);
 fix(n);var b=H(n.l)-H(n.r);
 if(b>1){if(k>n.l.k)n.l=rotL(n.l);return rotR(n)}
 if(b<-1){if(k<n.r.k)n.r=rotR(n.r);return rotL(n)}
 return n}
function bstIns(n,k,v){if(!n)return {k:k,v:v,l:null,r:null,h:1};if(k<n.k)n.l=bstIns(n.l,k,v);else n.r=bstIns(n.r,k,v);fix(n);return n}
function find(n,k){var s=0;while(n){s++;if(k===n.k)return {n:n,s:s};n=k<n.k?n.l:n.r}return {n:null,s:s}}
var avl=null,bst=null,P=[];
function addPerson(name,id,cl,grant){
 if(!name||!id||find(avl,id).n)return false;
 var p={name:name,id:id,cl:+cl,grants:grant?[grant]:[],denies:[],active:true};
 P.push(p);avl=avlIns(avl,id,p);bst=bstIns(bst,id,p);return true}
[[101,'Aarav Rao',3,st],[102,'Meera Nair',2,gn],[103,'Dev Patel',4,wl],[104,'Isha Kapoor',1,ad],[105,'Rohan Das',3,ROOT],[106,'Sana Khan',2,wl]].forEach(function(x){addPerson(x[1],x[0],x[2],x[3])});
rotations=rotations;

// ---------- Access decision ----------
function decide(id,zid){
 var S=[],ok=false;function add(p,t){S.push({p:p,t:t});return p}
 var zp=path(zid),names=zp.map(function(z){return Z[z].name}).join(' > ');
 S.push({p:null,t:'Zone path (root to target): '+names});
 if(!add(!lockdown,lockdown?'Lockdown is active: all requests denied.':'Lockdown is off.'))return {ok:false,S:S,zp:zp};
 var r=find(avl,id);
 if(!add(!!r.n,r.n?'AVL search found ID '+id+' in '+r.s+' comparison(s).':'ID '+id+' not found after '+r.s+' comparison(s).'))return {ok:false,S:S,zp:zp};
 var p=r.n.v;
 if(!add(p.active,p.active?p.name+' has an active record.':p.name+' is revoked.'))return {ok:false,S:S,zp:zp};
 var d=zp.filter(function(z){return p.denies.indexOf(z)>-1});
 if(!add(!d.length,d.length?'Explicit deny on '+Z[d[0]].name+' (deny overrides any grant).':'No explicit deny on this path.'))return {ok:false,S:S,zp:zp};
 var g=zp.filter(function(z){return p.grants.indexOf(z)>-1});
 if(!add(!!g.length,g.length?'Grant on '+Z[g[0]].name+(g[0]===zid?'':' is inherited by '+Z[zid].name)+'.':'No grant on this zone or any ancestor.'))return {ok:false,S:S,zp:zp};
 var z=Z[zid];
 ok=add(p.cl>=z.lv,p.cl>=z.lv?'Clearance '+p.cl+' meets level '+z.lv+' of '+z.name+'.':'Clearance '+p.cl+' is below level '+z.lv+' required by '+z.name+'.');
 return {ok:ok,S:S,zp:zp}}

// ---------- UI ----------
function $(i){return document.getElementById(i)}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function zopts(sel){return Object.keys(Z).map(function(k){return '<option value="'+k+'"'+(k===sel?' selected':'')+'>'+'&nbsp;'.repeat((path(k).length-1)*2)+esc(Z[k].name)+'</option>'}).join('')}
function ztree(id){var z=Z[id];return '<li><div class="zn" id="n_'+id+'"><b>'+esc(z.name)+'</b><span class="lv">Level '+z.lv+'</span>'+(id===ROOT?'':'<button data-del="'+id+'">Remove</button>')+'</div>'+(z.ch.length?'<ul>'+z.ch.map(ztree).join('')+'</ul>':'')+'</li>'}
function leaves(){return Object.keys(Z).filter(function(k){return !Z[k].ch.length}).length}
function zname(ids){return ids.filter(function(i){return Z[i]}).map(function(i){return esc(Z[i].name)}).join(', ')||'-'}
function drawTree(root,hit){
 if(!root)return '<p class="note">Empty</p>';
 var pos=[],edges=[],c=0,md=0;
 (function go(n,d){if(!n)return;go(n.l,d+1);n.x=c++;n.d=d;md=Math.max(md,d);pos.push(n);go(n.r,d+1)})(root,0);
 pos.forEach(function(n){if(n.l)edges.push([n,n.l]);if(n.r)edges.push([n,n.r])});
 var W=c*42+30,Hh=(md+1)*54+24,X=function(n){return 22+n.x*42},Y=function(n){return 26+n.d*54};
 var s='<svg width="'+W+'" height="'+Hh+'" viewBox="0 0 '+W+' '+Hh+'">';
 edges.forEach(function(e){s+='<line class="e" x1="'+X(e[0])+'" y1="'+Y(e[0])+'" x2="'+X(e[1])+'" y2="'+Y(e[1])+'"/>'});
 pos.forEach(function(n){s+='<circle class="n'+(n.k===hit?' hit':'')+'" cx="'+X(n)+'" cy="'+Y(n)+'" r="17"/><text x="'+X(n)+'" y="'+Y(n)+'">'+n.k+'</text>'});
 return s+'</svg>'}
function render(){
 $('ztree').innerHTML=ztree(ROOT);
 $('sz').textContent=Object.keys(Z).length;$('sd').textContent=depth(ROOT);$('sl').textContent=leaves();$('sp').textContent=P.length;
 $('pre').textContent=pre(ROOT,[]).join(' > ');$('post').textContent=post(ROOT,[]).join(' > ');
 var zs=$('zp').value;$('zp').innerHTML=zopts(zs&&Z[zs]?zs:ROOT);
 var vz=$('vz').value;$('vz').innerHTML=zopts(vz&&Z[vz]?vz:ROOT);
 $('lockbar').style.display=lockdown?'block':'none';$('lockbtn').textContent=lockdown?'Disable emergency lockdown':'Enable emergency lockdown';
 var opts=zopts(ROOT);
 $('ptb').innerHTML=P.slice().sort(function(a,b){return a.id-b.id}).map(function(p){
  return '<tr><td>'+esc(p.name)+'</td><td>'+p.id+'</td><td>L'+p.cl+'</td><td>'+zname(p.grants)+'</td><td>'+zname(p.denies)+'</td><td><span class="pill '+(p.active?'ok':'bad')+'">'+(p.active?'Active':'Revoked')+'</span></td><td><div class="row" style="margin:0"><select id="m'+p.id+'">'+opts+'</select><button class="b g" data-g="'+p.id+'">Grant</button><button class="b r" data-d="'+p.id+'">Deny</button><button class="b r" data-s="'+p.id+'">'+(p.active?'Revoke':'Restore')+'</button></div></td></tr>'}).join('');
 $('hb').textContent=H(bst);$('ha').textContent=H(avl);$('rot').textContent=rotations;$('n2').textContent=P.length;
 $('svb').innerHTML=drawTree(bst);$('sva').innerHTML=drawTree(avl)}
function nextId(){return P.reduce(function(m,p){return Math.max(m,p.id)},100)+1}
var T=['zones','people','verify','cmp'];
$('nav').onclick=function(e){var t=e.target.dataset.t;if(!t)return;T.forEach(function(x){$(x).classList.toggle('on',x===t)});[].forEach.call($('nav').children,function(b){b.classList.toggle('on',b.dataset.t===t)})};
$('zadd').onclick=function(){var n=$('zn').value.trim();if(!n)return;addZone(n,$('zl').value,$('zp').value);$('zn').value='';render()};
$('ztree').onclick=function(e){var id=e.target.dataset.del;if(!id)return;var gone=subtree(id);var par=Z[id].par;Z[par].ch=Z[par].ch.filter(function(c){return c!==id});gone.forEach(function(g){delete Z[g]});P.forEach(function(p){p.grants=p.grants.filter(function(g){return Z[g]});p.denies=p.denies.filter(function(g){return Z[g]})});render()};
$('lockbtn').onclick=function(){lockdown=!lockdown;render()};
$('padd').onclick=function(){var n=$('pn').value.trim(),i=parseInt($('pi').value,10);if(!n||isNaN(i)){$('pmsg').textContent='Enter a name and a numeric ID.';return}
 if(!addPerson(n,i,$('pc').value,null)){$('pmsg').textContent='That ID already exists.';return}
 $('pmsg').textContent='Added. Open the Researchers table to grant a zone.';$('pn').value='';$('pi').value='';render()};
$('pbulk').onclick=function(){var a=['Kiran','Leela','Manav','Nila','Omar','Pooja','Ravi','Tara'];for(var k=0;k<5;k++){var i=nextId();addPerson(a[i%a.length]+' '+i,i,2,ROOT)}$('pmsg').textContent='Added 5 sequential IDs. Compare the trees in the BST vs AVL tab.';render()};
$('ptb').onclick=function(e){var d=e.target.dataset,id;
 if(d.g){id=+d.g;var p=find(avl,id).n.v,z=$('m'+id).value;if(p.grants.indexOf(z)<0)p.grants.push(z);p.denies=p.denies.filter(function(x){return x!==z})}
 else if(d.d){id=+d.d;var p2=find(avl,id).n.v,z2=$('m'+id).value;if(p2.denies.indexOf(z2)<0)p2.denies.push(z2)}
 else if(d.s){var p3=find(avl,+d.s).n.v;p3.active=!p3.active}else return;render()};
$('vgo').onclick=function(){var id=parseInt($('vi').value,10),zid=$('vz').value;if(isNaN(id)){$('vout').textContent='Enter a researcher ID.';return}
 var r=decide(id,zid);document.querySelectorAll('.zn.hl').forEach(function(x){x.classList.remove('hl')});
 r.zp.forEach(function(z){var el=$('n_'+z);if(el)el.classList.add('hl')});
 $('vout').innerHTML=r.S.map(function(s){return '<div class="step '+(s.p===null?'':s.p?'p':'f')+'"><span>'+(s.p===null?'i':s.p?'&#10003;':'&#10007;')+'</span><span>'+esc(s.t)+'</span></div>'}).join('')+'<div class="verdict '+(r.ok?'ok':'bad')+'">'+(r.ok?'ACCESS GRANTED':'ACCESS DENIED')+'</div><p class="note">The matching path is highlighted in the Zone hierarchy tab.</p>'};
$('sgo').onclick=function(){var k=parseInt($('si').value,10);if(isNaN(k))return;var a=find(avl,k),b=find(bst,k);
 $('sres').textContent=(a.n?'Found. ':'Not found. ')+'BST: '+b.s+' comparisons. AVL: '+a.s+' comparisons.';
 $('svb').innerHTML=drawTree(bst,b.n?k:null);$('sva').innerHTML=drawTree(avl,a.n?k:null)};
render();
