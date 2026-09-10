import type { RouteResult } from './routes';

// No user-provided HTML is interpolated; popup labels are assigned through textContent.
export function mapHtml(result: RouteResult | null, completed = 0) {
  const data = JSON.stringify({ result, completed }).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="anonymous">
<style>html,body,#map{height:100%;margin:0;font-family:Arial,sans-serif}#map{background:#eee7fa}.pin{background:#6d38c3;color:white;border:3px solid white;border-radius:50%;text-align:center;font-weight:bold;line-height:26px;box-shadow:0 2px 6px #0004}.start{background:#285f50}.done{background:#8c8793}#notice{position:absolute;top:10px;left:48px;right:10px;z-index:1000;background:white;padding:9px;border-radius:8px;font-size:12px;color:#583b7c;box-shadow:0 1px 6px #0002}.leaflet-control-attribution{font-size:10px}</style></head><body><div id="map" aria-label="Mapa do trajeto"></div><div id="notice" role="status">Carregando mapa…</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin="anonymous"></script>
<script>
const payload=${data};
const notice=document.getElementById('notice');
if(!window.L){notice.textContent='Não foi possível carregar o mapa. Verifique sua conexão.';}else{
const map=L.map('map',{scrollWheelZoom:false}).setView([-14.2,-51.9],4);
const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'}).addTo(map);
let tileError=false;
tiles.on('tileerror',()=>{tileError=true;notice.hidden=false;notice.textContent='Mapa de fundo indisponível. Verifique sua conexão.';});
tiles.on('load',()=>{if(!tileError){notice.hidden=!!payload.result;notice.textContent='Busque uma rota para ver o trajeto e as paradas.';}});
const r=payload.result;
if(r){
const latLng=c=>[c[1],c[0]];
L.polyline(r.geometry.map(latLng),{color:'#6d38c3',weight:5,opacity:0.85}).addTo(map);
[r.origin,...r.legs].forEach((point,i)=>{
const label=document.createElement('span');label.textContent=(i===0?'Partida: ':i+'. ')+point.label;
L.marker(latLng(point.coordinate),{icon:L.divIcon({className:'pin '+(i===0?'start':i<=payload.completed?'done':''),html:i===0?'P':i<=payload.completed?'✓':String(i),iconSize:[26,26],iconAnchor:[16,16]}),title:label.textContent}).addTo(map).bindPopup(label);
});
map.fitBounds(L.latLngBounds(r.geometry.map(latLng)).extend([r.origin,...r.legs].map(p=>latLng(p.coordinate))),{padding:[30,30],maxZoom:16});
}
setTimeout(()=>map.invalidateSize(),100);
}
</script></body></html>`;
}
