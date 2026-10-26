// Banco local baseado em localStorage. Nenhum dado é enviado à internet.
import { auth } from './auth.js';
const PREFIX = 'delunatech_pix_data_v1_';
function getKey() { return PREFIX + (auth.currentUser?.uid || 'local_usuario'); }
function read() {
  try { const value = JSON.parse(localStorage.getItem(getKey()) || '{"pessoas":[]}'); return value && Array.isArray(value.pessoas) ? value : { pessoas: [] }; }
  catch { return { pessoas: [] }; }
}
function write(data) { localStorage.setItem(getKey(), JSON.stringify(data)); }
function id() { return globalThis.crypto?.randomUUID?.() || ('id_' + Date.now().toString(36) + Math.random().toString(36).slice(2)); }
export async function criarUsuarioSeNaoExistir() { const data = read(); write(data); }
export async function cadastrarPessoa(nome) {
  if (!nome?.trim()) throw new Error('Informe o nome da pessoa.');
  const data = read(); const pessoa = { id: id(), nome: nome.trim(), criadoEm: new Date().toISOString(), atualizadoEm: new Date().toISOString(), chaves: [] };
  data.pessoas.push(pessoa); write(data); return pessoa.id;
}
export async function listarPessoas() { return read().pessoas.map(({chaves, ...p}) => p).sort((a,b) => a.nome.localeCompare(b.nome, 'pt-BR')); }
export async function obterPessoa(pessoaId) { const p = read().pessoas.find(x => x.id === pessoaId); if (!p) return null; const {chaves, ...rest} = p; return rest; }
export async function atualizarPessoa(pessoaId, nome) { if (!nome?.trim()) throw new Error('Informe o nome da pessoa.'); const d=read(), p=d.pessoas.find(x=>x.id===pessoaId); if(!p) throw new Error('Pessoa não encontrada.'); p.nome=nome.trim(); p.atualizadoEm=new Date().toISOString(); write(d); }
export async function excluirPessoa(pessoaId) { const d=read(); d.pessoas=d.pessoas.filter(x=>x.id!==pessoaId); write(d); }
export async function cadastrarChave(pessoaId, chave, banco, tipoDetectado='') { if(!chave?.trim()) throw new Error('Informe a chave PIX.'); if(!banco?.trim()) throw new Error('Informe o banco.'); const d=read(), p=d.pessoas.find(x=>x.id===pessoaId); if(!p) throw new Error('Pessoa não encontrada.'); const c={id:id(),chave:chave.trim(),banco:banco.trim(),tipoDetectado:tipoDetectado||'',criadoEm:new Date().toISOString(),atualizadoEm:new Date().toISOString()}; p.chaves ||= []; p.chaves.push(c); write(d); return c.id; }
export async function listarChaves(pessoaId) { const p=read().pessoas.find(x=>x.id===pessoaId); return (p?.chaves||[]).slice().sort((a,b)=>String(b.criadoEm).localeCompare(String(a.criadoEm))); }
export async function obterChave(pessoaId,chaveId) { return (await listarChaves(pessoaId)).find(c=>c.id===chaveId)||null; }
export async function atualizarChave(pessoaId,chaveId,chave,banco,tipoDetectado='') { if(!chave?.trim()) throw new Error('Informe uma chave PIX.'); if(!banco?.trim()) throw new Error('Informe o banco.'); const d=read(), p=d.pessoas.find(x=>x.id===pessoaId), c=p?.chaves?.find(x=>x.id===chaveId); if(!c) throw new Error('Chave não encontrada.'); Object.assign(c,{chave:chave.trim(),banco:banco.trim(),tipoDetectado:tipoDetectado||'',atualizadoEm:new Date().toISOString()}); write(d); }
export async function excluirChave(pessoaId,chaveId) { const d=read(), p=d.pessoas.find(x=>x.id===pessoaId); if(p) p.chaves=(p.chaves||[]).filter(c=>c.id!==chaveId); write(d); }
