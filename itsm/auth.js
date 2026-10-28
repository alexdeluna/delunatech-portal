/* Camada local de compatibilidade: substitui Firebase Auth/Firestore por localStorage. */
const STORE = 'delunatech-itsm-local-db-v1';
const auth = { currentUser: null };
const db = { localOnly: true };
const googleProvider = {};
function readDB(){ try { return JSON.parse(localStorage.getItem(STORE) || '{}'); } catch { return {}; } }
function writeDB(data){ localStorage.setItem(STORE, JSON.stringify(data)); }
function collection(_db, name){ return { kind:'collection', name }; }
function doc(_db, collectionName, id){ return { kind:'document', collectionName, id:String(id) }; }
function where(field, op, value){ return { field, op, value }; }
function query(ref, ...filters){ return { ...ref, filters }; }
function snapshot(id, data){ return { id, exists:()=>data !== undefined, data:()=>data === undefined ? undefined : structuredClone(data) }; }
async function getDocs(ref){
 const dbData=readDB(); const col=dbData[ref.name] || {};
 let entries=Object.entries(col);
 for(const f of (ref.filters||[])){ if(f.op==='==') entries=entries.filter(([,v])=>v?.[f.field]===f.value); }
 const docs=entries.map(([id,v])=>snapshot(id,v)); return { docs, empty:docs.length===0, size:docs.length };
}
async function getDoc(ref){ const data=readDB()[ref.collectionName]?.[ref.id]; return snapshot(ref.id,data); }
async function setDoc(ref, data){ const d=readDB(); d[ref.collectionName] ||= {}; d[ref.collectionName][ref.id]=structuredClone(data); writeDB(d); }
async function addDoc(ref, data){ const d=readDB(); d[ref.name] ||= {}; const id='local-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8); d[ref.name][id]=structuredClone(data); writeDB(d); return { id }; }
async function updateDoc(ref, updates){ const d=readDB(); d[ref.collectionName] ||= {}; if(!d[ref.collectionName][ref.id]) throw new Error('Registro local não encontrado: '+ref.id); d[ref.collectionName][ref.id]={...d[ref.collectionName][ref.id],...structuredClone(updates)}; writeDB(d); }
async function signOut(){ auth.currentUser=null; }
async function signInWithEmailAndPassword(){ throw new Error('A demonstração usa seleção de perfil, sem autenticação.'); }
async function signInWithPopup(){ throw new Error('A demonstração usa seleção de perfil, sem autenticação.'); }
async function createUserWithEmailAndPassword(){ throw new Error('Cadastro desativado nesta demonstração local.'); }
function onAuthStateChanged(_auth, callback){ queueMicrotask(()=>callback(null)); return ()=>{}; }
export {auth,db,googleProvider,collection,doc,getDoc,getDocs,addDoc,updateDoc,setDoc,query,where,createUserWithEmailAndPassword,signInWithEmailAndPassword,signInWithPopup,onAuthStateChanged,signOut};
