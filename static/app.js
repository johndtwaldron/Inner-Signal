const state={items:[],queue:JSON.parse(localStorage.getItem("inner-signal-queue")||"[]"),current:null,collection:"All",images:[],imageIndex:0,timer:null,shuffle:false,repeat:"off"};
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const ART={"STASYA.KNIGHT.RELAXATION.":"images/stasya-knight-relaxation.png","Meditations":"images/mirror-dance-lodge.jpg"};
const DEFAULT_ART="images/inner-signal-default.png";
const OFFLINE_CACHE="inner-signal-offline-v1";
const YOUTUBE_PLAYLIST="https://youtube.com/playlist?list=PLigOQIYm3Ub9rLYotDp3cBQUYhYlkP3DI&si=Icunyd8kH7N6XGxc";
const fmt=s=>{if(!Number.isFinite(s))return "—";const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=String(Math.floor(s%60)).padStart(2,"0");return h?`${h}:${String(m).padStart(2,"0")}:${sec}`:`${m}:${sec}`};
const size=n=>`${(n/1048576).toFixed(1)} MB`;
const artwork=x=>x.cover_id?`/api/media/${x.cover_id}`:ART[x.collection]||DEFAULT_ART;
const playable=()=>state.items.filter(x=>x.kind==="audio"||x.kind==="video");
function showClientBadge(){const ua=navigator.userAgent;const mobileSafari=/iPhone|iPad|iPod/.test(ua)&&/Safari/.test(ua)&&!/CriOS|FxiOS|EdgiOS/.test(ua);const badge=$("#client-badge");if(mobileSafari){badge.hidden=false;badge.textContent=navigator.standalone?"IPHONE · HOME SCREEN":"MOBILE SAFARI"}}

async function load(refresh=false){
  const button=$("#reindex"),summary=$("#summary");
  if(refresh){button.disabled=true;button.textContent="Refreshing…";summary.textContent="Following shortcuts and reading metadata…"}
  try{
    const result=refresh?await fetch("/api/reindex",{method:"POST"}).then(r=>r.json()):null;
    const data=await fetch("/api/library").then(r=>r.json());state.items=data.items;
    state.queue=state.queue.filter(id=>state.items.some(x=>x.id===id));
    const aliases=state.items.filter(x=>x.is_alias).length;
    const covers=new Set(state.items.filter(item=>item.cover_id).map(item=>item.collection)).size;
    summary.textContent=`${data.counts.audio+data.counts.video} recordings · ${aliases} via shortcuts · ${covers} collection covers${refresh?' · updated just now':''}`;
    await refreshOffline();renderCollections();renderLibrary();loadFolderImages();saveQueue();
    if(refresh)button.textContent=`✓ ${result.indexed} indexed · ${result.covers} covers`;
  }catch(error){summary.textContent="Refresh failed — check that Drive is available";button.textContent="Try refresh again"}
  finally{button.disabled=false;if(refresh)setTimeout(()=>button.textContent="↻ Refresh library",2500)}
}
function renderCollections(){
  const names=["All",...new Set(playable().map(x=>x.collection))];
  $("#collections").innerHTML=names.map(n=>`<button class="${n===state.collection?'active':''}" data-collection="${n}">${n}</button>`).join("");
  $$('[data-collection]').forEach(b=>b.onclick=()=>{state.collection=b.dataset.collection;renderCollections();renderLibrary()});
  const query=state.collection==="All"?"meditation affirmation hypnosis cover art":`${state.collection} meditation album artwork`;
  $("#art-search").href=`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`;
}
function renderLibrary(){
  const query=$("#search").value.toLowerCase();
  const items=playable().filter(x=>(state.collection==="All"||x.collection===state.collection)&&x.title.toLowerCase().includes(query));
  $("#library").innerHTML=items.length?items.map(x=>`<article class="card" data-testid="media-card"><img class="card-art" src="${artwork(x)}" alt="" loading="lazy"><div class="card-copy"><small>${x.kind==="video"?'MP4 AUDIO':'AUDIO'} · ${x.collection}${x.is_alias?' · SHORTCUT':''}</small><h3>${x.title}</h3><div class="meta">${fmt(x.duration_seconds)} · ${size(x.size_bytes)}</div><div class="tags">${x.tags.map(tag=>`<span>${tag}</span>`).join("")}</div><div class="actions"><button data-add="${x.id}">＋ Queue</button><button data-local="${x.id}">${state.offline?.has(x.id)?'✓ Offline':'↓ Offline'}</button><button class="listen" aria-label="Play ${x.title}" data-play="${x.id}">▶</button></div></div></article>`).join(""):'<p class="empty">No matching recordings.</p>';
  $$('[data-play]').forEach(b=>b.onclick=()=>play(b.dataset.play));$$('[data-add]').forEach(b=>b.onclick=()=>add(b.dataset.add));$$('[data-local]').forEach(b=>b.onclick=()=>toggleOffline(b.dataset.local,b));
}
function saveQueue(){localStorage.setItem("inner-signal-queue",JSON.stringify(state.queue));$("#queue-count").textContent=state.queue.length;renderQueue()}
function add(id){if(!state.queue.includes(id))state.queue.push(id);saveQueue()}
function renderQueue(){
  const items=state.queue.map(id=>state.items.find(x=>x.id===id)).filter(Boolean);
  $("#queue").innerHTML=items.length?items.map((x,i)=>`<div class="queue-item"><img src="${artwork(x)}" alt=""><span>${String(i+1).padStart(2,"0")}</span><div><strong>${x.title}</strong><div class="meta">${x.collection} · ${fmt(x.duration_seconds)}</div></div><div><button aria-label="Play ${x.title}" data-qplay="${x.id}">▶</button><button data-remove="${i}" aria-label="Remove ${x.title}">×</button></div></div>`).join(""):'<p class="empty">Your queue is empty. Add a recording from the library.</p>';
  $$('[data-qplay]').forEach(b=>b.onclick=()=>play(b.dataset.qplay));$$('[data-remove]').forEach(b=>b.onclick=()=>{state.queue.splice(+b.dataset.remove,1);saveQueue()});
}
async function refreshOffline(){
  if(!("caches" in window)){state.offline=new Set();return}
  const cache=await caches.open(OFFLINE_CACHE),keys=await cache.keys();state.offline=new Set(keys.map(request=>request.url.split("/").pop()));
  $("#offline-count").textContent=state.offline.size;renderOffline();await updateStorage();
}
async function toggleOffline(id,button){
  const cache=await caches.open(OFFLINE_CACHE),url=`/api/media/${id}`;
  if(state.offline.has(id)){await cache.delete(url);state.offline.delete(id);button.textContent="↓ Offline";await refreshOffline();renderLibrary();return}
  button.disabled=true;button.textContent="Starting…";
  try{
    const response=await fetch(url);if(!response.ok||!response.body)throw new Error("Download failed");
    const total=Number(response.headers.get("content-length"))||state.items.find(x=>x.id===id)?.size_bytes||0;
    const [cacheStream,progressStream]=response.body.tee();
    const saving=cache.put(url,new Response(cacheStream,{status:200,headers:response.headers}));
    const reader=progressStream.getReader();let received=0;
    while(true){const {done,value}=await reader.read();if(done)break;received+=value.byteLength;button.textContent=total?`${Math.min(100,Math.round(received/total*100))}%`:`${size(received)}`}
    await saving;state.offline.add(id);button.textContent="✓ Offline";await refreshOffline();renderLibrary();
  }catch(error){button.textContent="Retry download"}finally{button.disabled=false}
}
function renderOffline(){
  if(!state.items.length)return;const items=[...state.offline].map(id=>state.items.find(x=>x.id===id)).filter(Boolean);
  $("#offline-list").innerHTML=items.length?items.map(x=>`<div class="queue-item"><img src="${artwork(x)}" alt=""><span>✓</span><div><strong>${x.title}</strong><div class="meta">${size(x.size_bytes)} · available offline</div></div><button data-remove-local="${x.id}">Remove</button></div>`).join(""):'<p class="empty">No recordings downloaded yet. Choose “Offline” on any library card.</p>';
  $$('[data-remove-local]').forEach(b=>b.onclick=()=>toggleOffline(b.dataset.removeLocal,b));
}
async function updateStorage(){
  const offlineBytes=[...state.offline].map(id=>state.items.find(x=>x.id===id)?.size_bytes||0).reduce((a,b)=>a+b,0);
  let usage=offlineBytes,quota=0;if(navigator.storage?.estimate){const estimate=await navigator.storage.estimate();usage=estimate.usage||offlineBytes;quota=estimate.quota||0}
  const percent=quota?Math.min(100,usage/quota*100):0;$("#storage-used").textContent=`${size(offlineBytes)} offline audio · ${size(usage)} app storage`;$("#storage-detail").textContent=quota?`${size(quota)} web-app allowance on this device`:"Storage allowance unavailable";$("#storage-percent").textContent=quota?`${percent.toFixed(2)}%`:"—";$("#storage-bar").style.width=`${percent}%`;
}
function play(id){
  const item=state.items.find(x=>x.id===id);if(!item)return;const el=$("#audio");el.pause();el.src=`/api/media/${id}`;state.current={id,el};
  $("#now-title").textContent=item.title;$("#player").classList.remove("hidden");$("#play").textContent="❚❚";$(".cover").style.backgroundImage=`url('${artwork(item)}')`;
  el.play().catch(()=>{$("#play").textContent="▶"});
  el.ontimeupdate=()=>{$("#elapsed").textContent=fmt(el.currentTime);$("#duration").textContent=fmt(el.duration);$("#progress").value=el.duration?el.currentTime/el.duration*100:0};el.onended=trackEnded;
}
function playbackSequence(){if(state.current&&state.queue.includes(state.current.id))return state.queue;return playable().map(x=>x.id)}
function stepTrack(delta){const sequence=playbackSequence();if(!sequence.length)return;if(state.shuffle){const choices=sequence.filter(id=>id!==state.current?.id);play(choices[Math.floor(Math.random()*choices.length)]||sequence[0]);return}const currentIndex=state.current?sequence.indexOf(state.current.id):-1;const start=currentIndex<0?(delta>0?-1:0):currentIndex;play(sequence[(start+delta+sequence.length)%sequence.length])}
function trackEnded(){if(state.repeat==="one"){play(state.current.id);return}const sequence=playbackSequence(),index=sequence.indexOf(state.current?.id);if(state.repeat==="off"&&!state.shuffle&&index===sequence.length-1){$("#play").textContent="▶";return}stepTrack(1)}
function toggleShuffle(){state.shuffle=!state.shuffle;const button=$("#shuffle");button.classList.toggle("active",state.shuffle);button.setAttribute("aria-label",`Shuffle ${state.shuffle?'on':'off'}`)}
function toggleRepeat(){const modes=["off","all","one"];state.repeat=modes[(modes.indexOf(state.repeat)+1)%modes.length];const button=$("#repeat");button.classList.toggle("active",state.repeat!=="off");button.textContent=state.repeat==="one"?"↻¹":"↻";button.setAttribute("aria-label",`Repeat ${state.repeat}`)}
async function recommend(){
  const button=$("#recommend"),feedback=$("#recommendation-feedback");button.disabled=true;button.textContent="Building…";feedback.textContent="Matching mood, purpose and available time…";
  try{const data=await fetch("/api/recommendations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({mood:$("#mood").value,mode:$("#session-mode").value})}).then(r=>r.json());state.queue=data.track_ids;saveQueue();feedback.textContent=`Ready: ${state.queue.length} tracks · ${fmt(data.duration_seconds)} · matched ${data.matched_tags.join(", ")||"general"}.`;button.textContent="✓ Queue ready"}
  catch(error){feedback.textContent="I couldn't build the queue. Try refreshing the library.";button.textContent="Try again"}finally{button.disabled=false;setTimeout(()=>button.textContent="Build my queue",2200)}
}
function setupYouTube(){const input=$("#youtube-url"),open=$("#open-youtube");input.value=localStorage.getItem("inner-signal-youtube")||YOUTUBE_PLAYLIST;const sync=()=>{open.href=input.value||"#";open.classList.toggle("disabled",!input.value)};sync();$("#save-youtube").onclick=()=>{if(!input.value.includes("youtube.com/")&&!input.value.includes("youtu.be/"))return;localStorage.setItem("inner-signal-youtube",input.value);sync();$("#save-youtube").textContent="✓ Saved";setTimeout(()=>$("#save-youtube").textContent="Save link",1500)}}
function setImage(){const frame=$("#slideshow");if(!state.images.length){frame.innerHTML='<div class="empty">Choose images from your Mac now. Images added to the media folder will also appear here.</div>';return}frame.innerHTML=`<img alt="Slideshow image" src="${state.images[state.imageIndex]}">`}
function stepImage(delta=1){if(!state.images.length)return;state.imageIndex=(state.imageIndex+delta+state.images.length)%state.images.length;setImage()}
function toggleSlideshow(){if(state.timer){clearInterval(state.timer);state.timer=null;$("#toggle-slideshow").textContent="Play"}else if(state.images.length){state.timer=setInterval(stepImage,+$("#interval").value*1000);$("#toggle-slideshow").textContent="Pause"}}
function loadFolderImages(){state.images=[DEFAULT_ART,"/images/mirror-dance-lodge.jpg",...Object.values(ART),...state.items.filter(x=>x.kind==="image").map(x=>`/api/media/${x.id}`),...state.images.filter(x=>x.startsWith("blob:"))];state.images=[...new Set(state.images)];setImage()}

$$('.tabs button').forEach(b=>b.onclick=()=>{$$('.tabs button,.view').forEach(x=>x.classList.remove('active'));b.classList.add('active');$(`#${b.dataset.view}-view`).classList.add('active')});
$("#search").oninput=renderLibrary;$("#clear-queue").onclick=()=>{state.queue=[];saveQueue()};$("#reindex").onclick=()=>load(true);$("#next").onclick=()=>stepTrack(1);$("#previous").onclick=()=>stepTrack(-1);$("#shuffle").onclick=toggleShuffle;$("#repeat").onclick=toggleRepeat;$("#recommend").onclick=recommend;
$("#play").onclick=()=>{if(!state.current)return;const e=state.current.el;if(e.paused){e.play();$("#play").textContent="❚❚"}else{e.pause();$("#play").textContent="▶"}};$("#progress").oninput=e=>{const el=state.current?.el;if(el?.duration)el.currentTime=el.duration*e.target.value/100};
$("#image-input").onchange=e=>{state.images.push(...[...e.target.files].map(URL.createObjectURL));setImage()};$("#prev-image").onclick=()=>stepImage(-1);$("#next-image").onclick=()=>stepImage(1);$("#toggle-slideshow").onclick=toggleSlideshow;
if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js");showClientBadge();setupYouTube();saveQueue();load().catch(()=>{$("#summary").textContent="Library unavailable"});
